/**
 * Telegram webhook helper
 *
 * Usage:
 *   # Uses admin-configured bot token stored in system settings.
 *   # Default URL is `site_url` system setting + `/api/telegram/webhook`.
 *   npx tsx scripts/telegram-set-webhook.ts
 *
 *   # Or pass the full webhook URL explicitly (HTTPS required):
 *   npx tsx scripts/telegram-set-webhook.ts https://example.com/api/telegram/webhook
 *
 *   # Delete webhook (keeps token/settings unchanged):
 *   npx tsx scripts/telegram-set-webhook.ts --delete
 */

import { getSystemSettingValue } from "@/services/system-settings";
import { getTelegramWebhookSecretToken, telegramDeleteWebhook, telegramSetWebhook } from "@/services/telegram/bot-api";

async function main() {
  const args = process.argv.slice(2);
  const wantsDelete = args.includes("--delete");
  const explicitUrl = args.find((a) => a.startsWith("http://") || a.startsWith("https://"));

  if (wantsDelete) {
    const info = await telegramDeleteWebhook({ dropPendingUpdates: true });
    console.log("deleteWebhook: ok");
    console.log("getWebhookInfo:", info);
    return;
  }

  const derivedUrl = await (async () => {
    const base = await getSystemSettingValue("site_url");
    const trimmed = String(base || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    return `${trimmed}/api/telegram/webhook`;
  })();

  const url = explicitUrl || derivedUrl;

  if (!url) {
    throw new Error("Webhook URL is required. Set system setting `site_url` or pass a full URL as an argument.");
  }
  if (!url.startsWith("https://")) {
    throw new Error("Telegram webhook URL must start with https://");
  }

  const secretToken = await getTelegramWebhookSecretToken();
  const info = await telegramSetWebhook({ url, dropPendingUpdates: true, secretToken });
  console.log("setWebhook: ok");
  console.log("getWebhookInfo:", info);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
