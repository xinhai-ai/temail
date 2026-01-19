import prisma from "@/lib/prisma";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import { executeForwards } from "@/services/forward";
import { triggerEmailWorkflows } from "@/services/workflow/trigger";
import { Prisma } from "@prisma/client";

export type RematchInboundResult = {
  scanned: number;
  matched: number;
  created: number;
  skippedDuplicates: number;
};

export async function rematchUnmatchedInboundEmailsForUser(
  userId: string,
  options: { limit?: number } = {}
): Promise<RematchInboundResult> {
  const limit = Math.max(1, Math.min(1000, options.limit ?? 200));

  const mailboxes = await prisma.mailbox.findMany({
    where: { userId, status: "ACTIVE" },
    select: { id: true, address: true, userId: true },
  });

  const addressToMailbox = new Map(mailboxes.map((mailbox) => [mailbox.address.toLowerCase(), mailbox]));
  const mailboxAddresses = Array.from(addressToMailbox.keys());
  if (mailboxAddresses.length === 0) {
    return { scanned: 0, matched: 0, created: 0, skippedDuplicates: 0 };
  }

  const inboundEmails = await prisma.inboundEmail.findMany({
    where: {
      mailboxId: null,
      toAddress: { in: mailboxAddresses },
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });

  let matched = 0;
  let created = 0;
  let skippedDuplicates = 0;

  for (const inbound of inboundEmails) {
    const mailbox = addressToMailbox.get(inbound.toAddress.toLowerCase());
    if (!mailbox) continue;

    const result = await prisma.$transaction(async (tx) => {
      const update = await tx.inboundEmail.updateMany({
        where: { id: inbound.id, mailboxId: null },
        data: { mailboxId: mailbox.id },
      });

      if (update.count === 0) {
        return { status: "skipped" as const };
      }

      if (inbound.messageId) {
        const existing = await tx.email.findFirst({
          where: { mailboxId: mailbox.id, messageId: inbound.messageId },
          select: { id: true },
        });
        if (existing) {
          return { status: "duplicate" as const };
        }
      }

      try {
        const email = await tx.email.create({
          data: {
            messageId: inbound.messageId || undefined,
            fromAddress: inbound.fromAddress || "unknown@unknown.com",
            fromName: inbound.fromName || undefined,
            toAddress: inbound.toAddress,
            subject: inbound.subject,
            textBody: inbound.textBody || undefined,
            htmlBody: inbound.htmlBody || undefined,
            rawContent: inbound.rawContent || undefined,
            rawContentPath: inbound.rawContentPath || undefined,
            receivedAt: inbound.receivedAt,
            mailboxId: mailbox.id,
          },
        });

        return { status: "created" as const, email };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { status: "duplicate" as const };
        }
        throw error;
      }
    });

    if (result.status === "skipped") continue;
    matched += 1;

    if (result.status === "duplicate") {
      skippedDuplicates += 1;
      continue;
    }

    created += 1;

    const email = result.email;

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

    executeForwards(email, mailbox.id, mailbox.userId).catch(console.error);
    triggerEmailWorkflows(email, mailbox.id, mailbox.userId).catch(console.error);
  }

  return {
    scanned: inboundEmails.length,
    matched,
    created,
    skippedDuplicates,
  };
}

