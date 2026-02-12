import { ImapFlow, type MailboxObject } from "imapflow";
import { simpleParser, type ParsedMail, type Attachment } from "mailparser";
import { Prisma, type Domain, type ImapConfig, type PersonalImapAccount } from "@prisma/client";
import prisma from "@/lib/prisma";
import { triggerEmailWorkflows } from "@/services/workflow/trigger";
import {
  generateRawContentPath,
  generateAttachmentPath,
  getActiveStorageBackend,
  getMaxAttachmentSize,
  getStorageForBackend,
  toStoredFileBackendMarker,
  type StoredFileBackendMarker,
  type StorageProvider,
} from "@/lib/storage";
import { canStoreForUser } from "@/services/storage-quota";

type PersonalImapAccountForSync = Pick<
  PersonalImapAccount,
  "id" | "email" | "username" | "passwordCiphertext" | "passwordIv" | "passwordTag" | "status"
>;

export type ImapDomain = Domain & {
  imapConfig: ImapConfig;
  personalImapAccount: PersonalImapAccountForSync | null;
};

export type SyncResult = {
  success: boolean;
  processed: number;
  errors: number;
  newHighestUid?: number;
  uidValidity?: bigint;
};

export type RealtimePublisher = (
  userId: string,
  event: {
    type: "email.created";
    data: {
      email: {
        id: string;
        mailboxId: string;
        mailboxAddress: string;
        subject: string;
        fromAddress: string;
        fromName?: string | null;
        status: string;
        isStarred: boolean;
        receivedAt: string;
      };
    };
  }
) => void;

export type SyncOptions = {
  publishRealtimeEvent?: RealtimePublisher;
  nextjsUrl?: string;  // URL of Next.js app for realtime notifications
  debug?: boolean;
};

// Create a realtime publisher that calls the Next.js internal API
export function createHttpRealtimePublisher(nextjsUrl: string): RealtimePublisher {
  const serviceKey = process.env.IMAP_SERVICE_KEY;

  return (userId, event) => {
    const url = `${nextjsUrl}/api/internal/realtime`;

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceKey ? { "x-service-key": serviceKey } : {}),
      },
      body: JSON.stringify({ userId, event }),
    }).catch((err) => {
      console.error("[imap-sync] failed to publish realtime event:", err.message);
    });
  };
}

const MAX_EMAIL_HEADER_COUNT = 200;
const MAX_EMAIL_HEADER_VALUE_LENGTH = 4000;

