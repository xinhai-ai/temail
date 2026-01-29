import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTelegramBotEnabled } from "@/lib/telegram-features";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isTelegramBotEnabled())) {
    return NextResponse.json({ error: "Telegram bot is disabled", disabled: true }, { status: 403 });
  }

  const feature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "telegram" });
  if (!feature.ok) {
    return NextResponse.json(
      { error: feature.error, code: feature.code, meta: feature.meta, disabled: true },
      { status: feature.status }
    );
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
