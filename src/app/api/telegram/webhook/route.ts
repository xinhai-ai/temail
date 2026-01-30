import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { verifyTelegramWebhookSecret } from "@/services/telegram/bot-api";
import { handleTelegramUpdate } from "@/services/telegram/handlers";
import type { TelegramUpdate } from "@/services/telegram/types";
import { Prisma } from "@prisma/client";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { getSystemSettingValue } from "@/services/system-settings";
import { getAdminSession } from "@/lib/rbac";

function extractUpdateId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { update_id?: unknown }).update_id;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isMissingTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("no such table: telegram_update_logs") || message.includes("relation \"telegram_update_logs\" does not exist");
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = ((await getSystemSettingValue("telegram_webhook_secret")) || "").trim();
  return NextResponse.json({
    status: "ok",
    webhookSecretConfigured: Boolean(configured),
  });
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`telegram:webhook:${ip}`, { limit: 3_000, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const secretCheck = await verifyTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"));
  if (!secretCheck.ok) {
    return NextResponse.json({ error: secretCheck.error }, { status: secretCheck.status });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 200_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const update = bodyResult.data as TelegramUpdate;
  const updateId = extractUpdateId(update);
  if (updateId === null) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Idempotency: Telegram may retry webhook calls.
  try {
    await prisma.telegramUpdateLog.create({
      data: { updateId },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({ error: "Telegram integration tables are not migrated" }, { status: 503 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Already handled.
      return NextResponse.json({ ok: true });
    }
    console.error("[api/telegram/webhook] idempotency error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error("[api/telegram/webhook] handler error:", error);
    // Still ACK to prevent retries storms; errors are logged for inspection.
  }

  return NextResponse.json({ ok: true });
}
