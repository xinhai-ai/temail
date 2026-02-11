import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTelegramBindCode } from "@/services/telegram/bind-codes";
import { getTelegramBotUsername } from "@/services/telegram/bot-api";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { isTelegramBotEnabled } from "@/lib/telegram-features";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

export async function POST(request: NextRequest) {
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

  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("telegram.linkCode", `telegram:link-code:${session.user.id}:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
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
