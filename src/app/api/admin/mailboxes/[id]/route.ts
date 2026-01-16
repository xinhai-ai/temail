import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

const updateSchema = z.object({
  note: z.string().nullable().optional(),
  isStarred: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  groupId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const mailbox = await prisma.mailbox.findUnique({
    where: { id },
    include: {
      domain: true,
      group: true,
      user: { select: { id: true, email: true, role: true } },
      emails: { take: 20, orderBy: { receivedAt: "desc" } },
    },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  return NextResponse.json(mailbox);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const data = updateSchema.parse(body);

    const updated = await prisma.mailbox.update({
      where: { id },
      data: {
        note: data.note,
        isStarred: data.isStarred,
        status: data.status,
        groupId: data.groupId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : data.expiresAt === null ? null : undefined,
      },
      include: { domain: true, group: true },
    });

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    await prisma.log.create({
      data: {
        level: "INFO",
        action: "MAILBOX_UPDATE",
        message: `Admin updated mailbox ${id}`,
        metadata: JSON.stringify({ mailboxId: id }),
        ip: ip || null,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
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

  const { id } = await params;

  try {
    await prisma.mailbox.delete({ where: { id } });

    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    await prisma.log.create({
      data: {
        level: "WARN",
        action: "MAILBOX_DELETE",
        message: `Admin deleted mailbox ${id}`,
        metadata: JSON.stringify({ mailboxId: id }),
        ip: ip || null,
        userAgent: userAgent || null,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
