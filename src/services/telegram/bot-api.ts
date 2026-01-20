import crypto from "node:crypto";
import { getSystemSettingValue } from "@/services/system-settings";

type TelegramApiOk<T> = {
  ok: true;
  result: T;
};

type TelegramApiError = {
  ok: false;
  error_code: number;
  description: string;
  parameters?: { retry_after?: number };
};

type TelegramApiResponse<T> = TelegramApiOk<T> | TelegramApiError;

export type TelegramParseMode = "Markdown" | "MarkdownV2" | "HTML";

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

export async function telegramAnswerCallbackQuery(params: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<void> {
  const token = await getTelegramBotToken();
  const payload: Record<string, unknown> = {
    callback_query_id: params.callbackQueryId,
    ...(params.text ? { text: params.text } : {}),
    ...(typeof params.showAlert === "boolean" ? { show_alert: params.showAlert } : {}),
  };

  const result = await telegramApiRequest<boolean>(token, "answerCallbackQuery", payload);
  if (result.ok) return;
  const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
  throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
}

export async function telegramEditMessageText(params: {
  chatId: string;
  messageId: number;
  text: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}): Promise<void> {
  const token = await getTelegramBotToken();
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    message_id: params.messageId,
    text: params.text,
    ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    ...(typeof params.disableWebPagePreview === "boolean" ? { disable_web_page_preview: params.disableWebPagePreview } : {}),
  };

  const result = await telegramApiRequest<boolean>(token, "editMessageText", payload);
  if (result.ok) return;
  const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
  throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
}

export async function getTelegramBotToken(): Promise<string> {
  const token = ((await getSystemSettingValue("telegram_bot_token")) || "").trim();
  if (!token) {
    throw new Error("telegram_bot_token is not configured");
  }
  return token;
}

export async function getTelegramWebhookSecretToken(): Promise<string | null> {
  const value = ((await getSystemSettingValue("telegram_webhook_secret")) || "").trim();
  return value ? value : null;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function verifyTelegramWebhookSecret(
  provided: string | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const expected = ((await getSystemSettingValue("telegram_webhook_secret")) || "").trim();
  if (expected) {
    if (typeof provided !== "string" || !safeEqual(provided, expected)) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, error: "telegram_webhook_secret is not configured" };
  }

  return { ok: true };
}

export async function getTelegramBotUsername(): Promise<string | null> {
  const value = ((await getSystemSettingValue("telegram_bot_username")) || "").trim();
  return value ? value : null;
}

export async function getTelegramForumGeneralTopicName(): Promise<string> {
  const configured = ((await getSystemSettingValue("telegram_forum_general_topic_name")) || "").trim();
  return configured || "TEmail · General";
}

export type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

async function telegramApiRequest<T>(
  token: string,
  method: string,
  payload: unknown
): Promise<TelegramApiOk<T> | TelegramApiError> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => null)) as TelegramApiResponse<T> | null;
  if (!data || typeof data !== "object") {
    return { ok: false, error_code: res.status || 500, description: "Invalid Telegram API response" };
  }
  return data.ok ? (data as TelegramApiOk<T>) : (data as TelegramApiError);
}

export async function telegramSendMessage(params: {
  chatId: string;
  text: string;
  parseMode?: TelegramParseMode;
  messageThreadId?: number;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}): Promise<void> {
  const token = await getTelegramBotToken();
  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    text: params.text,
    ...(params.parseMode ? { parse_mode: params.parseMode } : {}),
    ...(typeof params.messageThreadId === "number" ? { message_thread_id: params.messageThreadId } : {}),
    ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    ...(typeof params.disableWebPagePreview === "boolean" ? { disable_web_page_preview: params.disableWebPagePreview } : {}),
  };

  const result = await telegramApiRequest<{ message_id: number }>(token, "sendMessage", payload);
  if (result.ok) return;
  const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
  throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
}

export async function telegramCreateForumTopic(params: { token?: string; chatId: string; name: string }): Promise<{
  messageThreadId: number;
  name: string;
}> {
  const token = (params.token || (await getTelegramBotToken())).trim();
  if (!token) throw new Error("Telegram bot token is required");

  const payload: Record<string, unknown> = {
    chat_id: params.chatId,
    name: params.name,
  };

  const result = await telegramApiRequest<{ message_thread_id: number; name: string }>(token, "createForumTopic", payload);
  if (!result.ok) {
    const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
    throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
  }

  const messageThreadId = result.result.message_thread_id;
  if (!Number.isFinite(messageThreadId) || messageThreadId <= 0) {
    throw new Error("Telegram API error: invalid message_thread_id");
  }

  return { messageThreadId, name: result.result.name };
}

export async function telegramGetWebhookInfo(): Promise<TelegramWebhookInfo> {
  const token = await getTelegramBotToken();
  const result = await telegramApiRequest<TelegramWebhookInfo>(token, "getWebhookInfo", {});
  if (result.ok) return result.result;
  const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
  throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
}

export async function telegramSetWebhook(params: {
  url: string;
  dropPendingUpdates?: boolean;
  secretToken?: string | null;
}): Promise<TelegramWebhookInfo> {
  const token = await getTelegramBotToken();
  const payload: Record<string, unknown> = {
    url: params.url,
    ...(typeof params.dropPendingUpdates === "boolean" ? { drop_pending_updates: params.dropPendingUpdates } : {}),
    ...(params.secretToken ? { secret_token: params.secretToken } : {}),
  };

  const result = await telegramApiRequest<boolean>(token, "setWebhook", payload);
  if (!result.ok) {
    const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
    throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
  }

  return telegramGetWebhookInfo();
}

export async function telegramDeleteWebhook(params?: { dropPendingUpdates?: boolean }): Promise<TelegramWebhookInfo> {
  const token = await getTelegramBotToken();
  const payload: Record<string, unknown> = {
    ...(typeof params?.dropPendingUpdates === "boolean" ? { drop_pending_updates: params.dropPendingUpdates } : {}),
  };

  const result = await telegramApiRequest<boolean>(token, "deleteWebhook", payload);
  if (!result.ok) {
    const retry = typeof result.parameters?.retry_after === "number" ? ` (retry_after=${result.parameters.retry_after})` : "";
    throw new Error(`Telegram API error (HTTP ${result.error_code}): ${result.description}${retry}`);
  }

  return telegramGetWebhookInfo();
}
