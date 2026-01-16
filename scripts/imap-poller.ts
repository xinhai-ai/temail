import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { Prisma, type Domain, type ImapConfig } from "@prisma/client";
import prisma from "../src/lib/prisma";
import { executeForwards } from "../src/services/forward";

type ImapDomain = Domain & { imapConfig: ImapConfig };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueStrings(values: (string | null | undefined)[]) {
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

async function pollDomain(domain: ImapDomain) {
  const now = new Date();
  const { imapConfig } = domain;

  if (domain.status === "INACTIVE") return;

  if (imapConfig.lastSync) {
    const nextSyncAt = imapConfig.lastSync.getTime() + imapConfig.syncInterval * 1000;
    if (Date.now() < nextSyncAt) return;
  }

  const lookbackMinutes = parseInt(process.env.IMAP_LOOKBACK_MINUTES || "120", 10);
  const since = imapConfig.lastSync
    ? new Date(imapConfig.lastSync.getTime() - 5 * 60 * 1000)
    : new Date(Date.now() - lookbackMinutes * 60 * 1000);

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: {
      user: imapConfig.username,
      pass: imapConfig.password,
    },
    logger: false,
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since });
      if (!uids || uids.length === 0) return;

      for await (const message of client.fetch(uids, { uid: true, source: true, envelope: true })) {
        const uid = typeof message.uid === "number" ? message.uid : null;
        const raw = message.source?.toString("utf8") || "";

        const parsed = await simpleParser(raw);
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

        if (recipients.length === 0) continue;

        const fromEntry = Array.isArray(parsed.from?.value) ? parsed.from.value[0] : undefined;
        const fromAddress =
          typeof fromEntry?.address === "string" ? fromEntry.address : "unknown@unknown.com";
        const fromName = typeof fromEntry?.name === "string" ? fromEntry.name : null;
        const receivedAt = parsed.date ? new Date(parsed.date) : now;
        const normalizedSubject = parsed.subject || "(No subject)";
        const textBody = parsed.text || undefined;
        const htmlBody = typeof parsed.html === "string" ? parsed.html : undefined;

        for (const toAddress of recipients) {
          const mailbox = await prisma.mailbox.findFirst({
            where: { address: toAddress, domainId: domain.id, status: "ACTIVE" },
            select: { id: true, userId: true },
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
            },
          });

          executeForwards(email, mailbox.id, mailbox.userId).catch(console.error);
        }
      }
    } finally {
      lock.release();
    }

    await prisma.imapConfig.update({
      where: { domainId: domain.id },
      data: { lastSync: now },
    });

    if (domain.status === "PENDING" || domain.status === "ERROR") {
      await prisma.domain.update({
        where: { id: domain.id },
        data: { status: "ACTIVE" },
      });
    }
  } catch (error) {
    console.error(`[imap] domain=${domain.name} error:`, error);
    await prisma.domain.update({
      where: { id: domain.id },
      data: { status: "ERROR" },
    });
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
  }
}

async function pollAllOnce() {
  const domains = await prisma.domain.findMany({
    where: { sourceType: "IMAP" },
    include: { imapConfig: true },
    orderBy: { createdAt: "asc" },
  });

  const imapDomains = domains.filter((d): d is ImapDomain => Boolean(d.imapConfig));
  for (const domain of imapDomains) {
    await pollDomain(domain);
  }
}

async function main() {
  const watch = process.argv.includes("--watch");
  const intervalMs = parseInt(process.env.IMAP_LOOP_INTERVAL_MS || "30000", 10);

  if (!watch) {
    await pollAllOnce();
    return;
  }

  for (;;) {
    await pollAllOnce();
    await sleep(intervalMs);
  }
}

main()
  .catch((error) => {
    console.error("[imap] fatal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
