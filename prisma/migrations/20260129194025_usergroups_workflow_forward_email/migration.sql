-- AlterTable
ALTER TABLE "user_groups" ADD COLUMN "workflowForwardEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill default group quotas
UPDATE "user_groups" SET "maxMailboxes" = 300 WHERE "name" = 'Default' AND "maxMailboxes" IS NULL;
UPDATE "user_groups" SET "maxWorkflows" = 10 WHERE "name" = 'Default' AND "maxWorkflows" IS NULL;
