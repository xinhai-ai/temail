import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { normalizeForwardRuleConfig } from "@/services/forward-config";
import { buildForwardTemplateVars, matchesForwardConditions, renderForwardTemplate, type ForwardEmail } from "@/services/forward-runtime";
import nodemailer from "nodemailer";

const testRequestSchema = z.object({
  mode: z.enum(["dry_run", "send"]).optional(),
  emailId: z.string().trim().min(1).optional(),
  sample: z
    .object({
      subject: z.string().optional(),
      fromAddress: z.string().optional(),
      fromName: z.string().optional(),
      toAddress: z.string().optional(),
      textBody: z.string().optional(),
      htmlBody: z.string().optional(),
      receivedAt: z.string().datetime().optional(),
    })
    .optional(),
});

function buildDefaultSampleEmail() {
  const now = new Date();
  return {
    id: "sample",
    subject: "Test Forward - TEmail",
    fromAddress: "test@temail.local",
    fromName: "TEmail",
    toAddress: "test@temail.local",
    textBody: "This is a test message from TEmail forward system.",
    htmlBody: "<p>This is a <strong>test</strong> message from TEmail forward system.</p>",
    receivedAt: now,
  } satisfies ForwardEmail;
}

function buildDefaultTelegramText(email: ForwardEmail) {
  return `📧 *New Email*\n\n*From:* ${email.fromName || email.fromAddress}\n*To:* ${email.toAddress}\n*Subject:* ${email.subject}\n*Time:* ${email.receivedAt.toISOString()}\n\n${
    email.textBody?.substring(0, 1000) || "(No text content)"
  }`;
}

type PreviewResult =
  | {
      type: "TELEGRAM";
      url: string;
      headers: Record<string, string>;
      body: unknown;
    }
  | {
      type: "DISCORD" | "SLACK" | "WEBHOOK";
      url: string;
      headers: Record<string, string>;
      body: unknown;
    }
  | {
      type: "EMAIL";
      to: string;
      subject: string;
      text: string;
      html?: string;
    };

