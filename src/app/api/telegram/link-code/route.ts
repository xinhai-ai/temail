import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTelegramBindCode } from "@/services/telegram/bind-codes";
import { getTelegramBotUsername } from "@/services/telegram/bot-api";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`telegram:link-code:${session.user.id}:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
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
