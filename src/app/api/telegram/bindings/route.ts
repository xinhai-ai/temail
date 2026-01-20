import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [link, forumBindings, mailboxTopics] = await Promise.all([
    prisma.telegramUserLink.findFirst({
      where: { userId: session.user.id, revokedAt: null },
      orderBy: { updatedAt: "desc" },
      select: {
        telegramUserId: true,
        telegramUsername: true,
        privateChatId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.telegramChatBinding.findMany({
      where: { userId: session.user.id, mode: "MANAGE" },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.telegramChatBinding.findMany({
      where: { userId: session.user.id, mode: "NOTIFY", mailboxId: { not: null } },
      include: { mailbox: { select: { id: true, address: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ link, forumBindings, mailboxTopics });
}
