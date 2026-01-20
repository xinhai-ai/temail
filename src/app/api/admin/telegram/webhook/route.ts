import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/rbac";
import { readJsonBody } from "@/lib/request";
import { getTelegramWebhookSecretToken, telegramDeleteWebhook, telegramGetWebhookInfo, telegramSetWebhook } from "@/services/telegram/bot-api";

const setSchema = z
  .object({
    baseUrl: z.string().trim().min(1).optional(),
    url: z.string().trim().min(1).optional(),
    dropPendingUpdates: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.baseUrl || v.url), { message: "baseUrl or url is required" });

function buildWebhookUrl(input: { baseUrl?: string; url?: string }) {
  if (input.url) return input.url.trim();
  const base = (input.baseUrl || "").trim().replace(/\/+$/, "");
  return `${base}/api/telegram/webhook`;
}

function isHttpsUrl(url: string) {
  return url.startsWith("https://");
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const webhookInfo = await telegramGetWebhookInfo();
    return NextResponse.json({ webhookInfo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = setSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }

  const url = buildWebhookUrl(parsed.data);
  if (!isHttpsUrl(url)) {
    return NextResponse.json({ error: "Telegram webhook URL must start with https://" }, { status: 400 });
  }

  const secretToken = await getTelegramWebhookSecretToken();
  if (!secretToken && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "telegram_webhook_secret is not configured" }, { status: 400 });
  }

  try {
    const webhookInfo = await telegramSetWebhook({
      url,
      dropPendingUpdates: parsed.data.dropPendingUpdates,
      secretToken,
    });
    return NextResponse.json({ webhookInfo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dropPendingUpdates = request.nextUrl.searchParams.get("dropPendingUpdates") === "1";

  try {
    const webhookInfo = await telegramDeleteWebhook({ dropPendingUpdates });
    return NextResponse.json({ webhookInfo });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

