import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rule = await prisma.forwardRule.findUnique({
    where: { id },
  });

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  try {
    const config = JSON.parse(rule.config);
    const testMessage = {
      subject: "Test Forward - TEmail (Admin)",
      from: "test@temail.local",
      to: "test@temail.local",
      text: "This is a test message from TEmail forward system (admin).",
      timestamp: new Date().toISOString(),
    };

    let result;

    switch (rule.type) {
      case "TELEGRAM":
        result = await sendTelegram(config, testMessage);
        break;
      case "DISCORD":
        result = await sendDiscord(config, testMessage);
        break;
      case "SLACK":
        result = await sendSlack(config, testMessage);
        break;
      case "WEBHOOK":
        result = await sendWebhook(config, testMessage);
        break;
      case "EMAIL":
        result = { success: true, message: "Email forward test skipped" };
        break;
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    await prisma.forwardLog.create({
      data: {
        ruleId: id,
        success: result.success,
        message: result.message,
      },
    });

    if (result.success) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: result.message }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test failed" },
      { status: 500 }
    );
  }
}

interface TestMessage {
  subject: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
}

async function sendTelegram(
  config: { token: string; chatId: string },
  message: TestMessage
) {
  const text = `📧 *Test Email*\\n\\n*From:* ${message.from}\\n*To:* ${message.to}\\n*Subject:* ${message.subject}\\n\\n${message.text}`;

  const res = await fetch(
    `https://api.telegram.org/bot${config.token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        parse_mode: "Markdown",
      }),
    }
  );

  if (res.ok) {
    return { success: true, message: "Telegram message sent" };
  }
  const data = await res.json();
  return { success: false, message: data.description || "Telegram failed" };
}

async function sendDiscord(config: { url: string }, message: TestMessage) {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `📧 ${message.subject}`,
          description: message.text,
          color: 0xf59e0b,
          fields: [
            { name: "From", value: message.from, inline: true },
            { name: "To", value: message.to, inline: true },
          ],
          timestamp: message.timestamp,
        },
      ],
    }),
  });

  return res.ok
    ? { success: true, message: "Discord message sent" }
    : { success: false, message: "Discord webhook failed" };
}

async function sendSlack(config: { url: string }, message: TestMessage) {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📧 ${message.subject}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*From:*\\n${message.from}` },
            { type: "mrkdwn", text: `*To:*\\n${message.to}` },
          ],
        },
        {
          type: "section",
          text: { type: "plain_text", text: message.text },
        },
      ],
    }),
  });

  return res.ok
    ? { success: true, message: "Slack message sent" }
    : { success: false, message: "Slack webhook failed" };
}

async function sendWebhook(
  config: { url: string; headers?: Record<string, string> },
  message: TestMessage
) {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify(message),
  });

  return res.ok
    ? { success: true, message: "Webhook sent" }
    : { success: false, message: `Webhook failed: ${res.status}` };
}

