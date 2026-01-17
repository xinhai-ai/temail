import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";

const bulkSchema = z.object({
  action: z.enum(["markRead", "delete", "archive", "unarchive"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, ids } = bulkSchema.parse(body);

    const owned = await prisma.email.findMany({
      where: {
        id: { in: ids },
        mailbox: { userId: session.user.id },
      },
      select: { id: true, mailboxId: true },
    });

    const ownedIds = owned.map((e) => e.id);
    if (ownedIds.length === 0) {
      return NextResponse.json({ success: true, count: 0, ids: [] });
    }

    if (action === "markRead") {
      await prisma.email.updateMany({
        where: { id: { in: ownedIds } },
        data: { status: "READ" },
      });
    } else if (action === "archive") {
      await prisma.email.updateMany({
        where: { id: { in: ownedIds } },
        data: { status: "ARCHIVED" },
      });
    } else if (action === "unarchive") {
      await prisma.email.updateMany({
        where: { id: { in: ownedIds } },
        data: { status: "READ" },
      });
    } else {
      await prisma.email.deleteMany({
        where: { id: { in: ownedIds } },
      });
    }

    const mailboxIds = Array.from(new Set(owned.map((e) => e.mailboxId)));
    publishRealtimeEvent(session.user.id, {
      type: "emails.bulk_updated",
      data: {
        action,
        ids: ownedIds,
        ...(mailboxIds.length === 1 ? { mailboxId: mailboxIds[0] } : {}),
      },
    });

    return NextResponse.json({ success: true, count: ownedIds.length, ids: ownedIds });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

