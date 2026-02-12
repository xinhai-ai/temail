-- users: global retention policy defaults
ALTER TABLE "users" ADD COLUMN "mailboxExpireDays" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "users" ADD COLUMN "mailboxExpireAction" TEXT NOT NULL DEFAULT 'ARCHIVE';
ALTER TABLE "users" ADD COLUMN "emailExpireDays" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "users" ADD COLUMN "emailExpireAction" TEXT NOT NULL DEFAULT 'ARCHIVE';

-- mailboxes: per-mailbox retention overrides and activity timestamp
ALTER TABLE "mailboxes" ADD COLUMN "lastEmailReceivedAt" DATETIME;
ALTER TABLE "mailboxes" ADD COLUMN "expireMailboxDaysOverride" INTEGER;
ALTER TABLE "mailboxes" ADD COLUMN "expireMailboxActionOverride" TEXT;
ALTER TABLE "mailboxes" ADD COLUMN "expireEmailDaysOverride" INTEGER;
ALTER TABLE "mailboxes" ADD COLUMN "expireEmailActionOverride" TEXT;

CREATE INDEX "mailboxes_lastEmailReceivedAt_idx" ON "mailboxes"("lastEmailReceivedAt");
