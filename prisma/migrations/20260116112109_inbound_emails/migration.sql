-- DropIndex
DROP INDEX "emails_messageId_key";

-- CreateTable
CREATE TABLE "inbound_emails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceType" TEXT NOT NULL,
    "messageId" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "rawContent" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "domainId" TEXT NOT NULL,
    "mailboxId" TEXT,
    CONSTRAINT "inbound_emails_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inbound_emails_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "inbound_emails_domainId_idx" ON "inbound_emails"("domainId");

-- CreateIndex
CREATE INDEX "inbound_emails_mailboxId_idx" ON "inbound_emails"("mailboxId");

-- CreateIndex
CREATE INDEX "inbound_emails_messageId_idx" ON "inbound_emails"("messageId");

-- CreateIndex
CREATE INDEX "inbound_emails_receivedAt_idx" ON "inbound_emails"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_emails_sourceType_domainId_messageId_toAddress_key" ON "inbound_emails"("sourceType", "domainId", "messageId", "toAddress");

-- CreateIndex
CREATE INDEX "emails_messageId_idx" ON "emails"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_mailboxId_messageId_key" ON "emails"("mailboxId", "messageId");
