import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { triggerEmailWorkflows } from "@/services/workflow/trigger";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import {
  generateAttachmentPath,
  generateRawContentPath,
  getActiveStorageBackend,
  getMaxAttachmentSize,
  getStorageForBackend,
  toStoredFileBackendMarker,
  type StoredFileBackendMarker,
  type StorageProvider,
} from "@/lib/storage";
import { simpleParser, type Attachment } from "mailparser";
import { isVercelDeployment } from "@/lib/deployment/server";
import { canStoreForUser } from "@/services/storage-quota";
import { getUserMailContentStoragePreference } from "@/services/user-mail-content-storage";

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

const payloadSchema = z
  .object({
    to: z.string().trim().min(1).max(320),
    from: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    secret: z.string().trim().min(1).max(200),
    messageId: z.string().optional(),
    headers: z.unknown().optional(),
    raw: z.string().optional(),
  })
  .passthrough();

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
  date: Date,
  storage: StorageProvider,
  storageBackend: StoredFileBackendMarker
): Promise<Array<{ id: string; filename: string; contentType: string; size: number; path: string; storageBackend: StoredFileBackendMarker }>> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const maxSize = getMaxAttachmentSize();
  const records: Array<{ id: string; filename: string; contentType: string; size: number; path: string; storageBackend: StoredFileBackendMarker }> = [];

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
        storageBackend,
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
    const limited = await rateLimitByPolicy("webhook.incoming.ip", `webhook-incoming:${ip}`, { limit: 600, windowMs: 60_000 });
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

    const parsedPayload = payloadSchema.safeParse(bodyResult.data);
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: parsedPayload.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { to, from, subject, text, html, secret, messageId, headers, raw } = parsedPayload.data;
    const secretKey = secret;
    const rawTo = to;

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

    const domainLimited = await rateLimitByPolicy("webhook.incoming.domain", `webhook-incoming:domain:${webhookConfig.domainId}`, { limit: 3_000, windowMs: 60_000 });
    if (!domainLimited.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(domainLimited.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
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
      select: {
        id: true,
        userId: true,
        address: true,
        archivedAt: true,
      },
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
    const shouldStoreRawAndAttachmentsForMailbox = mailbox
      ? await getUserMailContentStoragePreference(mailbox.userId)
      : true;

    const maxAttachmentSize = getMaxAttachmentSize();
    const predictedRawBytes =
      shouldStoreRawAndAttachmentsForMailbox && rawContent ? Buffer.byteLength(rawContent, "utf8") : 0;
    const predictedAttachmentStats =
      shouldStoreRawAndAttachmentsForMailbox && parsedRaw
        ? (parsedRaw.attachments || []).reduce(
            (acc, attachment) => {
              if (!attachment.content) return acc;
              const size = Math.max(0, attachment.size || attachment.content.length || 0);
              if (size > maxAttachmentSize) return acc;
              acc.bytes += size;
              acc.files += 1;
              return acc;
            },
            { bytes: 0, files: 0 }
          )
        : { bytes: 0, files: 0 };

    let storageAllowed = true;
    if (
      shouldStoreRawAndAttachmentsForMailbox &&
      mailbox &&
      !vercelMode &&
      (predictedRawBytes > 0 || predictedAttachmentStats.files > 0)
    ) {
      const check = await canStoreForUser({
        userId: mailbox.userId,
        additionalBytes: predictedRawBytes + predictedAttachmentStats.bytes,
        additionalFiles: (predictedRawBytes > 0 ? 1 : 0) + predictedAttachmentStats.files,
      });
      storageAllowed = check.allowed;
    }
    const shouldPersistMailContent = shouldStoreRawAndAttachmentsForMailbox && storageAllowed;

    const activeStorageBackend = vercelMode ? "local" : await getActiveStorageBackend();
    const storageBackend = toStoredFileBackendMarker(activeStorageBackend);
    const storage = getStorageForBackend(activeStorageBackend);

    // Save raw content to file
    let rawContentPath: string | undefined;
    let rawStorageBackend: StoredFileBackendMarker | undefined;
    if (shouldPersistMailContent && rawContent && !vercelMode) {
      try {
        rawContentPath = generateRawContentPath(tempId, receivedAt);
        await storage.write(rawContentPath, rawContent);
        rawStorageBackend = storageBackend;
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
          rawStorageBackend,
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

    const attachmentRecords = shouldPersistMailContent
      ? parsedRaw
        ? vercelMode
          ? []
          : await processAttachments(parsedRaw.attachments || [], tempId, receivedAt, storage, storageBackend)
        : []
      : [];

    const storageBytes =
      (rawContentPath ? predictedRawBytes : 0) +
      attachmentRecords.reduce((sum, attachment) => sum + Math.max(0, attachment.size || 0), 0);
    const storageFiles = (rawContentPath ? 1 : 0) + attachmentRecords.length;

    const email = await prisma.$transaction(async (tx) => {
      const created = await tx.email.create({
        data: {
          messageId: effectiveMessageId || undefined,
          fromAddress,
          fromName: fromName || undefined,
          toAddress,
          subject: normalizedSubject,
          textBody,
          htmlBody,
          rawContentPath,
          rawStorageBackend,
          storageBytes,
          storageFiles,
          storageTruncated: shouldStoreRawAndAttachmentsForMailbox && !storageAllowed,
          mailboxId: mailbox.id,
          receivedAt,
          ...(parsedHeaders.length ? { headers: { create: parsedHeaders } } : {}),
          ...(attachmentRecords.length ? { attachments: { create: attachmentRecords } } : {}),
        },
      });

      await tx.mailbox.updateMany({
        where: {
          id: mailbox.id,
          OR: [{ lastEmailReceivedAt: null }, { lastEmailReceivedAt: { lt: created.receivedAt } }],
        },
        data: { lastEmailReceivedAt: created.receivedAt },
      });

      return created;
    });

    const isArchivedMailbox = mailbox.archivedAt !== null;
    if (!isArchivedMailbox) {
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
    }

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
