-- Migration: trash_inbound_policy
-- Description: Add trash retention settings, email trash metadata, and domain inbound policy

-- users: per-user trash retention days (0 = never auto purge)
ALTER TABLE "users" ADD COLUMN "trashRetentionDays" INTEGER NOT NULL DEFAULT 30;

-- domains: inbound policy (catch-all vs known-only)
ALTER TABLE "domains" ADD COLUMN "inboundPolicy" TEXT NOT NULL DEFAULT 'CATCH_ALL';

-- emails: soft-delete metadata
ALTER TABLE "emails" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "emails" ADD COLUMN "restoreStatus" TEXT;

-- Backfill legacy deleted emails (if any)
UPDATE "emails"
SET
  "deletedAt" = COALESCE("deletedAt", "createdAt"),
  "restoreStatus" = COALESCE("restoreStatus", 'READ')
WHERE "status" = 'DELETED';

-- Index for purge queries
CREATE INDEX "emails_deletedAt_idx" ON "emails"("deletedAt");

