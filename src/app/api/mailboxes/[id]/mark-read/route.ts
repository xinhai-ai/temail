import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";

export async function POST(
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
    select: { id: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const updated = await prisma.email.updateMany({
    where: {
      mailboxId: id,
      mailbox: { userId: session.user.id },
      status: "UNREAD",
    },
    data: { status: "READ" },
  });

  publishRealtimeEvent(session.user.id, {
    type: "mailbox.mark_read",
    data: { mailboxId: id, count: updated.count },
  });

  return NextResponse.json({ success: true, mailboxId: id, count: updated.count });
}

