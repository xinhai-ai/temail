import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { triggerEmailWorkflows } from "@/services/workflow/trigger";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { Prisma } from "@prisma/client";
import { readJsonBody } from "@/lib/request";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { getStorage, generateAttachmentPath, generateRawContentPath, getMaxAttachmentSize } from "@/lib/storage";
import { simpleParser, type Attachment } from "mailparser";
import { isVercelDeployment } from "@/lib/deployment/server";

function extractEmailAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const angleMatch = trimmed.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : trimmed).trim();

  // Minimal validation: local@domain with no spaces
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) return null;
  return candidate.toLowerCase();
}

const MAX_WEBHOOK_HEADER_COUNT = 200;
const MAX_WEBHOOK_HEADER_VALUE_LENGTH = 4000;

function extractWebhookHeaders(value: unknown): Array<{ name: string; value: string }> {
  if (!value || typeof value !== "object") return [];

  const entries = Object.entries(value as Record<string, unknown>);
  const headers: Array<{ name: string; value: string }> = [];

  for (const [rawName, rawValue] of entries) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) continue;

    const value =
      typeof rawValue === "string"
        ? rawValue
        : typeof rawValue === "number" || typeof rawValue === "boolean"
          ? String(rawValue)
          : "";

    const trimmedValue = value.trim();
    if (!trimmedValue) continue;

    headers.push({ name, value: trimmedValue.slice(0, MAX_WEBHOOK_HEADER_VALUE_LENGTH) });
    if (headers.length >= MAX_WEBHOOK_HEADER_COUNT) break;
  }

  return headers;
}

async function processAttachments(
  attachments: Attachment[],
  emailId: string,
  date: Date
): Promise<Array<{ id: string; filename: string; contentType: string; size: number; path: string }>> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const storage = getStorage();
  const maxSize = getMaxAttachmentSize();
  const records: Array<{ id: string; filename: string; contentType: string; size: number; path: string }> = [];

  for (const attachment of attachments) {
    const size = attachment.size || 0;
    if (size > maxSize) {
      continue;
    }

    if (!attachment.content) {
      continue;
    }

    const buffer = Buffer.isBuffer(attachment.content)
      ? attachment.content
      : Buffer.from(attachment.content);
    const resolvedSize = size || buffer.length;
    if (resolvedSize > maxSize) {
      continue;
    }

    const attachmentId = `${emailId}-${records.length}`;
    const filename = attachment.filename || "unnamed";
    const contentType = attachment.contentType || "application/octet-stream";

    try {
      const path = generateAttachmentPath(attachmentId, filename, date);
      await storage.write(path, buffer);
      records.push({
        id: attachmentId,
        filename,
        contentType,
        size: resolvedSize,
        path,
      });
    } catch (error) {
      console.error("[webhook] failed to save attachment:", error);
    }
  }

  return records;
}

