import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import type { Prisma } from "@prisma/client";

const updateSchema = z.object({
  note: z.string().nullable().optional(),
  isStarred: z.boolean().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  groupId: z.string().trim().min(1).nullable().optional(),
  archived: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const mailbox = await prisma.mailbox.findFirst({
    where: { id, userId: session.user.id },
    include: {
      domain: true,
      group: true,
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
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = updateSchema.parse(bodyResult.data);

    if (typeof data.groupId === "string") {
      const group = await prisma.mailboxGroup.findFirst({
        where: { id: data.groupId, userId: session.user.id },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
    }

    const updateData: Prisma.MailboxUncheckedUpdateManyInput = {};
    if (data.note !== undefined) updateData.note = data.note;
    if (data.isStarred !== undefined) updateData.isStarred = data.isStarred;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.groupId !== undefined) updateData.groupId = data.groupId;
    if (typeof data.archived === "boolean") {
      updateData.archivedAt = data.archived ? new Date() : null;
    }

    if (Object.keys(updateData).length === 0) {
      const existing = await prisma.mailbox.findFirst({
        where: { id, userId: session.user.id },
        include: { domain: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
      }
      return NextResponse.json(existing);
    }

    const updateResult = await prisma.mailbox.updateMany({
      where: { id, userId: session.user.id },
      data: updateData,
    });

    if (updateResult.count === 0) {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const updated = await prisma.mailbox.findUnique({
      where: { id },
      include: { domain: true },
    });

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

  const { id } = await params;

  const result = await prisma.mailbox.deleteMany({
    where: { id, userId: session.user.id },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
