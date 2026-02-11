import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession, isSuperAdminRole } from "@/lib/rbac";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { computeAuthSources, uniqueOAuthProviders } from "@/lib/auth-sources";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";

const updateSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  name: z.string().trim().min(1).max(80).nullable().optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.string().datetime().nullable().optional(),
  userGroupId: z.string().trim().min(1).max(80).nullable().optional(),
  maxStorageMb: z.number().int().min(0).nullable().optional(),
  maxStorageFiles: z.number().int().min(0).nullable().optional(),
});

async function logAdminAction(request: NextRequest, adminUserId: string, message: string, metadata?: unknown) {
  try {
    const ip = getClientIp(request);
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
  } catch (error) {
    console.error("[api/admin/users/[id]] failed to write audit log:", error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByPolicy("admin.users.read", `admin:users:read:${session.user.id}`, { limit: 120, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const { id } = await params;

  const [user, emailCount, storageAggregate] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        maxStorageMb: true,
        maxStorageFiles: true,
        password: true,
        accounts: { select: { provider: true } },
        userGroupId: true,
        userGroup: { select: { id: true, name: true } },
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
    prisma.email.aggregate({
      where: { mailbox: { userId: id } },
      _sum: { storageBytes: true, storageFiles: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const oauthProviders = uniqueOAuthProviders(user.accounts);
  const hasPassword = Boolean(user.password);

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    maxStorageMb: user.maxStorageMb,
    maxStorageFiles: user.maxStorageFiles,
    userGroupId: user.userGroupId,
    userGroup: user.userGroup,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    _count: { ...user._count, emails: emailCount },
    storageUsage: {
      bytes: Number(storageAggregate._sum.storageBytes || 0),
      files: Number(storageAggregate._sum.storageFiles || 0),
    },
    authSources: computeAuthSources({ hasPassword, oauthProviders }),
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

  const limited = await rateLimitByPolicy("admin.users.update", `admin:users:update:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
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
      userGroupId?: string | null;
      maxStorageMb?: number | null;
      maxStorageFiles?: number | null;
    } = {};

    if (data.email !== undefined) updateData.email = data.email;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.emailVerified !== undefined) {
      updateData.emailVerified = data.emailVerified ? new Date(data.emailVerified) : null;
    }
    if (data.userGroupId !== undefined) {
      if (typeof data.userGroupId === "string") {
        const group = await prisma.userGroup.findUnique({
          where: { id: data.userGroupId },
          select: { id: true },
        });
        if (!group) {
          return NextResponse.json({ error: "User group not found" }, { status: 404 });
        }
      }
      updateData.userGroupId = data.userGroupId;
    }
    if (data.maxStorageMb !== undefined) {
      updateData.maxStorageMb = data.maxStorageMb;
    }
    if (data.maxStorageFiles !== undefined) {
      updateData.maxStorageFiles = data.maxStorageFiles;
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
        maxStorageMb: true,
        maxStorageFiles: true,
        userGroupId: true,
        userGroup: { select: { id: true, name: true } },
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
    console.error("[api/admin/users/[id]] update failed:", error);
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

  const limited = await rateLimitByPolicy("admin.users.delete", `admin:users:delete:${session.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
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
