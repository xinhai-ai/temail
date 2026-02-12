-- CreateEnum
CREATE TYPE "RetentionAction" AS ENUM ('ARCHIVE', 'DELETE');

-- users: global retention policy defaults
ALTER TABLE "users" ADD COLUMN "mailboxExpireDays" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "users" ADD COLUMN "mailboxExpireAction" "RetentionAction" NOT NULL DEFAULT 'ARCHIVE';
ALTER TABLE "users" ADD COLUMN "emailExpireDays" INTEGER NOT NULL DEFAULT -1;
ALTER TABLE "users" ADD COLUMN "emailExpireAction" "RetentionAction" NOT NULL DEFAULT 'ARCHIVE';

-- mailboxes: per-mailbox retention overrides and activity timestamp
ALTER TABLE "mailboxes" ADD COLUMN "lastEmailReceivedAt" TIMESTAMP(3);
ALTER TABLE "mailboxes" ADD COLUMN "expireMailboxDaysOverride" INTEGER;
ALTER TABLE "mailboxes" ADD COLUMN "expireMailboxActionOverride" "RetentionAction";
ALTER TABLE "mailboxes" ADD COLUMN "expireEmailDaysOverride" INTEGER;
ALTER TABLE "mailboxes" ADD COLUMN "expireEmailActionOverride" "RetentionAction";

CREATE INDEX "mailboxes_lastEmailReceivedAt_idx" ON "mailboxes"("lastEmailReceivedAt");
