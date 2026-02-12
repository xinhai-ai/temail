import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";

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

const patchSchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
  isStarred: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  groupId: z.string().trim().min(1).nullable().optional(),
  expireMailboxDaysOverride: overrideDaysSchema,
  expireMailboxActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
  expireEmailDaysOverride: overrideDaysSchema,
  expireEmailActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const mailbox = await prisma.mailbox.findFirst({
    where: { id, userId: authResult.apiKey.userId },
    select: {
      id: true,
      address: true,
      prefix: true,
      status: true,
      note: true,
      isStarred: true,
      expiresAt: true,
      lastEmailReceivedAt: true,
      expireMailboxDaysOverride: true,
      expireMailboxActionOverride: true,
      expireEmailDaysOverride: true,
      expireEmailActionOverride: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
      domain: { select: { id: true, name: true } },
      _count: { select: { emails: { where: { status: "UNREAD" } } } },
    },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const { _count, ...rest } = mailbox;
  return NextResponse.json({ mailbox: { ...rest, unreadCount: _count.emails } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);

    if (typeof data.groupId === "string") {
      const group = await prisma.mailboxGroup.findFirst({
        where: { id: data.groupId, userId: authResult.apiKey.userId },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    const updateResult = await prisma.mailbox.updateMany({
      where: { id, userId: authResult.apiKey.userId },
      data,
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const updated = await prisma.mailbox.findUnique({
      where: { id },
      select: {
        id: true,
        address: true,
        prefix: true,
        status: true,
        note: true,
        isStarred: true,
        expiresAt: true,
        lastEmailReceivedAt: true,
        expireMailboxDaysOverride: true,
        expireMailboxActionOverride: true,
        expireEmailDaysOverride: true,
        expireEmailActionOverride: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
        domain: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ mailbox: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/mailboxes] update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const result = await prisma.mailbox.deleteMany({
    where: { id, userId: authResult.apiKey.userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
