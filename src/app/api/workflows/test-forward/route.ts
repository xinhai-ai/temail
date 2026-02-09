import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import { readJsonBody } from "@/lib/request";
import { isVercelDeployment } from "@/lib/deployment/server";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { rateLimit } from "@/lib/api-rate-limit";
import { getTelegramBotToken } from "@/services/telegram/bot-api";
import { getSystemSettingValue } from "@/services/system-settings";
import { assertUserGroupFeatureEnabled, assertUserGroupWorkflowForwardEmailEnabled, assertUserGroupWorkflowForwardWebhookEnabled } from "@/services/usergroups/policy";
import type {
  ForwardEmailData,
  ForwardTelegramBoundData,
  ForwardTelegramData,
  ForwardDiscordData,
  ForwardSlackData,
  ForwardWebhookData,
  NodeType,
} from "@/lib/workflow/types";

function normalizeWebhookMethod(method: string | undefined): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" {
  const candidate = (method || "").trim().toUpperCase();
  if (candidate === "GET" || candidate === "POST" || candidate === "PUT" || candidate === "PATCH" || candidate === "DELETE") {
    return candidate;
  }
  return "POST";
}

function parseBoolean(value: string | null | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

async function isWorkflowEmailForwardingEnabled(): Promise<boolean> {
  const raw = await getSystemSettingValue("workflow_forward_email_enabled");
  if (raw === null) return true;
  return parseBoolean(raw);
}

interface TestEmailData {
  id: string;
  messageId: string;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  replyTo: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowFeature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "workflow" });
  if (!workflowFeature.ok) {
    return NextResponse.json(
      { error: workflowFeature.error, code: workflowFeature.code, meta: workflowFeature.meta },
      { status: workflowFeature.status }
    );
  }

  const limited = rateLimit(`workflows:test-forward:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const bodyResult = await readJsonBody(req, { maxBytes: 400_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    const body = bodyResult.data;
    const { type, config, email } = body as {
      type: NodeType;
      config: ForwardEmailData | ForwardTelegramBoundData | ForwardTelegramData | ForwardDiscordData | ForwardSlackData | ForwardWebhookData;
      email: TestEmailData;
    };

    if (type === "forward:telegram" || type === "forward:telegram-bound") {
      const telegramFeature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "telegram" });
      if (!telegramFeature.ok) {
        return NextResponse.json(
          { error: telegramFeature.error, code: telegramFeature.code, meta: telegramFeature.meta },
          { status: telegramFeature.status }
        );
      }
    }

    if (isVercelDeployment() && type === "forward:email") {
      return NextResponse.json({ error: "SMTP forwarding is disabled in this deployment" }, { status: 404 });
    }
    if (type === "forward:email") {
      const enabled = await isWorkflowEmailForwardingEnabled();
      if (!enabled) {
        return NextResponse.json({ error: "Email forwarding is disabled by admin" }, { status: 403 });
      }

      const permission = await assertUserGroupWorkflowForwardEmailEnabled({ userId: session.user.id });
      if (!permission.ok) {
        return NextResponse.json(
          { error: permission.error, code: permission.code, meta: permission.meta },
          { status: permission.status }
        );
      }
    }

    if (type === "forward:webhook") {
      const permission = await assertUserGroupWorkflowForwardWebhookEnabled({ userId: session.user.id });
      if (!permission.ok) {
        return NextResponse.json(
          { error: permission.error, code: permission.code, meta: permission.meta },
          { status: permission.status }
        );
      }
    }

    // Build template variables
    const vars: Record<string, unknown> = {
      email: {
        id: email.id,
        messageId: email.messageId,
        fromAddress: email.fromAddress,
        fromName: email.fromName,
        toAddress: email.toAddress,
        replyTo: email.replyTo,
        subject: email.subject,
        textBody: email.textBody,
        htmlBody: email.htmlBody,
        previewUrl: "https://example.com/p/test",
        receivedAt: email.receivedAt,
      },
      mailbox: {
        id: "test-mailbox",
        address: email.toAddress,
      },
      variables: {},
    };

    let result: { success: boolean; message: string; details?: string };

    switch (type) {
      case "forward:email":
        result = await testEmailForward(config as ForwardEmailData);
        break;
      case "forward:telegram-bound":
        result = await testTelegramBoundForward(session.user.id, config as ForwardTelegramBoundData, email, vars);
        break;
      case "forward:telegram":
        result = await testTelegramForward(config as ForwardTelegramData, email, vars);
        break;
      case "forward:discord":
        result = await testDiscordForward(config as ForwardDiscordData, email, vars);
        break;
      case "forward:slack":
        result = await testSlackForward(config as ForwardSlackData, email, vars);
        break;
      case "forward:webhook":
        result = await testWebhookForward(config as ForwardWebhookData, vars);
        break;
      default:
        return NextResponse.json({ error: "Unknown forward type" }, { status: 400 });
    }

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: result.message, details: result.details }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

async function testEmailForward(
  config: ForwardEmailData
): Promise<{ success: boolean; message: string; details?: string }> {
  // For email, we just validate the config since we can't send without SMTP
  if (!config.to) {
    return { success: false, message: "Recipient email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.to)) {
    return { success: false, message: "Invalid recipient email format" };
  }

  return {
    success: true,
    message: "Email configuration validated",
    details: `Would send to: ${config.to}`,
  };
}

async function testTelegramForward(
  config: ForwardTelegramData,
  email: TestEmailData,
  vars: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: string }> {
  let token: string;
  if (config.useAppBot) {
    try {
      token = await getTelegramBotToken();
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "App bot token is not configured" };
    }
  } else {
    token = (config.token || "").trim();
    if (!token) {
      return { success: false, message: "Bot token is required" };
    }
  }
  if (!config.chatId) {
    return { success: false, message: "Chat ID is required" };
  }

  const template = config.template || `📧 *Test Email*\n\n*Subject:* ${email.subject}`;
  const text = replaceTemplateVariables(template, vars);
  const requestBody: Record<string, unknown> = {
    chat_id: config.chatId,
    text: `[TEST] ${text}`,
  };
  if (!config.parseMode) {
    requestBody.parse_mode = "Markdown";
  } else if (config.parseMode !== "None") {
    requestBody.parse_mode = config.parseMode;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: "Test message sent to Telegram",
        details: `Message ID: ${data.result?.message_id}`,
      };
    } else {
      return {
        success: false,
        message: data.description || "Telegram API error",
        details: `Error code: ${data.error_code}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Telegram",
    };
  }
}

