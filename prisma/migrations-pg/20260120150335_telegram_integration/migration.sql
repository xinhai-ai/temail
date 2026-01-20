-- Migration: telegram_integration
-- Description: Add Telegram integration tables (user linking, chat/topic bindings, bind codes, webhook idempotency)

-- CreateEnum
CREATE TYPE "TelegramBindPurpose" AS ENUM ('LINK_USER', 'BIND_CHAT');

-- CreateEnum
CREATE TYPE "TelegramBindingMode" AS ENUM ('MANAGE', 'NOTIFY');

-- CreateTable
CREATE TABLE "telegram_user_links" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "telegramUsername" TEXT,
    "privateChatId" TEXT,
    "userId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_chat_bindings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "mode" "TelegramBindingMode" NOT NULL DEFAULT 'NOTIFY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chatId" TEXT NOT NULL,
    "chatType" TEXT,
    "chatTitle" TEXT,
    "threadId" TEXT,
    "mailboxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_chat_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bind_codes" (
    "id" TEXT NOT NULL,
    "purpose" "TelegramBindPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "mailboxId" TEXT,
    "mode" "TelegramBindingMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_bind_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_update_logs" (
    "id" TEXT NOT NULL,
    "updateId" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_update_logs_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "telegram_user_links" ADD CONSTRAINT "telegram_user_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_chat_bindings" ADD CONSTRAINT "telegram_chat_bindings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_chat_bindings" ADD CONSTRAINT "telegram_chat_bindings_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bind_codes" ADD CONSTRAINT "telegram_bind_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "telegram_bind_codes" ADD CONSTRAINT "telegram_bind_codes_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "mailboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
