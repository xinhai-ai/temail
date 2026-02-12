import type { RetentionAction } from "@prisma/client";
import prisma from "@/lib/prisma";
import { purgeEmailById } from "@/services/email-trash";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RunRetentionJobOptions = {
  dryRun?: boolean;
  userId?: string;
  limit?: number;
  now?: Date;
};

export type RetentionJobResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  dryRun: boolean;
  userId?: string;
  limit?: number;
  mailbox: {
    scanned: number;
    expired: number;
    archived: number;
    deleted: number;
    purgedEmails: number;
    skippedNever: number;
    invalidPolicy: number;
    failed: number;
  };
  email: {
    scanned: number;
    expired: number;
    archived: number;
    deleted: number;
    skippedNever: number;
    invalidPolicy: number;
    failed: number;
  };
  trash: {
    scannedUsers: number;
    eligibleUsers: number;
    scannedEmails: number;
    purgedEmails: number;
    skippedEmails: number;
    failedEmails: number;
  };
};

function parseLimit(limit: number | undefined): number | undefined {
  if (typeof limit !== "number") return undefined;
  if (!Number.isFinite(limit)) return undefined;
  const normalized = Math.trunc(limit);
  if (normalized <= 0) return undefined;
  return Math.min(normalized, 10_000);
}

function isValidPolicyDays(days: number): boolean {
  return Number.isFinite(days) && Number.isInteger(days) && (days === -1 || days > 0);
}

function isExpired(baseTime: Date, days: number, now: Date): boolean {
  const expiresAt = new Date(baseTime.getTime() + days * DAY_MS);
  return expiresAt.getTime() <= now.getTime();
}

async function deleteMailboxPermanently(mailboxId: string): Promise<number> {
  let purgedEmails = 0;

  while (true) {
    const emails = await prisma.email.findMany({
      where: { mailboxId },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 200,
    });

    if (emails.length === 0) break;

    for (const email of emails) {
      const purged = await purgeEmailById({ emailId: email.id });
      if (purged) purgedEmails += 1;
    }
  }

  await prisma.mailbox.delete({ where: { id: mailboxId } });
  return purgedEmails;
}

