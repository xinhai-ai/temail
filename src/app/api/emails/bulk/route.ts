import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { readJsonBody } from "@/lib/request";
import { purgeOwnedEmail } from "@/services/email-trash";

const bulkSchema = z.object({
  action: z.enum(["markRead", "delete", "archive", "unarchive", "restore", "purge"]),
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const { action, ids } = bulkSchema.parse(bodyResult.data);

    const owned = await prisma.email.findMany({
      where: {
        id: { in: ids },
        mailbox: { userId: session.user.id },
      },
      select: { id: true, mailboxId: true, status: true, restoreStatus: true },
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
    } else if (action === "delete") {
      const now = new Date();
      const toTrashUnread = owned.filter((e) => e.status === "UNREAD").map((e) => e.id);
      const toTrashRead = owned.filter((e) => e.status !== "UNREAD" && e.status !== "DELETED").map((e) => e.id);

      if (toTrashUnread.length > 0) {
        await prisma.email.updateMany({
          where: { id: { in: toTrashUnread } },
          data: { status: "DELETED", deletedAt: now, restoreStatus: "UNREAD" },
        });
      }

      if (toTrashRead.length > 0) {
        await prisma.email.updateMany({
          where: { id: { in: toTrashRead } },
          data: { status: "DELETED", deletedAt: now, restoreStatus: "READ" },
        });
      }
    } else if (action === "restore") {
      const restoreUnread = owned
        .filter((e) => e.status === "DELETED" && e.restoreStatus === "UNREAD")
        .map((e) => e.id);
      const restoreRead = owned
        .filter((e) => e.status === "DELETED" && e.restoreStatus !== "UNREAD")
        .map((e) => e.id);

      if (restoreUnread.length > 0) {
        await prisma.email.updateMany({
          where: { id: { in: restoreUnread } },
          data: { status: "UNREAD", deletedAt: null, restoreStatus: null },
        });
      }

      if (restoreRead.length > 0) {
        await prisma.email.updateMany({
          where: { id: { in: restoreRead } },
          data: { status: "READ", deletedAt: null, restoreStatus: null },
        });
      }
    } else if (action === "purge") {
      for (const id of ownedIds) {
        await purgeOwnedEmail({ emailId: id, userId: session.user.id });
      }
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
