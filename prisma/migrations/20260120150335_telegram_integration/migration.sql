-- Migration: telegram_integration
-- Description: Add Telegram integration tables (user linking, chat/topic bindings, bind codes, webhook idempotency)

-- CreateTable
CREATE TABLE "telegram_user_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "privateChatId" TEXT,
    "userId" TEXT NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "telegram_user_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_chat_bindings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'NOTIFY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chatId" TEXT NOT NULL,
    "chatType" TEXT,
    "chatTitle" TEXT,
    "threadId" TEXT,
    "mailboxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "telegram_chat_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "telegram_chat_bindings_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_bind_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "mode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_bind_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "telegram_bind_codes_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_update_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updateId" INTEGER NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_user_links_telegramUserId_key" ON "telegram_user_links"("telegramUserId");
CREATE INDEX "telegram_user_links_userId_idx" ON "telegram_user_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_chat_bindings_userId_scopeKey_key" ON "telegram_chat_bindings"("userId", "scopeKey");
CREATE INDEX "telegram_chat_bindings_userId_idx" ON "telegram_chat_bindings"("userId");
CREATE INDEX "telegram_chat_bindings_mailboxId_idx" ON "telegram_chat_bindings"("mailboxId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bind_codes_codeHash_key" ON "telegram_bind_codes"("codeHash");
CREATE INDEX "telegram_bind_codes_userId_idx" ON "telegram_bind_codes"("userId");
CREATE INDEX "telegram_bind_codes_mailboxId_idx" ON "telegram_bind_codes"("mailboxId");
CREATE INDEX "telegram_bind_codes_expiresAt_idx" ON "telegram_bind_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_update_logs_updateId_key" ON "telegram_update_logs"("updateId");