async function runMailboxRetention(options: {
  dryRun: boolean;
  now: Date;
  userId?: string;
  limit?: number;
}): Promise<RetentionJobResult["mailbox"]> {
  const stats: RetentionJobResult["mailbox"] = {
    scanned: 0,
    expired: 0,
    archived: 0,
    deleted: 0,
    purgedEmails: 0,
    skippedNever: 0,
    invalidPolicy: 0,
    failed: 0,
  };

  const candidates = await prisma.mailbox.findMany({
    where: {
      status: "ACTIVE",
      archivedAt: null,
      ...(options.userId ? { userId: options.userId } : {}),
    },
    select: {
      id: true,
      createdAt: true,
      lastEmailReceivedAt: true,
      expireMailboxDaysOverride: true,
      expireMailboxActionOverride: true,
      user: {
        select: {
          mailboxExpireDays: true,
          mailboxExpireAction: true,
        },
      },
    },
    orderBy: [{ lastEmailReceivedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    ...(typeof options.limit === "number" ? { take: options.limit } : {}),
  });

  stats.scanned = candidates.length;

  for (const mailbox of candidates) {
    const effectiveDays = mailbox.expireMailboxDaysOverride ?? mailbox.user.mailboxExpireDays;
    const effectiveAction: RetentionAction =
      mailbox.expireMailboxActionOverride ?? mailbox.user.mailboxExpireAction;

    if (!isValidPolicyDays(effectiveDays)) {
      stats.invalidPolicy += 1;
      continue;
    }

    if (effectiveDays === -1) {
      stats.skippedNever += 1;
      continue;
    }

    const baseline = mailbox.lastEmailReceivedAt ?? mailbox.createdAt;
    if (!isExpired(baseline, effectiveDays, options.now)) {
      continue;
    }

    stats.expired += 1;

    if (options.dryRun) {
      if (effectiveAction === "ARCHIVE") stats.archived += 1;
      else stats.deleted += 1;
      continue;
    }

    try {
      if (effectiveAction === "ARCHIVE") {
        const updated = await prisma.mailbox.updateMany({
          where: { id: mailbox.id, status: "ACTIVE", archivedAt: null },
          data: { archivedAt: options.now },
        });

        if (updated.count > 0) {
          stats.archived += 1;
        }
      } else {
        const purgedEmails = await deleteMailboxPermanently(mailbox.id);
        stats.deleted += 1;
        stats.purgedEmails += purgedEmails;
      }
    } catch (error) {
      stats.failed += 1;
      console.error("[retention] mailbox stage failed:", { mailboxId: mailbox.id, error });
    }
  }

  return stats;
}

async function runEmailRetention(options: {
  dryRun: boolean;
  now: Date;
  userId?: string;
  limit?: number;
}): Promise<RetentionJobResult["email"]> {
  const stats: RetentionJobResult["email"] = {
    scanned: 0,
    expired: 0,
    archived: 0,
    deleted: 0,
    skippedNever: 0,
    invalidPolicy: 0,
    failed: 0,
  };

  const candidates = await prisma.email.findMany({
    where: {
      status: { in: ["UNREAD", "READ"] },
      ...(options.userId ? { mailbox: { userId: options.userId } } : {}),
    },
    select: {
      id: true,
      status: true,
      receivedAt: true,
      mailbox: {
        select: {
          expireEmailDaysOverride: true,
          expireEmailActionOverride: true,
          user: {
            select: {
              emailExpireDays: true,
              emailExpireAction: true,
            },
          },
        },
      },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    ...(typeof options.limit === "number" ? { take: options.limit } : {}),
  });

  stats.scanned = candidates.length;

  for (const email of candidates) {
    const effectiveDays = email.mailbox.expireEmailDaysOverride ?? email.mailbox.user.emailExpireDays;
    const effectiveAction: RetentionAction =
      email.mailbox.expireEmailActionOverride ?? email.mailbox.user.emailExpireAction;

    if (!isValidPolicyDays(effectiveDays)) {
      stats.invalidPolicy += 1;
      continue;
    }

    if (effectiveDays === -1) {
      stats.skippedNever += 1;
      continue;
    }

    if (!isExpired(email.receivedAt, effectiveDays, options.now)) {
      continue;
    }

    stats.expired += 1;

    if (options.dryRun) {
      if (effectiveAction === "ARCHIVE") stats.archived += 1;
      else stats.deleted += 1;
      continue;
    }

    try {
      if (effectiveAction === "ARCHIVE") {
        const result = await prisma.email.updateMany({
          where: { id: email.id, status: { in: ["UNREAD", "READ"] } },
          data: { status: "ARCHIVED" },
        });

        if (result.count > 0) stats.archived += 1;
        continue;
      }

      const restoreStatus = email.status === "UNREAD" ? "UNREAD" : "READ";
      const result = await prisma.email.updateMany({
        where: { id: email.id, status: email.status },
        data: {
          status: "DELETED",
          deletedAt: options.now,
          restoreStatus,
        },
      });

      if (result.count > 0) stats.deleted += 1;
    } catch (error) {
      stats.failed += 1;
      console.error("[retention] email stage failed:", { emailId: email.id, error });
    }
  }

  return stats;
}

async function runTrashPurge(options: {
  dryRun: boolean;
  now: Date;
  userId?: string;
  limit?: number;
}): Promise<RetentionJobResult["trash"]> {
  const stats: RetentionJobResult["trash"] = {
    scannedUsers: 0,
    eligibleUsers: 0,
    scannedEmails: 0,
    purgedEmails: 0,
    skippedEmails: 0,
    failedEmails: 0,
  };

  const users = await prisma.user.findMany({
    select: { id: true, trashRetentionDays: true },
    ...(options.userId ? { where: { id: options.userId } } : {}),
  });

  for (const user of users) {
    stats.scannedUsers += 1;

    const retentionDays = user.trashRetentionDays;
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      continue;
    }

    stats.eligibleUsers += 1;
    const cutoff = new Date(options.now.getTime() - retentionDays * DAY_MS);

    const emails = await prisma.email.findMany({
      where: {
        mailbox: { userId: user.id },
        status: "DELETED",
        deletedAt: { not: null, lt: cutoff },
      },
      select: {
        id: true,
      },
      orderBy: [{ deletedAt: "asc" }, { id: "asc" }],
      ...(typeof options.limit === "number" ? { take: options.limit } : {}),
    });

    for (const email of emails) {
      stats.scannedEmails += 1;

      if (options.dryRun) {
        stats.skippedEmails += 1;
        continue;
      }

      try {
        const purged = await purgeEmailById({ emailId: email.id });
        if (purged) {
          stats.purgedEmails += 1;
        }
      } catch (error) {
        stats.failedEmails += 1;
        console.error("[retention] trash purge failed:", { emailId: email.id, error });
      }
    }
  }

  return stats;
}

export async function runRetentionJob(options: RunRetentionJobOptions = {}): Promise<RetentionJobResult> {
  const startedAt = Date.now();
  const now = options.now ?? new Date();
  const dryRun = options.dryRun === true;
  const limit = parseLimit(options.limit);

  const mailbox = await runMailboxRetention({
    dryRun,
    now,
    userId: options.userId,
    limit,
  });

  const email = await runEmailRetention({
    dryRun,
    now,
    userId: options.userId,
    limit,
  });

  const trash = await runTrashPurge({
    dryRun,
    now,
    userId: options.userId,
    limit,
  });

  const finishedAt = Date.now();

  return {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finishedAt).toISOString(),
    durationMs: finishedAt - startedAt,
    dryRun,
    ...(options.userId ? { userId: options.userId } : {}),
    ...(typeof limit === "number" ? { limit } : {}),
    mailbox,
    email,
    trash,
  };
}
