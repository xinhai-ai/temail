import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import type {
  ForwardEmailData,
  ForwardTelegramData,
  ForwardDiscordData,
  ForwardSlackData,
  ForwardWebhookData,
  NodeType,
} from "@/lib/workflow/types";

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

  try {
    const body = await req.json();
    const { type, config, email } = body as {
      type: NodeType;
      config: ForwardEmailData | ForwardTelegramData | ForwardDiscordData | ForwardSlackData | ForwardWebhookData;
      email: TestEmailData;
    };

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
        result = await testEmailForward(config as ForwardEmailData, vars);
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
  config: ForwardEmailData,
  vars: Record<string, unknown>
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
  if (!config.token) {
    return { success: false, message: "Bot token is required" };
  }
  if (!config.chatId) {
    return { success: false, message: "Chat ID is required" };
  }

  const template = config.template || `📧 *Test Email*\n\n*Subject:* ${email.subject}`;
  const text = replaceTemplateVariables(template, vars);
  const parseMode = config.parseMode || "Markdown";

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: `[TEST] ${text}`,
          parse_mode: parseMode,
        }),
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
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  try {
    new URL(config.url);
  } catch {
    return { success: false, message: "Invalid webhook URL format" };
  }

  const method = config.method || "POST";
  const contentType = config.contentType || "application/json";
  const body = config.bodyTemplate
    ? replaceTemplateVariables(config.bodyTemplate, vars)
    : JSON.stringify({ test: true, timestamp: new Date().toISOString() });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    ...(config.headers || {}),
  };

  try {
    const response = await fetch(config.url, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
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
