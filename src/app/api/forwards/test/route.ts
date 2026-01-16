import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import {
  normalizeForwardTargetConfig,
  parseForwardRuleConfig,
  type ForwardCondition,
  type ForwardDestination,
  type ForwardTemplate,
  type ForwardType,
} from "@/services/forward-config";
import { buildForwardTemplateVars, matchesForwardConditions, renderForwardTemplate, type ForwardEmail } from "@/services/forward-runtime";
import nodemailer from "nodemailer";

const targetSchema = z.object({
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
});

const testRequestSchema = z.object({
  mode: z.enum(["dry_run", "send"]).optional(),
  config: z.string().trim().min(1),
  targets: z.array(targetSchema).min(1),
  mailboxId: z.string().trim().min(1).optional(),
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
  ignoreConditions: z.boolean().optional(),
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

function extractRuntimeConfig(rawConfig: string): { ok: true; conditions?: ForwardCondition; template?: ForwardTemplate } | { ok: false; error: string } {
  const parsed = parseForwardRuleConfig(rawConfig);
  if (!parsed.ok) return parsed;
  if (parsed.config.version !== 3) {
    return { ok: false, error: "Forward config version must be 3" };
  }
  return { ok: true, conditions: parsed.config.conditions, template: parsed.config.template };
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

type TargetPreview =
  | { index: number; ok: true; preview: PreviewResult }
  | { index: number; ok: false; error: string };

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

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  const parsed = testRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }

  const mode = parsed.data.mode || "send";

  const runtime = extractRuntimeConfig(parsed.data.config);
  if (!runtime.ok) {
    return NextResponse.json({ error: runtime.error }, { status: 400 });
  }

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
    mailboxId = parsed.data.mailboxId || "sample";
  }

  const vars = buildForwardTemplateVars(email, mailboxId);
  const matched = parsed.data.ignoreConditions
    ? true
    : runtime.conditions
      ? matchesForwardConditions(email, runtime.conditions)
      : true;

  if (!matched) {
    return NextResponse.json({
      matched: false,
      reason: "conditions_not_met",
    });
  }

  type RuntimeTarget =
    | { index: number; destination: ForwardDestination }
    | { index: number; error: string };

  const runtimeTargets: RuntimeTarget[] = parsed.data.targets.map((t, index) => {
    const normalized = normalizeForwardTargetConfig(t.type as ForwardType, t.config);
    if (!normalized.ok) return { index, error: normalized.error };
    return { index, destination: normalized.destination };
  });

  const previews: TargetPreview[] = [];

  for (const t of runtimeTargets) {
    if ("error" in t) {
      previews.push({ index: t.index, ok: false, error: t.error });
      continue;
    }

    try {
      const destination = t.destination;
      const templateText = runtime.template?.text;

      const preview = await (async (): Promise<PreviewResult> => {
        switch (destination.type) {
          case "TELEGRAM": {
            const text = templateText ? renderForwardTemplate(templateText, vars) : buildDefaultTelegramText(email);
            return {
              type: "TELEGRAM",
              url: `https://api.telegram.org/bot${destination.token}/sendMessage`,
              headers: { "Content-Type": "application/json" },
              body: { chat_id: destination.chatId, text, parse_mode: "Markdown" },
            };
          }
          case "DISCORD": {
            const validated = await validateEgressUrl(destination.url);
            if (!validated.ok) throw new Error(validated.error);
            const body = templateText
              ? { content: renderForwardTemplate(templateText, vars) }
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
              headers: { "Content-Type": "application/json", ...destination.headers },
              body,
            };
          }
          case "SLACK": {
            const validated = await validateEgressUrl(destination.url);
            if (!validated.ok) throw new Error(validated.error);
            const body = templateText
              ? { text: renderForwardTemplate(templateText, vars) }
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
              headers: { "Content-Type": "application/json", ...destination.headers },
              body,
            };
          }
          case "WEBHOOK": {
            const validated = await validateEgressUrl(destination.url);
            if (!validated.ok) throw new Error(validated.error);
            const payload = buildWebhookPayload({
              templateBody: runtime.template?.webhookBody,
              contentType: runtime.template?.contentType,
              destinationHeaders: destination.headers,
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
            const subjectTemplate = runtime.template?.subject || "[TEmail] {{subject}}";
            const textTemplate =
              runtime.template?.text ||
              (email.textBody
                ? "{{textBody}}"
                : `From: ${email.fromName || email.fromAddress}\nTo: ${email.toAddress}\n\n(No text content)`);
            const htmlTemplate = runtime.template?.html || (email.htmlBody ? "{{htmlBody}}" : "");
            const subject = renderForwardTemplate(subjectTemplate, vars);
            const text = renderForwardTemplate(textTemplate, vars);
            const html = htmlTemplate ? renderForwardTemplate(htmlTemplate, vars) : undefined;
            return { type: "EMAIL", to: destination.to, subject, text, ...(html ? { html } : {}) };
          }
        }
      })();

      previews.push({ index: t.index, ok: true, preview });
    } catch (error) {
      previews.push({
        index: t.index,
        ok: false,
        error: error instanceof Error ? error.message : "Unable to build preview",
      });
    }
  }

  if (mode === "dry_run") {
    return NextResponse.json({ matched: true, previews });
  }

  const sendable = previews.filter((p): p is Extract<TargetPreview, { ok: true }> => p.ok);
  if (sendable.length === 0) {
    return NextResponse.json({ matched: true, previews, error: "No valid targets to send" }, { status: 400 });
  }

  const results: Array<{ index: number; success: boolean; message: string; responseCode?: number }> = [];
  const smtp = await getSmtpRuntime();

  for (const p of sendable) {
    const preview = p.preview;
    try {
      let resStatus: number | undefined;

      if (preview.type === "EMAIL") {
        if (!smtp) throw new Error("SMTP is not configured");
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
          throw new Error(`Request failed: ${response.status}`);
        }
      }

      results.push({ index: p.index, success: true, message: "Test sent", ...(resStatus ? { responseCode: resStatus } : {}) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Test failed";
      results.push({ index: p.index, success: false, message });
    }
  }

  const allOk = results.every((r) => r.success);
  const status = allOk ? 200 : 400;
  return NextResponse.json({ success: allOk, matched: true, previews, results }, { status });
}