async function testTelegramBoundForward(
  userId: string,
  config: ForwardTelegramBoundData,
  email: TestEmailData,
  vars: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: string }> {
  const binding = await prisma.telegramChatBinding.findFirst({
    where: { userId, enabled: true, mode: "MANAGE" },
    select: { chatId: true, threadId: true, chatTitle: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!binding) {
    return { success: false, message: "No bound Telegram group. Bind a forum group first." };
  }

  const token = await getTelegramBotToken();

  const defaultTemplate = `📧 Test Email\nFrom: {{email.fromAddress}}\nTo: {{email.toAddress}}\nSubject: {{email.subject}}\nTime: {{email.receivedAt}}`;
  const template = (config.template || "").trim() ? String(config.template) : defaultTemplate;
  const text = replaceTemplateVariables(template, vars);

  const messageThreadId = binding.threadId ? Number.parseInt(binding.threadId, 10) : null;
  const requestBody: Record<string, unknown> = {
    chat_id: binding.chatId,
    text: `[TEST] ${text}`,
    ...(Number.isFinite(messageThreadId) && (messageThreadId as number) > 0 ? { message_thread_id: messageThreadId } : {}),
  };
  const parseMode = config.parseMode || "None";
  if (parseMode !== "None") {
    requestBody.parse_mode = parseMode;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json().catch(() => null) as { ok?: boolean; result?: { message_id?: number }; description?: string; error_code?: number } | null;

    if (response.ok && data?.ok) {
      return {
        success: true,
        message: "Test message sent to bound Telegram group",
        details: `Group: ${binding.chatTitle || binding.chatId} • message_id=${String(data.result?.message_id ?? "")}`,
      };
    }

    return {
      success: false,
      message: data?.description || "Telegram API error",
      details: data?.error_code ? `Error code: ${String(data.error_code)}` : undefined,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Telegram",
    };
  }
}

async function testDiscordForward(
  config: ForwardDiscordData,
  email: TestEmailData,
  vars: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: string }> {
  if (!config.webhookUrl) {
    return { success: false, message: "Webhook URL is required" };
  }

  if (!config.webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
    return { success: false, message: "Invalid Discord webhook URL format" };
  }

  const validated = await validateEgressUrl(config.webhookUrl);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const template = config.template || `📧 **Test Email**: ${email.subject}`;
  let body: Record<string, unknown>;

  if (config.useEmbed && config.template) {
    try {
      body = JSON.parse(replaceTemplateVariables(config.template, vars));
    } catch {
      body = { content: `[TEST] ${replaceTemplateVariables(template, vars)}` };
    }
  } else {
    body = { content: `[TEST] ${replaceTemplateVariables(template, vars)}` };
  }

  try {
    const response = await fetch(validated.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    if (response.ok || response.status === 204) {
      return {
        success: true,
        message: "Test message sent to Discord",
      };
    } else {
      const text = await response.text();
      return {
        success: false,
        message: "Discord webhook error",
        details: text.slice(0, 200),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Discord",
    };
  }
}

async function testSlackForward(
  config: ForwardSlackData,
  email: TestEmailData,
  vars: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: string }> {
  if (!config.webhookUrl) {
    return { success: false, message: "Webhook URL is required" };
  }

  if (!config.webhookUrl.startsWith("https://hooks.slack.com/")) {
    return { success: false, message: "Invalid Slack webhook URL format" };
  }

  const validated = await validateEgressUrl(config.webhookUrl);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const template = config.template || `📧 *Test Email*: ${email.subject}`;
  let body: Record<string, unknown>;

  if (config.useBlocks && config.template) {
    try {
      body = JSON.parse(replaceTemplateVariables(config.template, vars));
    } catch {
      body = { text: `[TEST] ${replaceTemplateVariables(template, vars)}` };
    }
  } else {
    body = { text: `[TEST] ${replaceTemplateVariables(template, vars)}` };
  }

  try {
    const response = await fetch(validated.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return {
        success: true,
        message: "Test message sent to Slack",
      };
    } else {
      const text = await response.text();
      return {
        success: false,
        message: "Slack webhook error",
        details: text.slice(0, 200),
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to Slack",
    };
  }
}

async function testWebhookForward(
  config: ForwardWebhookData,
  vars: Record<string, unknown>
): Promise<{ success: boolean; message: string; details?: string }> {
  if (!config.url) {
    return { success: false, message: "Webhook URL is required" };
  }

  const validated = await validateEgressUrl(config.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const method = normalizeWebhookMethod(config.method);
  const contentType = config.contentType || "application/json";
  const body = config.bodyTemplate
    ? replaceTemplateVariables(config.bodyTemplate, vars)
    : JSON.stringify({ test: true, timestamp: new Date().toISOString() });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    ...(config.headers || {}),
  };

  try {
    const response = await fetch(validated.url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    });

    return {
      success: response.ok,
      message: response.ok ? "Webhook test successful" : "Webhook returned error",
      details: `Status: ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to connect to webhook",
    };
  }
}
