import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["UNREAD", "READ", "ARCHIVED", "DELETED"]).optional(),
  isStarred: z.boolean().optional(),
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

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    include: {
      mailbox: true,
      attachments: true,
      headers: true,
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  if (email.status === "UNREAD") {
    const updated = await prisma.email.update({
      where: { id },
      data: { status: "READ" },
      include: {
        mailbox: true,
        attachments: true,
        headers: true,
      },
    });

    publishRealtimeEvent(session.user.id, {
      type: "email.updated",
      data: { id, mailboxId: updated.mailboxId, status: "READ" },
    });

    return NextResponse.json(updated);
  }

  return NextResponse.json(email);
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

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    const email = await prisma.email.findFirst({
      where: { id, mailbox: { userId: session.user.id } },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const updated = await prisma.email.update({
      where: { id },
      data,
    });

    publishRealtimeEvent(session.user.id, {
      type: "email.updated",
      data: {
        id: updated.id,
        mailboxId: updated.mailboxId,
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.isStarred === "boolean" ? { isStarred: data.isStarred } : {}),
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

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  await prisma.email.delete({ where: { id } });

  publishRealtimeEvent(session.user.id, {
    type: "email.deleted",
    data: { id, mailboxId: email.mailboxId },
  });

  return NextResponse.json({ success: true });
}
