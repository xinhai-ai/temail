import * as PostalMime from "postal-mime";

type Env = {
  TEMAIL_WEBHOOK_URL?: string;
  TEMAIL_WEBHOOK_SECRET?: string;
  TEMAIL_WEBHOOK_SECRETS?: string;
  TEMAIL_WEBHOOK_TIMEOUT_MS?: string;
  TEMAIL_MAX_TEXT_CHARS?: string;
  TEMAIL_MAX_HTML_CHARS?: string;
  TEMAIL_FALLBACK_FORWARD_TO?: string;
};

type EmailMessage = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
  forward: (rcptTo: string) => Promise<void>;
  setReject: (reason: string) => void;
};

type ExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

function toPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truncate(value: string | null | undefined, maxChars: number): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars);
}

function getRecipientDomain(address: string): string | null {
  const at = address.lastIndexOf("@");
  if (at === -1) return null;
  const domain = address.slice(at + 1).trim().toLowerCase();
  return domain ? domain : null;
}

function parseSecretsMap(raw: string | undefined): Record<string, string> | null {
  const value = (raw || "").trim();
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const key = String(k || "").trim().toLowerCase();
      const val = typeof v === "string" ? v.trim() : "";
      if (key && val) out[key] = val;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

function resolveWebhookSecret(env: Env, toAddress: string): string | null {
  const map = parseSecretsMap(env.TEMAIL_WEBHOOK_SECRETS);
  const domain = getRecipientDomain(toAddress);
  if (domain && map?.[domain]) return map[domain];
  const single = (env.TEMAIL_WEBHOOK_SECRET || "").trim();
  return single ? single : null;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    record[key] = value;
  }
  return record;
}

async function postToWebhook(
  webhookUrl: string,
  payload: unknown,
  timeoutMs: number
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "temail-cloudflare-email-worker/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`webhook failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

const worker = {
  async email(message: EmailMessage, env: Env, _ctx: ExecutionContext) {
    const webhookUrl = (env.TEMAIL_WEBHOOK_URL || "").trim();
    if (!webhookUrl) {
      message.setReject("TEMAIL_WEBHOOK_URL is not configured");
      return;
    }

    const secret = resolveWebhookSecret(env, message.to);
    if (!secret) {
      message.setReject("Webhook secret is not configured for this recipient domain");
      return;
    }

    const timeoutMs = toPositiveInt(env.TEMAIL_WEBHOOK_TIMEOUT_MS, 10_000);
    const maxTextChars = toPositiveInt(env.TEMAIL_MAX_TEXT_CHARS, 200_000);
    const maxHtmlChars = toPositiveInt(env.TEMAIL_MAX_HTML_CHARS, 200_000);

    let parsed: { subject?: string; text?: string; html?: string; messageId?: string } | null = null;
    try {
      const parser = new PostalMime.default();
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const result = await parser.parse(rawBuffer);
      parsed = {
        subject: typeof result.subject === "string" ? result.subject : undefined,
        text: typeof result.text === "string" ? result.text : undefined,
        html: typeof result.html === "string" ? result.html : undefined,
        messageId: typeof result.messageId === "string" ? result.messageId : undefined,
      };
    } catch (error) {
      console.warn("[temail-email-forwarder] failed to parse email:", error);
    }

    const subject =
      (parsed?.subject || message.headers.get("subject") || "").trim() || "(No subject)";
    const messageId =
      (parsed?.messageId || message.headers.get("message-id") || "").trim() || undefined;

    const payload = {
      to: message.to,
      from: message.from,
      subject,
      text: truncate(parsed?.text, maxTextChars),
      html: truncate(parsed?.html, maxHtmlChars),
      messageId,
      headers: headersToRecord(message.headers),
      secret,
    };

    const deliver = async () => {
      await postToWebhook(webhookUrl, payload, timeoutMs);
    };

    try {
      await deliver();
    } catch (error) {
      console.error("[temail-email-forwarder] webhook delivery failed:", error);

      const fallbackTo = (env.TEMAIL_FALLBACK_FORWARD_TO || "").trim();
      if (fallbackTo) {
        try {
          await message.forward(fallbackTo);
          return;
        } catch (forwardError) {
          console.error("[temail-email-forwarder] fallback forward failed:", forwardError);
        }
      }

      message.setReject("Webhook delivery failed");
      return;
    }
  },
};

export default worker;
