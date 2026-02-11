-- AlterTable
ALTER TABLE "emails" ADD COLUMN "rawStorageBackend" TEXT;

-- AlterTable
ALTER TABLE "inbound_emails" ADD COLUMN "rawStorageBackend" TEXT;

-- AlterTable
ALTER TABLE "attachments" ADD COLUMN "storageBackend" TEXT;
