import prisma from "@/lib/prisma";

interface EmailData {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  receivedAt: Date;
}

export async function executeForwards(email: EmailData, mailboxId: string) {
  // Get all active forward rules for this mailbox or global rules
  const rules = await prisma.forwardRule.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ mailboxId }, { mailboxId: null }],
    },
  });

  for (const rule of rules) {
    try {
      const config = JSON.parse(rule.config);
      let result;

      switch (rule.type) {
        case "TELEGRAM":
          result = await sendToTelegram(config, email);
          break;
        case "DISCORD":
          result = await sendToDiscord(config, email);
          break;
        case "SLACK":
          result = await sendToSlack(config, email);
          break;
        case "WEBHOOK":
          result = await sendToWebhook(config, email);
          break;
        case "EMAIL":
          result = await sendToEmail(config, email);
          break;
        default:
          result = { success: false, message: "Unknown forward type" };
      }

      // Log the forward attempt
      await prisma.forwardLog.create({
        data: {
          ruleId: rule.id,
          success: result.success,
          message: result.message,
          responseCode: result.code,
        },
      });

      // Update last triggered
      await prisma.forwardRule.update({
        where: { id: rule.id },
        data: { lastTriggered: new Date() },
      });
    } catch (error) {
      await prisma.forwardLog.create({
        data: {
          ruleId: rule.id,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }
}

interface ForwardResult {
  success: boolean;
  message: string;
  code?: number;
}

async function sendToTelegram(
  config: { token: string; chatId: string },
  email: EmailData
): Promise<ForwardResult> {
  const text = `📧 *New Email*

*From:* ${email.fromName || email.fromAddress}
*To:* ${email.toAddress}
*Subject:* ${email.subject}
*Time:* ${email.receivedAt.toISOString()}

${email.textBody?.substring(0, 1000) || "(No text content)"}`;

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
    return { success: true, message: "Sent to Telegram", code: res.status };
  }
  const data = await res.json();
  return { success: false, message: data.description, code: res.status };
}

async function sendToDiscord(
  config: { url: string },
  email: EmailData
): Promise<ForwardResult> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `📧 ${email.subject}`,
          description: email.textBody?.substring(0, 2000) || "(No content)",
          color: 0xf59e0b,
          fields: [
            { name: "From", value: email.fromName || email.fromAddress, inline: true },
            { name: "To", value: email.toAddress, inline: true },
          ],
          timestamp: email.receivedAt.toISOString(),
        },
      ],
    }),
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to Discord" : "Discord failed",
    code: res.status,
  };
}

async function sendToSlack(
  config: { url: string },
  email: EmailData
): Promise<ForwardResult> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `📧 ${email.subject}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*From:*\n${email.fromName || email.fromAddress}` },
            { type: "mrkdwn", text: `*To:*\n${email.toAddress}` },
          ],
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: email.textBody?.substring(0, 2000) || "(No content)",
          },
        },
      ],
    }),
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to Slack" : "Slack failed",
    code: res.status,
  };
}

async function sendToWebhook(
  config: { url: string; headers?: Record<string, string> },
  email: EmailData
): Promise<ForwardResult> {
  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...config.headers,
    },
    body: JSON.stringify({
      id: email.id,
      subject: email.subject,
      from: email.fromAddress,
      fromName: email.fromName,
      to: email.toAddress,
      text: email.textBody,
      html: email.htmlBody,
      receivedAt: email.receivedAt.toISOString(),
    }),
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to webhook" : `Webhook failed: ${res.status}`,
    code: res.status,
  };
}

async function sendToEmail(
  config: { to: string },
  email: EmailData
): Promise<ForwardResult> {
  // Email forwarding would require SMTP configuration
  // For now, just log that it would be forwarded
  console.log(`Would forward email to: ${config.to}`);
  return {
    success: true,
    message: `Email forward to ${config.to} (SMTP not configured)`,
  };
}
