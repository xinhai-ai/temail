-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "mailboxes_userId_archivedAt_idx" ON "mailboxes"("userId", "archivedAt");