function buildWebhookPayload(config: {
  templateBody?: string;
  contentType?: string;
  destinationHeaders: Record<string, string>;
  email: ForwardEmail;
  vars: Record<string, unknown>;
}) {
  const rendered = config.templateBody ? renderForwardTemplate(config.templateBody, config.vars) : null;
  const inferredContentType = rendered && ["{", "["].includes(rendered.trim().charAt(0)) ? "application/json" : "text/plain";
  const contentType = config.contentType || inferredContentType;

  const body = (() => {
    if (rendered) {
      if (contentType.includes("json")) {
        try {
          return JSON.parse(rendered);
        } catch {
          return { text: rendered };
        }
      }
      return rendered;
    }
    return {
      id: config.email.id,
      subject: config.email.subject,
      from: config.email.fromAddress,
      fromName: config.email.fromName,
      to: config.email.toAddress,
      text: config.email.textBody,
      html: config.email.htmlBody,
      receivedAt: config.email.receivedAt.toISOString(),
    };
  })();

  return { contentType, headers: config.destinationHeaders, body };
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rule = await prisma.forwardRule.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, type: true, config: true, mailboxId: true },
  });

  if (!rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const body = await request
    .json()
    .catch(() => ({}));

  const parsed = testRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }

  const mode = parsed.data.mode || "send";

  const normalized = normalizeForwardRuleConfig(rule.type, rule.config);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  const config = normalized.config;

  let email: ForwardEmail;
  let mailboxId: string;

  if (parsed.data.emailId) {
    const found = await prisma.email.findFirst({
      where: { id: parsed.data.emailId, mailbox: { userId: session.user.id } },
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        fromName: true,
        toAddress: true,
        textBody: true,
        htmlBody: true,
        receivedAt: true,
        mailboxId: true,
      },
    });
    if (!found) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    email = found;
    mailboxId = found.mailboxId;
  } else {
    const base = buildDefaultSampleEmail();
    const sample = parsed.data.sample || {};
    const receivedAt = sample.receivedAt ? new Date(sample.receivedAt) : base.receivedAt;
    email = {
      ...base,
      ...sample,
      receivedAt: Number.isFinite(receivedAt.getTime()) ? receivedAt : base.receivedAt,
    };
    mailboxId = rule.mailboxId || "sample";
  }

  const vars = buildForwardTemplateVars(email, mailboxId);
  const matched = config.conditions ? matchesForwardConditions(email, config.conditions) : true;

  if (!matched) {
    return NextResponse.json({
      matched: false,
      reason: "conditions_not_met",
    });
  }

  let preview: PreviewResult;
  try {
    preview = await (async (): Promise<PreviewResult> => {
      switch (rule.type) {
        case "TELEGRAM": {
          if (config.destination.type !== "TELEGRAM") throw new Error("Invalid destination type");
          const text = config.template?.text
            ? renderForwardTemplate(config.template.text, vars)
            : buildDefaultTelegramText(email);
          return {
            type: "TELEGRAM",
            url: `https://api.telegram.org/bot${config.destination.token}/sendMessage`,
            headers: { "Content-Type": "application/json" },
            body: { chat_id: config.destination.chatId, text, parse_mode: "Markdown" },
          };
        }
        case "DISCORD": {
          if (config.destination.type !== "DISCORD") throw new Error("Invalid destination type");
          const validated = await validateEgressUrl(config.destination.url);
          if (!validated.ok) throw new Error(validated.error);
          const template = config.template?.text;
          const body = template
            ? { content: renderForwardTemplate(template, vars) }
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
          return {
            type: "DISCORD",
            url: validated.url.toString(),
            headers: { "Content-Type": "application/json", ...config.destination.headers },
            body,
          };
        }
        case "SLACK": {
          if (config.destination.type !== "SLACK") throw new Error("Invalid destination type");
          const validated = await validateEgressUrl(config.destination.url);
          if (!validated.ok) throw new Error(validated.error);
          const template = config.template?.text;
          const body = template
            ? { text: renderForwardTemplate(template, vars) }
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
          return {
            type: "SLACK",
            url: validated.url.toString(),
            headers: { "Content-Type": "application/json", ...config.destination.headers },
            body,
          };
        }
        case "WEBHOOK": {
          if (config.destination.type !== "WEBHOOK") throw new Error("Invalid destination type");
          const validated = await validateEgressUrl(config.destination.url);
          if (!validated.ok) throw new Error(validated.error);
          const payload = buildWebhookPayload({
            templateBody: config.template?.webhookBody,
            contentType: config.template?.contentType,
            destinationHeaders: config.destination.headers,
            email,
            vars,
          });
          return {
            type: "WEBHOOK",
            url: validated.url.toString(),
            headers: { "Content-Type": payload.contentType, ...payload.headers },
            body: payload.body,
          };
        }
        case "EMAIL": {
          if (config.destination.type !== "EMAIL") throw new Error("Invalid destination type");
          const subjectTemplate = config.template?.subject || "[TEmail] {{subject}}";
          const textTemplate =
            config.template?.text ||
            (email.textBody
              ? "{{textBody}}"
              : `From: ${email.fromName || email.fromAddress}\nTo: ${email.toAddress}\n\n(No text content)`);
          const htmlTemplate = config.template?.html || (email.htmlBody ? "{{htmlBody}}" : "");
          const subject = renderForwardTemplate(subjectTemplate, vars);
          const text = renderForwardTemplate(textTemplate, vars);
          const html = htmlTemplate ? renderForwardTemplate(htmlTemplate, vars) : undefined;
          return { type: "EMAIL", to: config.destination.to, subject, text, ...(html ? { html } : {}) };
        }
      }
    })();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to build preview";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (mode === "dry_run") {
    return NextResponse.json({ matched: true, preview });
  }

  try {
    let resStatus: number | undefined;

    if (preview.type === "EMAIL") {
      const smtp = await getSmtpRuntime();
      if (!smtp) {
        return NextResponse.json({ error: "SMTP is not configured" }, { status: 400 });
      }
      await smtp.transporter.sendMail({
        from: smtp.from,
        to: preview.to,
        subject: preview.subject,
        text: preview.text,
        ...(preview.html ? { html: preview.html } : {}),
      });
    } else {
      const response = await fetch(preview.url, {
        method: "POST",
        headers: preview.headers,
        redirect: "error",
        signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
        body: typeof preview.body === "string" ? preview.body : JSON.stringify(preview.body),
      });
      resStatus = response.status;
      if (!response.ok) {
        return NextResponse.json({ error: `Request failed: ${response.status}` }, { status: 400 });
      }
    }

    await prisma.forwardLog.create({
      data: {
        ruleId: rule.id,
        success: true,
        message: "Test sent",
        ...(typeof resStatus === "number" ? { responseCode: resStatus } : {}),
      },
    });

    await prisma.forwardRule.update({
      where: { id: rule.id },
      data: { lastTriggered: new Date() },
    });

    return NextResponse.json({ success: true, matched: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed";
    await prisma.forwardLog.create({
      data: {
        ruleId: rule.id,
        success: false,
        message,
      },
    }).catch(() => {
      // ignore
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
