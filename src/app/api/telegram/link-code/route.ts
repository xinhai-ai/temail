import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTelegramBindCode } from "@/services/telegram/bind-codes";
import { getTelegramBotUsername } from "@/services/telegram/bot-api";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, expiresAt } = await createTelegramBindCode({
    userId: session.user.id,
    purpose: "LINK_USER",
    ttlSeconds: 10 * 60,
  });

  const botUsername = await getTelegramBotUsername();
  const deepLink = botUsername ? `https://t.me/${botUsername}?start=${encodeURIComponent(code)}` : null;

  return NextResponse.json({
    code,
    expiresAt: expiresAt.toISOString(),
    deepLink,
  });
}
