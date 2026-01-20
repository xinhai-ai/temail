import { prisma } from "@/lib/prisma";
import type { TelegramBindPurpose, TelegramBindingMode } from "@prisma/client";
import { telegramSendMessage } from "./bot-api";
import { consumeTelegramBindCode } from "./bind-codes";
import type { TelegramMessage, TelegramUpdate } from "./types";

function parseCommand(text: string): { command: string; args: string } | null {
  const trimmed = (text || "").trim();
  if (!trimmed.startsWith("/")) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const raw = head.slice(1);
  const command = raw.split("@")[0]?.toLowerCase() || "";
  const args = rest.join(" ").trim();
  if (!command) return null;
  return { command, args };
}

function formatHelp() {
  return [
    "TEmail Telegram Bot",
    "",
    "Commands (private chat):",
    "- /start <code> — link your TEmail account",
    "- /help — show this help",
    "- /unlink — unlink this Telegram account",
    "",
    "Commands (group/topic):",
    "- /bind <code> — bind this group topic for notifications",
  ].join("\n");
}

function buildScopeKey(params: { chatId: string; threadId: string; mailboxId: string | null; mode: TelegramBindingMode }) {
  const mailboxPart = params.mailboxId ? params.mailboxId : "all";
  return `chat:${params.chatId}|thread:${params.threadId}|mailbox:${mailboxPart}|mode:${params.mode}`;
}

async function replyToMessage(message: TelegramMessage, text: string) {
  await telegramSendMessage({
    chatId: String(message.chat.id),
    messageThreadId: typeof message.message_thread_id === "number" ? message.message_thread_id : undefined,
    text,
    parseMode: "Markdown",
    disableWebPagePreview: true,
  });
}

async function handleStart(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") {
    await replyToMessage(message, "Please DM me to link your account. Use /help for instructions.");
    return;
  }

  if (!args) {
    await replyToMessage(message, formatHelp());
    return;
  }

  const consumed = await consumeTelegramBindCode(args, "LINK_USER" satisfies TelegramBindPurpose);
  if (!consumed.ok) {
    await replyToMessage(message, `Link failed: ${consumed.message}`);
    return;
  }

  const from = message.from;
  if (!from?.id) {
    await replyToMessage(message, "Link failed: missing Telegram user info.");
    return;
  }

  const telegramUserId = String(from.id);
  const privateChatId = String(message.chat.id);
  const telegramUsername = typeof from.username === "string" && from.username.trim() ? from.username.trim() : null;

  const existing = await prisma.telegramUserLink.findUnique({
    where: { telegramUserId },
    select: { userId: true, revokedAt: true },
  });

  if (existing && existing.userId !== consumed.userId && !existing.revokedAt) {
    await replyToMessage(message, "This Telegram account is already linked to another TEmail account. Use /unlink first.");
    return;
  }

  await prisma.telegramUserLink.upsert({
    where: { telegramUserId },
    update: {
      userId: consumed.userId,
      privateChatId,
      telegramUsername,
      revokedAt: null,
    },
    create: {
      telegramUserId,
      userId: consumed.userId,
      privateChatId,
      telegramUsername,
    },
  });

  await replyToMessage(message, "Linked successfully. Send /help to see what I can do.");
}

async function handleUnlink(message: TelegramMessage) {
  if (message.chat.type !== "private") {
    await replyToMessage(message, "Please DM me to manage your link. Use /help for instructions.");
    return;
  }

  const from = message.from;
  if (!from?.id) {
    await replyToMessage(message, "Unlink failed: missing Telegram user info.");
    return;
  }

  const telegramUserId = String(from.id);
  const link = await prisma.telegramUserLink.findUnique({
    where: { telegramUserId },
    select: { userId: true, revokedAt: true },
  });
  if (!link || link.revokedAt) {
    await replyToMessage(message, "This Telegram account is not linked.");
    return;
  }

  await prisma.telegramUserLink.update({
    where: { telegramUserId },
    data: { revokedAt: new Date() },
  });

  await prisma.telegramChatBinding.updateMany({
    where: { userId: link.userId },
    data: { enabled: false },
  });

  await replyToMessage(message, "Unlinked. All Telegram notifications have been disabled.");
}

async function handleBind(message: TelegramMessage, args: string) {
  const from = message.from;
  if (!from?.id) {
    await replyToMessage(message, "Bind failed: missing Telegram user info.");
    return;
  }

  if (message.chat.type === "private") {
    await replyToMessage(message, "Please run /bind inside your target group topic.");
    return;
  }

  const threadId = typeof message.message_thread_id === "number" ? String(message.message_thread_id) : "";
  if (!threadId) {
    await replyToMessage(message, "Please run /bind inside a Topic (thread) in your group.");
    return;
  }

  if (!args) {
    await replyToMessage(message, "Bind code is required: /bind <code>");
    return;
  }

  const telegramUserId = String(from.id);
  const link = await prisma.telegramUserLink.findUnique({
    where: { telegramUserId },
    select: { userId: true, revokedAt: true },
  });

  if (!link || link.revokedAt) {
    await replyToMessage(message, "This Telegram account is not linked. Please DM me and use /start <code> first.");
    return;
  }

  const consumed = await consumeTelegramBindCode(args, "BIND_CHAT" satisfies TelegramBindPurpose);
  if (!consumed.ok) {
    await replyToMessage(message, `Bind failed: ${consumed.message}`);
    return;
  }
  if (consumed.userId !== link.userId) {
    await replyToMessage(message, "Bind failed: this code belongs to a different TEmail account.");
    return;
  }

  const mode: TelegramBindingMode = (consumed.mode || "NOTIFY") satisfies TelegramBindingMode;
  const chatId = String(message.chat.id);
  const scopeKey = buildScopeKey({ chatId, threadId, mailboxId: consumed.mailboxId, mode });

  await prisma.telegramChatBinding.upsert({
    where: { userId_scopeKey: { userId: link.userId, scopeKey } },
    update: {
      enabled: true,
      mode,
      chatId,
      chatType: message.chat.type,
      chatTitle: message.chat.title || null,
      threadId,
      mailboxId: consumed.mailboxId,
    },
    create: {
      userId: link.userId,
      scopeKey,
      enabled: true,
      mode,
      chatId,
      chatType: message.chat.type,
      chatTitle: message.chat.title || null,
      threadId,
      mailboxId: consumed.mailboxId,
    },
  });

  await replyToMessage(message, "Bound. This topic will receive TEmail notifications.");
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message || update.edited_message;
  if (message?.from?.is_bot) return;

  if (message?.text) {
    const parsed = parseCommand(message.text);
    if (!parsed) {
      if (message.chat.type !== "private") return;
      await replyToMessage(message, formatHelp());
      return;
    }

    switch (parsed.command) {
      case "start":
        await handleStart(message, parsed.args);
        return;
      case "help":
        await replyToMessage(message, formatHelp());
        return;
      case "unlink":
        await handleUnlink(message);
        return;
      case "bind":
        await handleBind(message, parsed.args);
        return;
      default:
        if (message.chat.type !== "private") return;
        await replyToMessage(message, formatHelp());
        return;
    }
  }
}

