/**
 * Telegram webhook helper
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... BASE_URL=https://xxx.trycloudflare.com \
 *     npx tsx scripts/telegram-set-webhook.ts
 *
 *   # Or pass the full webhook URL explicitly:
 *   npx tsx scripts/telegram-set-webhook.ts https://example.com/api/telegram/webhook
 *
 *   # Delete webhook:
 *   npx tsx scripts/telegram-set-webhook.ts --delete
 */

type TelegramApiOk<T> = { ok: true; result: T };
type TelegramApiError = { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } };
type TelegramApiResponse<T> = TelegramApiOk<T> | TelegramApiError;

function getRequiredEnv(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getPublicBaseUrl(): string | null {
  const raw = (process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

async function callTelegramApi<T>(token: string, method: string, payload: unknown): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!data || typeof data !== "object") {
    throw new Error(`Invalid Telegram API response (HTTP ${res.status})`);
  }
  if (!data.ok) {
    const retry = typeof data.parameters?.retry_after === "number" ? ` (retry_after=${data.parameters.retry_after})` : "";
    throw new Error(`Telegram API error (HTTP ${data.error_code}): ${data.description}${retry}`);
  }
  return data.result;
}

async function main() {
  const token = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();

  const args = process.argv.slice(2);
  const wantsDelete = args.includes("--delete");
  const explicitUrl = args.find((a) => a.startsWith("http://") || a.startsWith("https://"));

  if (wantsDelete) {
    const result = await callTelegramApi(token, "deleteWebhook", { drop_pending_updates: true });
    console.log("deleteWebhook:", result);
    return;
  }

  const url = explicitUrl || (() => {
    const base = getPublicBaseUrl();
    if (!base) return "";
    return `${base}/api/telegram/webhook`;
  })();

  if (!url) {
    throw new Error("Webhook URL is required. Provide BASE_URL or pass a full URL as an argument.");
  }

  const payload: Record<string, unknown> = {
    url,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
    drop_pending_updates: true,
  };
  if (secret) payload.secret_token = secret;

  const result = await callTelegramApi(token, "setWebhook", payload);
  console.log("setWebhook:", result);

  const info = await callTelegramApi(token, "getWebhookInfo", {});
  console.log("getWebhookInfo:", info);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

