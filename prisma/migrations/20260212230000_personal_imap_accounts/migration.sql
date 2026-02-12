-- mailboxes: classify source type for alias vs personal imports
ALTER TABLE "mailboxes" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'ALIAS';
ALTER TABLE "mailboxes" ADD COLUMN "sourceLabel" TEXT;

-- personal IMAP account bindings
CREATE TABLE "personal_imap_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 993,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "passwordIv" TEXT NOT NULL,
    "passwordTag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastSync" DATETIME,
    "syncInterval" INTEGER NOT NULL DEFAULT 60,
    "lastSyncedUid" INTEGER,
    "lastUidValidity" BIGINT,
    "consecutiveErrors" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    CONSTRAINT "personal_imap_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "personal_imap_accounts_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "personal_imap_accounts_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "personal_imap_accounts_mailboxId_key" ON "personal_imap_accounts"("mailboxId");
CREATE UNIQUE INDEX "personal_imap_accounts_domainId_key" ON "personal_imap_accounts"("domainId");
CREATE INDEX "personal_imap_accounts_userId_idx" ON "personal_imap_accounts"("userId");
CREATE INDEX "personal_imap_accounts_status_idx" ON "personal_imap_accounts"("status");
