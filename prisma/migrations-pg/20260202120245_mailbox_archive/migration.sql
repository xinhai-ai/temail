-- AlterTable
ALTER TABLE "mailboxes" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "mailboxes_userId_archivedAt_idx" ON "mailboxes"("userId", "archivedAt");