export async function POST(request: NextRequest) {
  try {
    const vercelMode = isVercelDeployment();
    const ip = getClientIp(request) || "unknown";
    const limited = rateLimit(`webhook-incoming:${ip}`, { limit: 600, windowMs: 60_000 });
    if (!limited.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const bodyResult = await readJsonBody(request, { maxBytes: 1_000_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }

    const body = bodyResult.data;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const { to, from, subject, text, html, secret, messageId, headers, raw } = payload;

    const secretKey = typeof secret === "string" ? secret.trim() : "";
    const rawTo = typeof to === "string" ? to : "";

    if (!rawTo || !secretKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const toAddress = extractEmailAddress(rawTo);
    if (!toAddress) {
      return NextResponse.json({ error: "Invalid to address" }, { status: 400 });
    }

    const webhookConfig = await prisma.domainWebhookConfig.findUnique({
      where: { secretKey },
      include: { domain: true },
    });

    if (!webhookConfig) {
      return NextResponse.json(
        { error: "Invalid webhook secret" },
        { status: 401 }
      );
    }

    if (!webhookConfig.isActive) {
      return NextResponse.json(
        { error: "Webhook is disabled" },
        { status: 403 }
      );
    }

    const domainName = webhookConfig.domain.name.toLowerCase();
    if (!toAddress.endsWith(`@${domainName}`)) {
      return NextResponse.json(
        { error: "Webhook secret does not match recipient domain" },
        { status: 403 }
      );
    }

    if (webhookConfig.domain.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Domain is not active" },
        { status: 403 }
      );
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        address: toAddress,
        domainId: webhookConfig.domainId,
        status: "ACTIVE",
      },
      select: { id: true, userId: true, address: true },
    });

    if (!mailbox && webhookConfig.domain.inboundPolicy === "KNOWN_ONLY") {
      return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
    }

    const providedRaw = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    let parsedRaw: Awaited<ReturnType<typeof simpleParser>> | null = null;
    if (providedRaw) {
      try {
        parsedRaw = await simpleParser(providedRaw);
      } catch (error) {
        console.error("[webhook] failed to parse raw email:", error);
      }
    }

    const parsedRawFrom = Array.isArray(parsedRaw?.from?.value) ? parsedRaw?.from?.value[0] : undefined;
    const rawFromAddress =
      typeof parsedRawFrom?.address === "string" ? parsedRawFrom.address : null;
    const rawFromName = typeof parsedRawFrom?.name === "string" ? parsedRawFrom.name : null;

    const parsedMessageId = typeof messageId === "string" ? messageId : null;
    const rawMessageId =
      typeof parsedRaw?.messageId === "string" && parsedRaw.messageId.trim()
        ? parsedRaw.messageId.trim()
        : null;
    const effectiveMessageId = parsedMessageId || rawMessageId;

    const fromAddress =
      extractEmailAddress(from) ||
      (rawFromAddress ? rawFromAddress.toLowerCase() : null) ||
      (typeof from === "string" ? from : null) ||
      "unknown@unknown.com";
    const fromName = rawFromName;

    const normalizedSubject =
      typeof subject === "string" && subject.trim()
        ? subject.trim()
        : (typeof parsedRaw?.subject === "string" && parsedRaw.subject.trim() ? parsedRaw.subject.trim() : "(No subject)");

    const textBody = typeof text === "string" ? text : parsedRaw?.text || undefined;
    const htmlBody = typeof html === "string" ? html : typeof parsedRaw?.html === "string" ? parsedRaw.html : undefined;
    const parsedHeaders = extractWebhookHeaders(headers);
    const now = new Date();
    const receivedAt = parsedRaw?.date ? new Date(parsedRaw.date) : now;

    const rawContent = !vercelMode
      ? (providedRaw
          ? providedRaw
          : JSON.stringify({
              to,
              from,
              subject: normalizedSubject,
              text: textBody,
              html: htmlBody,
              messageId: effectiveMessageId,
              ...(parsedHeaders.length ? { headers: parsedHeaders } : {}),
            }))
      : null;

    // Generate a unique ID for file storage
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Save raw content to file
    let rawContentPath: string | undefined;
    if (rawContent && !vercelMode) {
      try {
        const storage = getStorage();
        rawContentPath = generateRawContentPath(tempId, receivedAt);
        await storage.write(rawContentPath, rawContent);
      } catch (error) {
        console.error("[webhook] failed to save raw content:", error);
        // Fall back to not storing raw content if file storage fails
      }
    }

    try {
      await prisma.inboundEmail.create({
        data: {
          sourceType: "WEBHOOK",
          messageId: effectiveMessageId || undefined,
          fromAddress,
          fromName: fromName || undefined,
          toAddress,
          subject: normalizedSubject,
          textBody,
          htmlBody,
          rawContentPath,
          receivedAt,
          domainId: webhookConfig.domainId,
          mailboxId: mailbox?.id,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }

    if (!mailbox) {
      return NextResponse.json({ success: true, matched: false });
    }

    if (effectiveMessageId) {
      const existing = await prisma.email.findFirst({
        where: { mailboxId: mailbox.id, messageId: effectiveMessageId },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          emailId: existing.id,
          duplicate: true,
          matched: true,
        });
      }
    }

    const attachmentRecords = parsedRaw
      ? vercelMode
        ? []
        : await processAttachments(parsedRaw.attachments || [], tempId, receivedAt)
      : [];

    const email = await prisma.email.create({
      data: {
        messageId: effectiveMessageId || undefined,
        fromAddress,
        fromName: fromName || undefined,
        toAddress,
        subject: normalizedSubject,
        textBody,
        htmlBody,
        rawContentPath,
        mailboxId: mailbox.id,
        receivedAt,
        ...(parsedHeaders.length ? { headers: { create: parsedHeaders } } : {}),
        ...(attachmentRecords.length ? { attachments: { create: attachmentRecords } } : {}),
      },
    });

    publishRealtimeEvent(mailbox.userId, {
      type: "email.created",
      data: {
        email: {
          id: email.id,
          mailboxId: email.mailboxId,
          mailboxAddress: mailbox.address,
          subject: email.subject,
          fromAddress: email.fromAddress,
          fromName: email.fromName,
          status: email.status,
          isStarred: email.isStarred,
          receivedAt: email.receivedAt.toISOString(),
        },
      },
    });

    // Trigger workflow executions
    triggerEmailWorkflows(email, mailbox.id, mailbox.userId).catch(console.error);

    return NextResponse.json({ success: true, emailId: email.id, matched: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Unique constraint (e.g. messageId) - treat as idempotent
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
