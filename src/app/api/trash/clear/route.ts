import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { purgeOwnedEmail } from "@/services/email-trash";

const PURGE_BATCH_SIZE = 20;

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedEmails = await prisma.email.findMany({
      where: {
        status: "DELETED",
        mailbox: { userId: session.user.id },
      },
      select: { id: true },
      orderBy: [{ deletedAt: "asc" }, { id: "asc" }],
    });

    if (deletedEmails.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    let purgedCount = 0;
    for (let i = 0; i < deletedEmails.length; i += PURGE_BATCH_SIZE) {
      const batch = deletedEmails.slice(i, i + PURGE_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((email) =>
          purgeOwnedEmail({ emailId: email.id, userId: session.user.id })
        )
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          purgedCount += 1;
        }
      }
    }

    return NextResponse.json({ success: true, count: purgedCount });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
