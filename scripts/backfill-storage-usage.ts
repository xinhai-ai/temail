import prisma from "@/lib/prisma";
import { getSizeByRecordStorage } from "@/lib/storage/record-storage";

async function main() {
  const batchSize = 200;
  let cursorId: string | null = null;
  let processed = 0;
  let updated = 0;

  for (;;) {
    const emails: Array<{
      id: string;
      rawContent: string | null;
      rawContentPath: string | null;
      rawStorageBackend: string | null;
      attachments: Array<{ size: number }>;
    }> = await prisma.email.findMany({
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
      orderBy: { id: "asc" },
      take: batchSize,
      select: {
        id: true,
        rawContent: true,
        rawContentPath: true,
        rawStorageBackend: true,
        attachments: {
          select: {
            size: true,
          },
        },
      },
    });

    if (emails.length === 0) break;

    for (const email of emails) {
      processed += 1;

      let rawBytes = 0;
      let rawFiles = 0;

      if (email.rawContentPath) {
        try {
          rawBytes = await getSizeByRecordStorage(email.rawContentPath, email.rawStorageBackend);
          rawFiles = rawBytes > 0 ? 1 : 0;
        } catch {
          rawBytes = 0;
          rawFiles = 0;
        }
      } else if (email.rawContent) {
        rawBytes = Buffer.byteLength(email.rawContent, "utf8");
        rawFiles = rawBytes > 0 ? 1 : 0;
      }

      const attachmentBytes = email.attachments.reduce((sum: number, item: { size: number }) => {
        return sum + Math.max(0, item.size || 0);
      }, 0);
      const attachmentFiles = email.attachments.length;

      const storageBytes = rawBytes + attachmentBytes;
      const storageFiles = rawFiles + attachmentFiles;
      const storageTruncated = storageBytes === 0 && (Boolean(email.rawContentPath) || attachmentFiles > 0);

      await prisma.email.update({
        where: { id: email.id },
        data: {
          storageBytes,
          storageFiles,
          storageTruncated,
        },
      });

      updated += 1;
    }

    cursorId = emails[emails.length - 1]?.id || null;
  }

  console.log(`Backfill done. processed=${processed}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
