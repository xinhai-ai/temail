import { ImapFlow, type MailboxObject } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { Prisma, type Domain, type ImapConfig } from "@prisma/client";
import prisma from "@/lib/prisma";
import { executeForwards } from "@/services/forward";
import { triggerEmailWorkflows } from "@/services/workflow/trigger";

export type ImapDomain = Domain & { imapConfig: ImapConfig };

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

async function processMessage(
  domain: ImapDomain,
  uid: number | null,
  raw: string,
  now: Date,
  options: SyncOptions
): Promise<{ processed: boolean; error?: string }> {
  const parsed = await simpleParser(raw);
  const parsedHeaders = extractEmailHeaders(parsed);
  const parsedMessageId =
    typeof parsed.messageId === "string" && parsed.messageId.trim()
      ? parsed.messageId.trim()
      : uid
        ? `imap:${domain.id}:${uid}`
        : null;

  const recipients = uniqueStrings([
    ...extractAddresses(parsed.to),
    ...extractAddresses(parsed.cc),
    ...extractAddresses(parsed.bcc),
  ]).filter((addr) => addr.endsWith(`@${domain.name.toLowerCase()}`));

  if (recipients.length === 0) {
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

  for (const toAddress of recipients) {
    const mailbox = await prisma.mailbox.findFirst({
      where: { address: toAddress, domainId: domain.id, status: "ACTIVE" },
      select: { id: true, userId: true, address: true },
    });

    try {
      await prisma.inboundEmail.create({
        data: {
          sourceType: "IMAP",
          messageId: parsedMessageId || undefined,
          fromAddress,
          fromName,
          toAddress,
          subject: normalizedSubject,
          textBody,
          htmlBody,
          rawContent: raw || undefined,
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

    const email = await prisma.email.create({
      data: {
        messageId: parsedMessageId || undefined,
        fromAddress,
        fromName,
        toAddress,
        subject: normalizedSubject,
        textBody,
        htmlBody,
        rawContent: raw || undefined,
        mailboxId: mailbox.id,
        receivedAt,
        ...(parsedHeaders.length ? { headers: { create: parsedHeaders } } : {}),
      },
    });

    processedAny = true;

    if (options.publishRealtimeEvent) {
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

    executeForwards(email, mailbox.id, mailbox.userId).catch((err) => {
      if (options.debug) {
        console.error(`[imap-sync] forward error for ${email.id}:`, err);
      }
    });

    triggerEmailWorkflows(email, mailbox.id, mailbox.userId).catch((err) => {
      if (options.debug) {
        console.error(`[imap-sync] workflow trigger error for ${email.id}:`, err);
      }
    });
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
  const config = domain.imapConfig;

  const currentUidValidity = mailbox.uidValidity ? BigInt(mailbox.uidValidity) : null;
  const storedUidValidity = config.lastUidValidity;

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
  const startUid = uidValidityChanged ? 1 : (config.lastSyncedUid || 0) + 1;
  const endUid = mailbox.uidNext ? Number(mailbox.uidNext) - 1 : "*";

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
  let highestUid = config.lastSyncedUid || 0;

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
}

export async function resetSyncErrors(domainId: string): Promise<void> {
  await prisma.imapConfig.update({
    where: { domainId },
    data: {
      consecutiveErrors: 0,
      lastError: null,
    },
  });
}
