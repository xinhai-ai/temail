import { getSystemSettingValue } from "@/services/system-settings";

const TELEGRAM_BOT_ENABLED_KEY = "telegram_bot_enabled";

/**
 * Check if the Telegram bot feature is enabled.
 * Defaults to true for backward compatibility.
 */
export async function isTelegramBotEnabled(): Promise<boolean> {
  const value = await getSystemSettingValue(TELEGRAM_BOT_ENABLED_KEY);
  // Default to enabled if not set (backward compatibility)
  if (value === null || value === undefined) {
    return true;
  }
  return value === "true";
}
