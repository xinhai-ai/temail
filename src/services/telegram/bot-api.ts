import crypto from "node:crypto";

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

export function getTelegramBotToken(): string {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  return token;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyTelegramWebhookSecret(provided: string | null): { ok: true } | { ok: false; status: number; error: string } {
  const expected = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (expected) {
    if (typeof provided !== "string" || !safeEqual(provided, expected)) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    return { ok: true };
  }

  if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 503, error: "TELEGRAM_WEBHOOK_SECRET is not configured" };
  }

  return { ok: true };
}

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
  const token = getTelegramBotToken();
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

