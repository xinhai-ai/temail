-- CreateEnum
CREATE TYPE "DomainInboundPolicy" AS ENUM ('CATCH_ALL', 'KNOWN_ONLY');

-- CreateEnum
CREATE TYPE "EmailRestoreStatus" AS ENUM ('UNREAD', 'READ');

-- users: per-user trash retention days (0 = never auto purge)
ALTER TABLE "users" ADD COLUMN "trashRetentionDays" INTEGER NOT NULL DEFAULT 30;

-- domains: inbound policy (catch-all vs known-only)
ALTER TABLE "domains" ADD COLUMN "inboundPolicy" "DomainInboundPolicy" NOT NULL DEFAULT 'CATCH_ALL';

-- emails: soft-delete metadata
ALTER TABLE "emails" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "emails" ADD COLUMN "restoreStatus" "EmailRestoreStatus";

-- Backfill legacy deleted emails (if any)
UPDATE "emails"
SET
  "deletedAt" = COALESCE("deletedAt", "createdAt"),
  "restoreStatus" = COALESCE("restoreStatus", 'READ')
WHERE "status" = 'DELETED';

-- Index for purge queries
CREATE INDEX "emails_deletedAt_idx" ON "emails"("deletedAt");

