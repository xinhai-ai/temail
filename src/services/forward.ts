import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import {
  normalizeForwardRuleConfig,
  normalizeForwardTargetConfig,
  parseForwardRuleConfig,
  type ForwardCondition,
  type ForwardDestination,
  type ForwardTemplate,
  type ForwardType,
} from "@/services/forward-config";
import {
  buildForwardTemplateVars,
  matchesForwardConditions,
  renderForwardTemplate,
  type ForwardEmail,
} from "@/services/forward-runtime";

type EmailData = ForwardEmail;

function extractRuntimeConfig(rule: { type: ForwardType; config: string }): { ok: true; conditions?: ForwardCondition; template?: ForwardTemplate } | { ok: false; error: string } {
  const parsed = parseForwardRuleConfig(rule.config);
  if (parsed.ok) {
    return { ok: true, conditions: parsed.config.conditions, template: parsed.config.template };
  }

  const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
  if (!normalized.ok) return normalized;
  return { ok: true, conditions: normalized.config.conditions, template: normalized.config.template };
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
    include: { targets: true },
  });

  for (const rule of rules) {
    try {
      const runtime = extractRuntimeConfig(rule);
      if (!runtime.ok) {
        await prisma.forwardLog.create({
          data: { ruleId: rule.id, success: false, message: runtime.error },
        });
        continue;
      }

      if (runtime.conditions && !matchesForwardConditions(email, runtime.conditions)) {
        continue;
      }

      const vars = buildForwardTemplateVars(email, mailboxId);

      let sentCount = 0;

      if (rule.targets.length > 0) {
        for (const target of rule.targets) {
          const normalizedTarget = normalizeForwardTargetConfig(target.type, target.config);
          if (!normalizedTarget.ok) {
            await prisma.forwardLog.create({
              data: { ruleId: rule.id, targetId: target.id, success: false, message: normalizedTarget.error },
            });
            continue;
          }

          sentCount += 1;
          const result = await sendToDestination(normalizedTarget.destination, runtime.template, email, vars).catch(
            (error) => ({
              success: false,
              message: error instanceof Error ? error.message : "Unknown error",
            })
          );

          await prisma.forwardLog.create({
            data: {
              ruleId: rule.id,
              targetId: target.id,
              success: result.success,
              message: result.message,
              responseCode: result.code,
            },
          });
        }
      } else {
        const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
        if (!normalized.ok) {
          await prisma.forwardLog.create({
            data: { ruleId: rule.id, success: false, message: normalized.error },
          });
          continue;
        }

        sentCount += 1;
        const result = await sendToDestination(normalized.config.destination, runtime.template, email, vars).catch(
          (error) => ({
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          })
        );

        await prisma.forwardLog.create({
          data: {
            ruleId: rule.id,
            success: result.success,
            message: result.message,
            responseCode: result.code,
          },
        });
      }

      if (sentCount === 0) {
        await prisma.forwardLog.create({
          data: { ruleId: rule.id, success: false, message: "No valid forward targets found" },
        });
        continue;
      }

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

function buildDefaultTelegramText(email: EmailData) {
  return `📧 *New Email*\n\n*From:* ${email.fromName || email.fromAddress}\n*To:* ${email.toAddress}\n*Subject:* ${email.subject}\n*Time:* ${email.receivedAt.toISOString()}\n\n${
    email.textBody?.substring(0, 1000) || "(No text content)"
  }`;
}

type SmtpTransporter = ReturnType<typeof nodemailer.createTransport>;
type SmtpRuntime = { transporter: SmtpTransporter; from: string };

let cachedSmtp: { hash: string; runtime: SmtpRuntime; expiresAt: number } | null = null;

function parsePort(value: string | undefined, fallback: number) {
  const parsed = parseInt(value || "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getSmtpRuntime(): Promise<SmtpRuntime | null> {
  const now = Date.now();
  if (cachedSmtp && cachedSmtp.expiresAt > now) return cachedSmtp.runtime;

  const keys = ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from"];
  const map: Record<string, string> = {};

  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    for (const row of rows) map[row.key] = row.value;
  } catch {
    // ignore
  }

  const host = map.smtp_host || process.env.SMTP_HOST;
  if (!host) return null;

  const port = parsePort(map.smtp_port || process.env.SMTP_PORT, 587);
  const secure = (map.smtp_secure || process.env.SMTP_SECURE) === "true" || port === 465;
  const user = map.smtp_user || process.env.SMTP_USER;
  const pass = map.smtp_pass || process.env.SMTP_PASS;
  const from = map.smtp_from || process.env.SMTP_FROM || user;
  if (!from) return null;

  const hash = JSON.stringify({ host, port, secure, user, pass, from });

  if (cachedSmtp && cachedSmtp.hash === hash) {
    cachedSmtp.expiresAt = now + 30_000;
    return cachedSmtp.runtime;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  const runtime: SmtpRuntime = { transporter, from };
  cachedSmtp = { hash, runtime, expiresAt: now + 30_000 };
  return runtime;
}

async function sendToTelegram(
  destination: Extract<ForwardDestination, { type: "TELEGRAM" }>,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (destination.type !== "TELEGRAM") {
    return { success: false, message: "Invalid destination type" };
  }

  const templateText = template?.text;
  const text = templateText ? renderForwardTemplate(templateText, vars) : buildDefaultTelegramText(email);

  const res = await fetch(
    `https://api.telegram.org/bot${destination.token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify({
        chat_id: destination.chatId,
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
  destination: Extract<ForwardDestination, { type: "DISCORD" }>,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (destination.type !== "DISCORD") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const templateText = template?.text;
  const body = templateText
    ? {
        content: renderForwardTemplate(templateText, vars),
      }
    : {
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
      };

  const res = await fetch(validated.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...destination.headers },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body: JSON.stringify(body),
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to Discord" : "Discord failed",
    code: res.status,
  };
}

async function sendToSlack(
  destination: Extract<ForwardDestination, { type: "SLACK" }>,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (destination.type !== "SLACK") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const templateText = template?.text;
  const body = templateText
    ? {
        text: renderForwardTemplate(templateText, vars),
      }
    : {
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
      };

  const res = await fetch(validated.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...destination.headers },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body: JSON.stringify(body),
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to Slack" : "Slack failed",
    code: res.status,
  };
}

async function sendToWebhook(
  destination: Extract<ForwardDestination, { type: "WEBHOOK" }>,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (destination.type !== "WEBHOOK") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const templateBody = template?.webhookBody;
  const rendered = templateBody ? renderForwardTemplate(templateBody, vars) : null;

  const contentType =
    template?.contentType ||
    (rendered && ["{", "["].includes(rendered.trim().charAt(0)) ? "application/json" : "text/plain");

  const body = (() => {
    if (rendered) {
      if (contentType.includes("json")) {
        try {
          return JSON.stringify(JSON.parse(rendered));
        } catch {
          return JSON.stringify({ text: rendered });
        }
      }
      return rendered;
    }
    return JSON.stringify({
      id: email.id,
      subject: email.subject,
      from: email.fromAddress,
      fromName: email.fromName,
      to: email.toAddress,
      text: email.textBody,
      html: email.htmlBody,
      receivedAt: email.receivedAt.toISOString(),
    });
  })();

  const res = await fetch(validated.url, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...destination.headers,
    },
    redirect: "error",
    signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    body,
  });

  return {
    success: res.ok,
    message: res.ok ? "Sent to webhook" : `Webhook failed: ${res.status}`,
    code: res.status,
  };
}

async function sendToEmail(
  destination: Extract<ForwardDestination, { type: "EMAIL" }>,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (destination.type !== "EMAIL") {
    return { success: false, message: "Invalid destination type" };
  }

  const smtp = await getSmtpRuntime();
  if (!smtp) {
    return { success: false, message: "SMTP is not configured" };
  }

  const subjectTemplate = template?.subject || "[TEmail] {{subject}}";
  const textTemplate =
    template?.text ||
    (email.textBody
      ? "{{textBody}}"
      : `From: ${email.fromName || email.fromAddress}\nTo: ${email.toAddress}\n\n(No text content)`);
  const htmlTemplate = template?.html || (email.htmlBody ? "{{htmlBody}}" : "");

  try {
    await smtp.transporter.sendMail({
      from: smtp.from,
      to: destination.to,
      subject: renderForwardTemplate(subjectTemplate, vars),
      text: renderForwardTemplate(textTemplate, vars),
      html: htmlTemplate ? renderForwardTemplate(htmlTemplate, vars) : undefined,
    });

    return { success: true, message: `Sent to ${destination.to}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}

async function sendToDestination(
  destination: ForwardDestination,
  template: ForwardTemplate | undefined,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  switch (destination.type) {
    case "TELEGRAM":
      return sendToTelegram(destination, template, email, vars);
    case "DISCORD":
      return sendToDiscord(destination, template, email, vars);
    case "SLACK":
      return sendToSlack(destination, template, email, vars);
    case "WEBHOOK":
      return sendToWebhook(destination, template, email, vars);
    case "EMAIL":
      return sendToEmail(destination, template, email, vars);
  }
}
