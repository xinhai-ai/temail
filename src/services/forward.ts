import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { normalizeForwardRuleConfig, type ForwardCondition, type ForwardRuleConfigV2 } from "@/services/forward-config";

const MAX_REGEX_PATTERN_LENGTH = 200;
const MAX_MATCH_INPUT_LENGTH = 10_000;

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

function getTemplateVars(email: EmailData, mailboxId: string) {
  return {
    id: email.id,
    subject: email.subject,
    fromAddress: email.fromAddress,
    fromName: email.fromName || "",
    toAddress: email.toAddress,
    textBody: email.textBody || "",
    htmlBody: email.htmlBody || "",
    receivedAt: email.receivedAt.toISOString(),
    mailboxId,
  };
}

function readTemplatePath(vars: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = vars;
  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || current === undefined) return "";
  return typeof current === "string" ? current : String(current);
}

function renderTemplate(template: string, vars: Record<string, unknown>) {
  return template.replace(
    /\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}|\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_, rawKey, escapedKey) => readTemplatePath(vars, rawKey || escapedKey)
  );
}

function normalizeText(value: string, caseSensitive: boolean | undefined) {
  return caseSensitive ? value : value.toLowerCase();
}

function matchesLeafCondition(
  email: EmailData,
  field: "subject" | "fromAddress" | "toAddress" | "textBody",
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "regex",
  expectedValue: string,
  caseSensitive: boolean | undefined
) {
  const raw = (() => {
    if (field === "textBody") return email.textBody || "";
    return email[field] || "";
  })();

  const candidate = raw.slice(0, MAX_MATCH_INPUT_LENGTH);
  const normalizedCandidate = normalizeText(candidate, caseSensitive);
  const normalizedExpected = normalizeText(expectedValue, caseSensitive);

  switch (operator) {
    case "contains":
      return normalizedCandidate.includes(normalizedExpected);
    case "equals":
      return normalizedCandidate === normalizedExpected;
    case "startsWith":
      return normalizedCandidate.startsWith(normalizedExpected);
    case "endsWith":
      return normalizedCandidate.endsWith(normalizedExpected);
    case "regex": {
      const pattern = expectedValue;
      if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH) return false;
      try {
        const re = new RegExp(pattern, caseSensitive ? "" : "i");
        return re.test(candidate);
      } catch {
        return false;
      }
    }
  }
}

function matchesConditions(email: EmailData, condition: ForwardCondition): boolean {
  switch (condition.kind) {
    case "and":
      return condition.conditions.every((c) => matchesConditions(email, c));
    case "or":
      return condition.conditions.some((c) => matchesConditions(email, c));
    case "not":
      return !matchesConditions(email, condition.condition);
    case "match":
      return matchesLeafCondition(
        email,
        condition.field,
        condition.operator,
        condition.value,
        condition.caseSensitive
      );
  }
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
      const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
      if (!normalized.ok) {
        await prisma.forwardLog.create({
          data: {
            ruleId: rule.id,
            success: false,
            message: normalized.error,
          },
        });
        continue;
      }

      const config: ForwardRuleConfigV2 = normalized.config;
      if (config.conditions && !matchesConditions(email, config.conditions)) {
        continue;
      }

      let result;
      const vars = getTemplateVars(email, mailboxId);

      switch (rule.type) {
        case "TELEGRAM":
          result = await sendToTelegram(config, email, vars);
          break;
        case "DISCORD":
          result = await sendToDiscord(config, email, vars);
          break;
        case "SLACK":
          result = await sendToSlack(config, email, vars);
          break;
        case "WEBHOOK":
          result = await sendToWebhook(config, email, vars);
          break;
        case "EMAIL":
          result = await sendToEmail(config, email, vars);
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
  config: ForwardRuleConfigV2,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (config.destination.type !== "TELEGRAM") {
    return { success: false, message: "Invalid destination type" };
  }

  const template = config.template?.text;
  const text = template ? renderTemplate(template, vars) : buildDefaultTelegramText(email);

  const res = await fetch(
    `https://api.telegram.org/bot${config.destination.token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify({
        chat_id: config.destination.chatId,
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
  config: ForwardRuleConfigV2,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (config.destination.type !== "DISCORD") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(config.destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const template = config.template?.text;
  const body = template
    ? {
        content: renderTemplate(template, vars),
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
    headers: { "Content-Type": "application/json", ...config.destination.headers },
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
  config: ForwardRuleConfigV2,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (config.destination.type !== "SLACK") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(config.destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const template = config.template?.text;
  const body = template
    ? {
        text: renderTemplate(template, vars),
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
    headers: { "Content-Type": "application/json", ...config.destination.headers },
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
  config: ForwardRuleConfigV2,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (config.destination.type !== "WEBHOOK") {
    return { success: false, message: "Invalid destination type" };
  }

  const validated = await validateEgressUrl(config.destination.url);
  if (!validated.ok) {
    return { success: false, message: validated.error };
  }

  const templateBody = config.template?.webhookBody;
  const rendered = templateBody ? renderTemplate(templateBody, vars) : null;

  const contentType =
    config.template?.contentType ||
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
      ...config.destination.headers,
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
  config: ForwardRuleConfigV2,
  email: EmailData,
  vars: Record<string, unknown>
): Promise<ForwardResult> {
  if (config.destination.type !== "EMAIL") {
    return { success: false, message: "Invalid destination type" };
  }

  const smtp = await getSmtpRuntime();
  if (!smtp) {
    return { success: false, message: "SMTP is not configured" };
  }

  const subjectTemplate = config.template?.subject || "[TEmail] {{subject}}";
  const textTemplate =
    config.template?.text ||
    (email.textBody
      ? "{{textBody}}"
      : `From: ${email.fromName || email.fromAddress}\nTo: ${email.toAddress}\n\n(No text content)`);
  const htmlTemplate = config.template?.html || (email.htmlBody ? "{{htmlBody}}" : "");

  try {
    await smtp.transporter.sendMail({
      from: smtp.from,
      to: config.destination.to,
      subject: renderTemplate(subjectTemplate, vars),
      text: renderTemplate(textTemplate, vars),
      html: htmlTemplate ? renderTemplate(htmlTemplate, vars) : undefined,
    });

    return { success: true, message: `Sent to ${config.destination.to}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "SMTP send failed",
    };
  }
}
