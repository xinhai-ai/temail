-- AlterTable
ALTER TABLE "mailbox_groups" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "mailbox_groups_userId_sortOrder_idx" ON "mailbox_groups"("userId", "sortOrder");