function uniqueStrings(values: (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function extractAddresses(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const addressObject = value as { value?: unknown };
  if (!Array.isArray(addressObject.value)) return [];
  const list = addressObject.value as { address?: unknown }[];
  return uniqueStrings(
    list.map((entry) => (typeof entry.address === "string" ? entry.address.toLowerCase() : null))
  );
}

function normalizeHeaderValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractEmailHeaders(parsed: ParsedMail): Array<{ name: string; value: string }> {
  const data: Array<{ name: string; value: string }> = [];
  for (const [rawName, rawValue] of parsed.headers) {
    const name = typeof rawName === "string" ? rawName.trim() : "";
    if (!name) continue;

    const value = normalizeHeaderValue(rawValue);
    const trimmedValue = value?.trim();
    if (!trimmedValue) continue;

    data.push({ name, value: trimmedValue.slice(0, MAX_EMAIL_HEADER_VALUE_LENGTH) });
    if (data.length >= MAX_EMAIL_HEADER_COUNT) break;
  }
  return data;
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [values];
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Saves raw email content to file storage.
 * Returns the storage path.
 */
async function saveRawContent(
  emailId: string,
  raw: string,
  date: Date,
  storage: StorageProvider
): Promise<string> {
  const path = generateRawContentPath(emailId, date);
  await storage.write(path, raw);
  return path;
}

/**
 * Processes and saves email attachments.
 * Returns attachment records for database creation.
 */
async function processAttachments(
  attachments: Attachment[],
  emailId: string,
  date: Date,
  storage: StorageProvider,
  storageBackend: StoredFileBackendMarker,
  debug?: boolean
): Promise<Array<{ id: string; filename: string; contentType: string; size: number; path: string; storageBackend: StoredFileBackendMarker }>> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const maxSize = getMaxAttachmentSize();
  const records: Array<{ id: string; filename: string; contentType: string; size: number; path: string; storageBackend: StoredFileBackendMarker }> = [];

  for (const attachment of attachments) {
    // Skip attachments that are too large
    if (attachment.size > maxSize) {
      if (debug) {
        console.log(`[imap-sync] skipping attachment ${attachment.filename}: size ${attachment.size} exceeds max ${maxSize}`);
      }
      continue;
    }

    // Skip if no content
    if (!attachment.content) {
      continue;
    }

    const attachmentId = `${emailId}-${records.length}`;
    const filename = attachment.filename || "unnamed";
    const contentType = attachment.contentType || "application/octet-stream";
    const size = attachment.size || attachment.content.length;

    try {
      const path = generateAttachmentPath(attachmentId, filename, date);
      await storage.write(path, attachment.content);

      records.push({
        id: attachmentId,
        filename,
        contentType,
        size,
        path,
        storageBackend,
      });
    } catch (error) {
      if (debug) {
        console.error(`[imap-sync] failed to save attachment ${filename}:`, error);
      }
    }
  }

  return records;
}

async function processMessage(
  domain: ImapDomain,
  uid: number | null,
  raw: string,
  now: Date,
  options: SyncOptions
): Promise<{ processed: boolean; error?: string }> {
  const isPersonalDomain = domain.sourceType === "PERSONAL_IMAP";
  const parsed = await simpleParser(raw);
  const parsedHeaders = extractEmailHeaders(parsed);
  const parsedMessageId =
    typeof parsed.messageId === "string" && parsed.messageId.trim()
      ? parsed.messageId.trim()
      : uid
        ? `imap:${domain.id}:${uid}`
        : null;

  const parsedRecipients = uniqueStrings([
    ...extractAddresses(parsed.to),
    ...extractAddresses(parsed.cc),
    ...extractAddresses(parsed.bcc),
  ]);
  const recipients = isPersonalDomain
    ? []
    : parsedRecipients.filter((addr) => addr.endsWith(`@${domain.name.toLowerCase()}`));

  let personalMailbox:
    | { id: string; userId: string; address: string; archivedAt: Date | null }
    | null = null;
  if (isPersonalDomain) {
    personalMailbox = await prisma.mailbox.findFirst({
      where: {
        domainId: domain.id,
        kind: "PERSONAL_IMAP",
        status: "ACTIVE",
      },
      select: { id: true, userId: true, address: true, archivedAt: true },
    });
    if (!personalMailbox) {
      return { processed: false };
    }
  }

  if (!isPersonalDomain && recipients.length === 0) {
    return { processed: false };
  }

  const fromEntry = Array.isArray(parsed.from?.value) ? parsed.from.value[0] : undefined;
  const fromAddress =
    typeof fromEntry?.address === "string" ? fromEntry.address : "unknown@unknown.com";
  const fromName = typeof fromEntry?.name === "string" ? fromEntry.name : null;
  const receivedAt = parsed.date ? new Date(parsed.date) : now;
  const normalizedSubject = parsed.subject || "(No subject)";
  const textBody = parsed.text || undefined;
  const htmlBody = typeof parsed.html === "string" ? parsed.html : undefined;

  let processedAny = false;

  const targetAddresses = isPersonalDomain ? [personalMailbox!.address] : recipients;

  for (const toAddress of targetAddresses) {
    const mailbox = isPersonalDomain
      ? personalMailbox
      : await prisma.mailbox.findFirst({
          where: { address: toAddress, domainId: domain.id, status: "ACTIVE" },
          select: { id: true, userId: true, address: true, archivedAt: true },
        });

    if (!mailbox && !isPersonalDomain && domain.inboundPolicy === "KNOWN_ONLY") {
      continue;
    }

    // Generate a unique ID for file storage (used for both InboundEmail and Email)
    const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const maxAttachmentSize = getMaxAttachmentSize();
    const predictedRawBytes = raw ? Buffer.byteLength(raw, "utf8") : 0;
    const predictedAttachmentStats = (parsed.attachments || []).reduce(
      (acc, attachment) => {
        if (!attachment.content) return acc;
        const size = Math.max(0, attachment.size || attachment.content.length || 0);
        if (size > maxAttachmentSize) return acc;
        acc.bytes += size;
        acc.files += 1;
        return acc;
      },
      { bytes: 0, files: 0 }
    );

    let storageAllowed = true;
    if (mailbox && (predictedRawBytes > 0 || predictedAttachmentStats.files > 0)) {
      const check = await canStoreForUser({
        userId: mailbox.userId,
        additionalBytes: predictedRawBytes + predictedAttachmentStats.bytes,
        additionalFiles: (predictedRawBytes > 0 ? 1 : 0) + predictedAttachmentStats.files,
      });
      storageAllowed = check.allowed;
    }

    const activeStorageBackend = await getActiveStorageBackend();
    const storageBackend = toStoredFileBackendMarker(activeStorageBackend);
    const storage = getStorageForBackend(activeStorageBackend);

    // Save raw content to file
    let rawContentPath: string | undefined;
    let rawStorageBackend: StoredFileBackendMarker | undefined;
    if (raw && storageAllowed) {
      try {
        rawContentPath = await saveRawContent(tempId, raw, receivedAt, storage);
        rawStorageBackend = storageBackend;
      } catch (error) {
        if (options.debug) {
          console.error(`[imap-sync] failed to save raw content:`, error);
        }
        // Fall back to database storage if file storage fails
      }
    }

    try {
      await prisma.inboundEmail.create({
        data: {
          sourceType: domain.sourceType,
          messageId: parsedMessageId || undefined,
          fromAddress,
          fromName,
          toAddress,
          subject: normalizedSubject,
          textBody,
          htmlBody,
          rawContentPath,
          rawStorageBackend,
          receivedAt,
          domainId: domain.id,
          mailboxId: mailbox?.id,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
        throw error;
      }
    }

    if (!mailbox) continue;

    if (parsedMessageId) {
      const existing = await prisma.email.findFirst({
        where: { messageId: parsedMessageId, mailboxId: mailbox.id },
        select: { id: true },
      });
      if (existing) continue;
    }

    // Process attachments
    const attachmentRecords = storageAllowed
      ? await processAttachments(
          parsed.attachments || [],
          tempId,
          receivedAt,
          storage,
          storageBackend,
          options.debug
        )
      : [];

    const storageBytes =
      (rawContentPath ? predictedRawBytes : 0) +
      attachmentRecords.reduce((sum, item) => sum + Math.max(0, item.size || 0), 0);
    const storageFiles = (rawContentPath ? 1 : 0) + attachmentRecords.length;

    const email = await prisma.$transaction(async (tx) => {
      const created = await tx.email.create({
        data: {
          messageId: parsedMessageId || undefined,
          fromAddress,
          fromName,
          toAddress,
          subject: normalizedSubject,
          textBody,
          htmlBody,
          rawContentPath,
          rawStorageBackend,
          storageBytes,
          storageFiles,
          storageTruncated: !storageAllowed,
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

    processedAny = true;

    const isArchivedMailbox = mailbox.archivedAt !== null;
    if (options.publishRealtimeEvent && !isArchivedMailbox) {
      options.publishRealtimeEvent(mailbox.userId, {
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
    }

    if (!isArchivedMailbox) {
      triggerEmailWorkflows(email, mailbox.id, mailbox.userId).catch((err) => {
        if (options.debug) {
          console.error(`[imap-sync] workflow trigger error for ${email.id}:`, err);
        }
      });
    }
  }

  return { processed: processedAny };
}

export async function syncUnseenMessages(
  client: ImapFlow,
  domain: ImapDomain,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const now = new Date();
  const rawUnseen = await client.search({ seen: false }, { uid: true });
  const unseen = Array.isArray(rawUnseen) ? rawUnseen : [];

  if (unseen.length === 0) {
    return { success: true, processed: 0, errors: 0 };
  }

  // 获取当前的 lastSyncedUid，用于后续更新
  const config = await prisma.imapConfig.findUnique({
    where: { domainId: domain.id },
    select: { lastSyncedUid: true },
  });
  const currentLastSyncedUid = config?.lastSyncedUid || 0;

  const batches = chunkArray(unseen, 200);
  let processedCount = 0;
  let errorCount = 0;
  let highestUid = currentLastSyncedUid;

  for (const batch of batches) {
    if (batch.length === 0) continue;
    const uidsToMarkSeen: number[] = [];

    for await (const message of client.fetch(batch, { uid: true, source: true, envelope: true }, { uid: true })) {
      const uid = typeof message.uid === "number" ? message.uid : null;
      const raw = message.source?.toString("utf8") || "";

      if (uid && uid > highestUid) {
        highestUid = uid;
      }

      try {
        const result = await processMessage(domain, uid, raw, now, options);
        if (result.processed) {
          processedCount++;
        }
      } catch (err) {
        errorCount++;
        if (options.debug) {
          console.error(`[imap-sync] error processing message uid=${uid}:`, err);
        }
      }

      if (uid) {
        uidsToMarkSeen.push(uid);
      }
    }

    if (uidsToMarkSeen.length > 0) {
      await client.messageFlagsAdd(uidsToMarkSeen, ["\\Seen"], { uid: true, silent: true });
    }
  }

  await prisma.imapConfig.update({
    where: { domainId: domain.id },
    data: {
      lastSync: now,
      // 更新 lastSyncedUid，避免重连时重复下载
      ...(highestUid > currentLastSyncedUid ? { lastSyncedUid: highestUid } : {}),
    },
  });

  if (domain.sourceType === "PERSONAL_IMAP") {
    await prisma.personalImapAccount.updateMany({
      where: { domainId: domain.id },
      data: {
        lastSync: now,
        status: "ACTIVE",
        consecutiveErrors: 0,
        lastError: null,
        ...(highestUid > currentLastSyncedUid ? { lastSyncedUid: highestUid } : {}),
      },
    });
  }

  if (domain.status === "PENDING" || domain.status === "ERROR") {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: "ACTIVE" },
    });
  }

  if (options.debug) {
    console.log(`[imap-sync] domain=${domain.name} unseen=${unseen.length} processed=${processedCount} errors=${errorCount}`);
  }

  return {
    success: true,
    processed: processedCount,
    errors: errorCount,
    newHighestUid: highestUid > 0 ? highestUid : undefined,
  };
}

export async function syncByUidRange(
  client: ImapFlow,
  domain: ImapDomain,
  mailbox: MailboxObject,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const now = new Date();
  // NOTE: `domain.imapConfig` is a snapshot from when the worker was created.
  // Sync state (lastSyncedUid/lastUidValidity) must be read fresh from DB or we'll
  // repeatedly re-fetch the same UID ranges on periodic sync (e.g. daily full sync).
  const state = await prisma.imapConfig.findUnique({
    where: { domainId: domain.id },
    select: { lastSyncedUid: true, lastUidValidity: true },
  });
  const lastSyncedUid = state?.lastSyncedUid ?? 0;

  const currentUidValidity = mailbox.uidValidity ? BigInt(mailbox.uidValidity) : null;
  const storedUidValidity = state?.lastUidValidity ?? null;

  // Check if UIDVALIDITY changed (mailbox was rebuilt)
  const uidValidityChanged =
    currentUidValidity !== null &&
    storedUidValidity !== null &&
    currentUidValidity !== storedUidValidity;

  if (uidValidityChanged) {
    if (options.debug) {
      console.log(`[imap-sync] UIDVALIDITY changed for ${domain.name}, forcing full sync`);
    }
    // Reset the last synced UID since mailbox was rebuilt
    await prisma.imapConfig.update({
      where: { domainId: domain.id },
      data: {
        lastSyncedUid: null,
        lastUidValidity: currentUidValidity,
      },
    });
  }

  // Calculate UID range to fetch
  const startUid = uidValidityChanged ? 1 : lastSyncedUid + 1;
  const endUid = mailbox.uidNext ? Number(mailbox.uidNext) - 1 : "*";

  if (options.debug) {
    console.log(
      "[imap-sync] uid-range state",
      JSON.stringify({
        domain: domain.name,
        lastSyncedUid,
        startUid,
        endUid,
        uidValidity: currentUidValidity?.toString() ?? null,
        storedUidValidity: storedUidValidity?.toString() ?? null,
      }),
    );
  }

  if (typeof endUid === "number" && startUid > endUid) {
    // No new messages
    return { success: true, processed: 0, errors: 0, uidValidity: currentUidValidity ?? undefined };
  }

  const uidRange = `${startUid}:${endUid === "*" ? "*" : endUid}`;

  let uids: number[];
  try {
    const searchResult = await client.search({ uid: uidRange }, { uid: true });
    uids = Array.isArray(searchResult) ? searchResult : [];
  } catch {
    // Range might be invalid
    return { success: true, processed: 0, errors: 0, uidValidity: currentUidValidity ?? undefined };
  }

  if (uids.length === 0) {
    return { success: true, processed: 0, errors: 0, uidValidity: currentUidValidity ?? undefined };
  }

  const batches = chunkArray(uids, 200);
  let processedCount = 0;
  let errorCount = 0;
  let highestUid = uidValidityChanged ? 0 : lastSyncedUid;

  for (const batch of batches) {
    if (batch.length === 0) continue;

    for await (const message of client.fetch(batch, { uid: true, source: true, envelope: true }, { uid: true })) {
      const uid = typeof message.uid === "number" ? message.uid : null;
      const raw = message.source?.toString("utf8") || "";

      if (uid && uid > highestUid) {
        highestUid = uid;
      }

      try {
        const result = await processMessage(domain, uid, raw, now, options);
        if (result.processed) {
          processedCount++;
        }
      } catch (err) {
        errorCount++;
        if (options.debug) {
          console.error(`[imap-sync] error processing message uid=${uid}:`, err);
        }
      }
    }
  }

  // Update sync state
  await prisma.imapConfig.update({
    where: { domainId: domain.id },
    data: {
      lastSync: now,
      lastFullSync: now,
      lastSyncedUid: highestUid > 0 ? highestUid : undefined,
      lastUidValidity: currentUidValidity,
      consecutiveErrors: 0,
      lastError: null,
    },
  });

  if (domain.sourceType === "PERSONAL_IMAP") {
    await prisma.personalImapAccount.updateMany({
      where: { domainId: domain.id },
      data: {
        lastSync: now,
        lastSyncedUid: highestUid > 0 ? highestUid : undefined,
        lastUidValidity: currentUidValidity,
        status: "ACTIVE",
        consecutiveErrors: 0,
        lastError: null,
      },
    });
  }

  if (domain.status === "PENDING" || domain.status === "ERROR") {
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: "ACTIVE" },
    });
  }

  if (options.debug) {
    console.log(`[imap-sync] domain=${domain.name} uid-range sync processed=${processedCount} errors=${errorCount} highestUid=${highestUid}`);
  }

  return {
    success: true,
    processed: processedCount,
    errors: errorCount,
    newHighestUid: highestUid > 0 ? highestUid : undefined,
    uidValidity: currentUidValidity ?? undefined,
  };
}

export async function recordSyncError(domainId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.imapConfig.update({
    where: { domainId },
    data: {
      consecutiveErrors: { increment: 1 },
      lastError: message.slice(0, 500),
    },
  });

  await prisma.personalImapAccount.updateMany({
    where: { domainId },
    data: {
      consecutiveErrors: { increment: 1 },
      lastError: message.slice(0, 500),
      status: "ERROR",
    },
  });
}

export async function resetSyncErrors(domainId: string): Promise<void> {
  await prisma.imapConfig.update({
    where: { domainId },
    data: {
      consecutiveErrors: 0,
      lastError: null,
    },
  });

  await prisma.personalImapAccount.updateMany({
    where: { domainId },
    data: {
      consecutiveErrors: 0,
      lastError: null,
      status: "ACTIVE",
    },
  });
}
