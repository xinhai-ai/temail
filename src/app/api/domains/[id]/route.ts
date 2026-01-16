import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().optional(),
  sourceType: z.enum(["IMAP", "WEBHOOK"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ERROR"]).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id },
    include: {
      imapConfig: {
        select: {
          host: true,
          port: true,
          secure: true,
          username: true,
          syncInterval: true,
          lastSync: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      webhookConfig: true,
      mailboxes: { take: 10 },
    },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json(domain);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const domain = await prisma.domain.updateMany({
      where: { id },
      data,
    });

    if (domain.count === 0) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const updated = await prisma.domain.findUnique({ where: { id } });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const result = await prisma.domain.deleteMany({
    where: { id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
