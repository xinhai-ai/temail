import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, isSuperAdminRole } from "@/lib/rbac";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";

const updateSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).nullable().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.string().datetime().nullable().optional(),
});

async function logAdminAction(request: NextRequest, adminUserId: string, message: string, metadata?: unknown) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");

  await prisma.log.create({
    data: {
      level: "INFO",
      action: "USER_UPDATE",
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip: ip || null,
      userAgent: userAgent || null,
      userId: adminUserId,
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [user, emailCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            mailboxes: true,
            domains: true,
            workflows: true,
          },
        },
      },
    }),
    prisma.email.count({ where: { mailbox: { userId: id } } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    _count: { ...user._count, emails: emailCount },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isSuperAdmin = isSuperAdminRole(session.user.role);
  if (target.role === "SUPER_ADMIN" && !isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    if (data.role && !isSuperAdmin) {
      return NextResponse.json(
        { error: "Only SUPER_ADMIN can change roles" },
        { status: 403 }
      );
    }

    if (id === session.user.id && (data.role || data.isActive === false)) {
      return NextResponse.json(
        { error: "You cannot change your own role or deactivate yourself" },
        { status: 400 }
      );
    }

    if (data.email) {
      const existing = await prisma.user.findFirst({
        where: { email: data.email, NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    const updateData: {
      email?: string;
      name?: string | null;
      role?: "SUPER_ADMIN" | "ADMIN" | "USER";
      isActive?: boolean;
      emailVerified?: Date | null;
    } = {};

    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.emailVerified !== undefined) {
      updateData.emailVerified = data.emailVerified ? new Date(data.emailVerified) : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAdminAction(request, session.user.id, `Admin updated user ${id}`, {
      targetUserId: id,
      updates: Object.keys(updateData),
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdminRole(session.user.role)) {
    return NextResponse.json(
      { error: "Only SUPER_ADMIN can delete users" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "You cannot delete yourself" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.user.count({
      where: { role: "SUPER_ADMIN" },
    });
    if (superAdminCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last SUPER_ADMIN" },
        { status: 400 }
      );
    }
  }

  await prisma.user.delete({ where: { id } });
  await logAdminAction(request, session.user.id, `Admin deleted user ${id}`, {
    targetUserId: id,
  });

  return NextResponse.json({ success: true });
}
