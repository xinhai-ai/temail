-- AlterTable
ALTER TABLE "imap_configs" ADD COLUMN "lastSyncedUid" INTEGER;
ALTER TABLE "imap_configs" ADD COLUMN "lastUidValidity" BIGINT;
ALTER TABLE "imap_configs" ADD COLUMN "lastFullSync" DATETIME;
ALTER TABLE "imap_configs" ADD COLUMN "consecutiveErrors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "imap_configs" ADD COLUMN "lastError" TEXT;
