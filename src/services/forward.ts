import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";

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

export async function executeForwards(email: EmailData, mailboxId: string, userId?: string) {
  const ownerId =
    userId ||
    (
      await prisma.mailbox.findUnique({
        where: { id: mailboxId },
        select: { userId: true },
      })
    )?.userId;

  if (!ownerId) return;

  // Get all active forward rules for this mailbox or user-global rules
  const rules = await prisma.forwardRule.findMany({
    where: {
      userId: ownerId,
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

type SmtpTransporter = ReturnType<typeof nodemailer.createTransport>;
type SmtpRuntime = { transporter: SmtpTransporter; from: string };

let cachedSmtp: { hash: string; runtime: SmtpRuntime; expiresAt: number } | null = null;

function parsePort(value: string | undefined, fallback: number) {
  const parsed = parseInt(value || "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadSmtpRuntime(): Promise<SmtpRuntime | null> {
  const keys = ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from"];
  const map: Record<string, string> = {};

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    for (const row of rows) map[row.key] = row.value;
  } catch {
    // ignore DB read failures and fall back to env
  }

  const host = map.smtp_host || process.env.SMTP_HOST;
  if (!host) return null;

  const port = parsePort(map.smtp_port || process.env.SMTP_PORT, 587);
  const secure = (map.smtp_secure || process.env.SMTP_SECURE) === "true" || port === 465;
  const user = map.smtp_user || process.env.SMTP_USER;
  const pass = map.smtp_pass || process.env.SMTP_PASS;
  const from = map.smtp_from || process.env.SMTP_FROM || user;

  if (!from) return null;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  return { transporter, from };
}

async function getSmtpRuntime(): Promise<SmtpRuntime | null> {
  const now = Date.now();
  if (cachedSmtp && cachedSmtp.expiresAt > now) return cachedSmtp.runtime;

  const runtime = await loadSmtpRuntime();
  if (!runtime) return null;

  const transport = runtime.transporter.options;
  const hash = JSON.stringify({
    host: transport.host,
    port: transport.port,
    secure: transport.secure,
    authUser: typeof transport.auth === "object" ? (transport.auth as { user?: string }).user : undefined,
    from: runtime.from,
  });

  if (cachedSmtp && cachedSmtp.hash === hash) {
    cachedSmtp.expiresAt = now + 30_000;
    return cachedSmtp.runtime;
  }

  cachedSmtp = { hash, runtime, expiresAt: now + 30_000 };
  return runtime;
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
  const smtp = await getSmtpRuntime();
  if (!smtp) {
    return { success: false, message: "SMTP is not configured" };
  }

  try {
    await smtp.transporter.sendMail({
      from: smtp.from,
      to: config.to,
      subject: `[TEmail] ${email.subject}`,
      text:
        email.textBody ||
        `From: ${email.fromName || email.fromAddress}\nTo: ${email.toAddress}\n\n(No text content)`,
      html: email.htmlBody || undefined,
    });

    return { success: true, message: `Sent to ${config.to}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}
