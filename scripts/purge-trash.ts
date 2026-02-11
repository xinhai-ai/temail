import prisma from "@/lib/prisma";
import { deleteByRecordStorage } from "@/lib/storage/record-storage";

type Args = {
  dryRun: boolean;
  limit?: number;
  userId?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--limit") {
      const raw = argv[i + 1];
      i += 1;
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--limit must be a positive integer");
      }
      args.limit = parsed;
      continue;
    }
    if (token === "--user") {
      const raw = argv[i + 1];
      i += 1;
      if (!raw) throw new Error("--user requires a user id");
      args.userId = raw;
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

async function main() {
  const { dryRun, limit, userId } = parseArgs(process.argv.slice(2));
  const now = new Date();

  const users = await prisma.user.findMany({
    select: { id: true, trashRetentionDays: true },
    ...(userId ? { where: { id: userId } } : {}),
  });

  let scannedUsers = 0;
  let eligibleUsers = 0;
  let scannedEmails = 0;
  let purgedEmails = 0;
  let skippedEmails = 0;
  let failedEmails = 0;

  for (const user of users) {
    scannedUsers += 1;

    const retentionDays = user.trashRetentionDays;
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      continue;
    }

    eligibleUsers += 1;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const emails = await prisma.email.findMany({
      where: {
        mailbox: { userId: user.id },
        status: "DELETED",
        deletedAt: { not: null, lt: cutoff },
      },
      select: {
        id: true,
        mailboxId: true,
        deletedAt: true,
        rawContentPath: true,
        rawStorageBackend: true,
        attachments: { select: { path: true, storageBackend: true } },
      },
      orderBy: [{ deletedAt: "asc" }, { id: "asc" }],
      ...(typeof limit === "number" ? { take: limit } : {}),
    });

    if (emails.length === 0) continue;

    console.log(`[purge-trash] user=${user.id} retentionDays=${retentionDays} candidates=${emails.length}`);

    for (const email of emails) {
      scannedEmails += 1;

      const deletedAtIso = email.deletedAt ? email.deletedAt.toISOString() : "null";
      if (dryRun) {
        console.log(`[purge-trash] [dry-run] purge email=${email.id} deletedAt=${deletedAtIso}`);
        skippedEmails += 1;
        continue;
      }

      try {
        if (email.rawContentPath) {
          await deleteByRecordStorage(email.rawContentPath, email.rawStorageBackend);
        }

        for (const attachment of email.attachments) {
          await deleteByRecordStorage(attachment.path, attachment.storageBackend);
        }

        await prisma.email.delete({ where: { id: email.id } });
        purgedEmails += 1;
      } catch (error) {
        failedEmails += 1;
        console.error(`[purge-trash] failed email=${email.id}:`, error);
      }
    }
  }

  console.log("[purge-trash] done", {
    dryRun,
    scannedUsers,
    eligibleUsers,
    scannedEmails,
    purgedEmails,
    skippedEmails,
    failedEmails,
  });
}

main()
  .catch((error) => {
    console.error("[purge-trash] fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
