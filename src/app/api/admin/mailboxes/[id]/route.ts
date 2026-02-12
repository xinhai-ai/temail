import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { readJsonBody } from "@/lib/request";

const overrideDaysSchema = z
  .number()
  .int()
  .min(-1)
  .max(3650)
  .nullable()
  .optional()
  .refine((value) => value === undefined || value === null || value === -1 || value > 0, {
    message: "Override days must be null (inherit), -1 (never), or a positive integer",
  });

const updateSchema = z.object({
  note: z.string().nullable().optional(),
  isStarred: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  groupId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  expireMailboxDaysOverride: overrideDaysSchema,
  expireMailboxActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
  expireEmailDaysOverride: overrideDaysSchema,
  expireEmailActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
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

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    const updated = await prisma.mailbox.update({
      where: { id },
      data: {
        note: data.note,
        isStarred: data.isStarred,
        status: data.status,
        groupId: data.groupId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : data.expiresAt === null ? null : undefined,
        expireMailboxDaysOverride:
          data.expireMailboxDaysOverride === undefined ? undefined : data.expireMailboxDaysOverride,
        expireMailboxActionOverride:
          data.expireMailboxActionOverride === undefined ? undefined : data.expireMailboxActionOverride,
        expireEmailDaysOverride:
          data.expireEmailDaysOverride === undefined ? undefined : data.expireEmailDaysOverride,
        expireEmailActionOverride:
          data.expireEmailActionOverride === undefined ? undefined : data.expireEmailActionOverride,
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
