import { prisma } from "@/lib/prisma";
import type { TelegramBindPurpose, TelegramBindingMode } from "@prisma/client";
import { isImapServiceEnabled, syncAllImapDomains } from "@/lib/imap-client";
import { formatRemainingTime, tryAcquireSyncLock } from "@/lib/rate-limit";
import { getOrCreateEmailPreviewLink } from "@/services/email-preview-links";
import { moveOwnedEmailToTrash, purgeOwnedEmail, restoreOwnedEmailFromTrash } from "@/services/email-trash";
import { rematchUnmatchedInboundEmailsForUser } from "@/services/inbound/rematch";
import { telegramSendMessage } from "./bot-api";
import { consumeTelegramBindCode } from "./bind-codes";
import { upsertTelegramNotifyWorkflowForBinding } from "./notify-workflows";
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
    "- /mailboxes — list mailboxes",
    "- /emails [mailboxId|address] — list recent emails",
    "- /search <query> — search emails",
    "- /open <emailId> — get a safe preview link",
    "- /delete <emailId> — move to Trash",
    "- /restore <emailId> — restore from Trash",
    "- /purge <emailId> — permanently delete",
    "- /refresh — sync inbound mail",
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
    disableWebPagePreview: true,
  });
}

async function requireLinkedUserId(message: TelegramMessage): Promise<string | null> {
  const from = message.from;
  if (!from?.id) {
    await replyToMessage(message, "Missing Telegram user info.");
    return null;
  }
  const telegramUserId = String(from.id);
  const link = await prisma.telegramUserLink.findUnique({
    where: { telegramUserId },
    select: { userId: true, revokedAt: true },
  });
  if (!link || link.revokedAt) {
    await replyToMessage(message, "Not linked. Generate a code in the dashboard, then DM me: /start <code>");
    return null;
  }
  return link.userId;
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

function truncateLine(input: string, max = 120) {
  const value = (input || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

async function handleMailboxes(message: TelegramMessage) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const mailboxes = await prisma.mailbox.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      id: true,
      address: true,
      note: true,
      _count: {
        select: {
          emails: { where: { status: "UNREAD" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (mailboxes.length === 0) {
    await replyToMessage(message, "No mailboxes yet. Create one in the web UI first.");
    return;
  }

  const lines = mailboxes.map((m) => `- ${m.address} (unread: ${m._count.emails})\n  id: ${m.id}`);
  await replyToMessage(message, `Mailboxes:\n\n${lines.join("\n")}\n\nTip: /emails <mailboxId|address>`);
}

async function resolveMailboxIdForUser(userId: string, arg: string): Promise<{ id: string; address: string } | null> {
  const trimmed = (arg || "").trim();
  if (!trimmed) return null;
  const mailbox = await prisma.mailbox.findFirst({
    where: {
      userId,
      OR: [{ id: trimmed }, { address: trimmed }],
    },
    select: { id: true, address: true },
  });
  return mailbox || null;
}

async function handleEmails(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const mailbox = args ? await resolveMailboxIdForUser(userId, args) : null;
  if (args && !mailbox) {
    await replyToMessage(message, "Mailbox not found. Use /mailboxes to list available mailboxes.");
    return;
  }

  const emails = await prisma.email.findMany({
    where: {
      mailbox: { userId },
      ...(mailbox ? { mailboxId: mailbox.id } : {}),
    },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      toAddress: true,
      status: true,
      isStarred: true,
      receivedAt: true,
      mailbox: { select: { address: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  const header = mailbox ? `Emails (${mailbox.address}):` : "Emails (latest):";
  if (emails.length === 0) {
    await replyToMessage(message, `${header}\n\nNo emails found.`);
    return;
  }

  const lines = emails.map((e) => {
    const subject = truncateLine(e.subject || "(No subject)", 80);
    const from = truncateLine(e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress, 60);
    const flags = `${e.status}${e.isStarred ? " ★" : ""}`;
    return `- [${flags}] ${subject}\n  from: ${from}\n  id: ${e.id}`;
  });

  await replyToMessage(message, `${header}\n\n${lines.join("\n")}\n\nTip: /open <emailId>`);
}

async function handleSearch(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const q = (args || "").trim();
  if (!q) {
    await replyToMessage(message, "Query is required: /search <query>");
    return;
  }

  const emails = await prisma.email.findMany({
    where: {
      mailbox: { userId },
      OR: [
        { subject: { contains: q } },
        { fromAddress: { contains: q } },
        { fromName: { contains: q } },
        { toAddress: { contains: q } },
        { textBody: { contains: q } },
      ],
    },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      receivedAt: true,
      mailbox: { select: { address: true } },
    },
    orderBy: { receivedAt: "desc" },
    take: 10,
  });

  if (emails.length === 0) {
    await replyToMessage(message, `Search results for "${truncateLine(q, 60)}":\n\nNo matches.`);
    return;
  }

  const lines = emails.map((e) => {
    const subject = truncateLine(e.subject || "(No subject)", 80);
    const from = truncateLine(e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress, 60);
    return `- ${subject}\n  from: ${from}\n  mailbox: ${e.mailbox.address}\n  id: ${e.id}`;
  });

  await replyToMessage(message, `Search results for "${truncateLine(q, 60)}":\n\n${lines.join("\n")}`);
}

async function handleOpen(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const emailId = (args || "").trim();
  if (!emailId) {
    await replyToMessage(message, "Email id is required: /open <emailId>");
    return;
  }

  const owned = await prisma.email.findFirst({
    where: { id: emailId, mailbox: { userId } },
    select: { id: true },
  });
  if (!owned) {
    await replyToMessage(message, "Email not found.");
    return;
  }

  const link = await getOrCreateEmailPreviewLink(emailId);
  if (!link) {
    await replyToMessage(message, "Preview links are not available (missing database table).");
    return;
  }

  await replyToMessage(message, `Preview link:\n${link.url}`);
}

async function handleDelete(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const emailId = (args || "").trim();
  if (!emailId) {
    await replyToMessage(message, "Email id is required: /delete <emailId>");
    return;
  }

  const moved = await moveOwnedEmailToTrash({ emailId, userId });
  if (!moved) {
    await replyToMessage(message, "Email not found.");
    return;
  }

  await replyToMessage(message, `Moved to Trash.\nstatus=${moved.status}\nid=${moved.id}`);
}

async function handleRestore(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const emailId = (args || "").trim();
  if (!emailId) {
    await replyToMessage(message, "Email id is required: /restore <emailId>");
    return;
  }

  const restored = await restoreOwnedEmailFromTrash({ emailId, userId });
  if (!restored) {
    await replyToMessage(message, "Email not found.");
    return;
  }

  await replyToMessage(message, `Restored.\nstatus=${restored.status}\nid=${restored.id}`);
}

async function handlePurge(message: TelegramMessage, args: string) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const emailId = (args || "").trim();
  if (!emailId) {
    await replyToMessage(message, "Email id is required: /purge <emailId>");
    return;
  }

  const purged = await purgeOwnedEmail({ emailId, userId });
  if (!purged) {
    await replyToMessage(message, "Email not found.");
    return;
  }

  await replyToMessage(message, `Permanently deleted.\nid=${purged.id}`);
}

async function handleRefresh(message: TelegramMessage) {
  if (message.chat.type !== "private") return;

  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const inbound = await rematchUnmatchedInboundEmailsForUser(userId);

  let imapMessage = "IMAP sync skipped (service disabled)";
  if (isImapServiceEnabled()) {
    const lock = tryAcquireSyncLock(userId);
    if (!lock.allowed) {
      const remaining = formatRemainingTime(lock.remainingMs);
      imapMessage =
        lock.reason === "running"
          ? `A sync is already running. Please wait ${remaining}.`
          : `Please wait ${remaining} before refreshing again.`;
    } else {
      try {
        const result = await syncAllImapDomains();
        imapMessage = result.success
          ? `Synced ${result.count || 0} domain(s)`
          : result.message || "Sync failed";
      } finally {
        lock.release();
      }
    }
  }

  const parts: string[] = [imapMessage];
  parts.push(`Inbound scanned=${inbound.scanned} matched=${inbound.matched} created=${inbound.created} duplicates=${inbound.skippedDuplicates}`);
  await replyToMessage(message, parts.join("\n"));
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

  const bindingIds = await prisma.telegramChatBinding.findMany({
    where: { userId: link.userId },
    select: { id: true },
  });
  await Promise.all(bindingIds.map((b) => upsertTelegramNotifyWorkflowForBinding(b.id)));

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

  const stored = await prisma.telegramChatBinding.upsert({
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
    select: { id: true },
  });

  await upsertTelegramNotifyWorkflowForBinding(stored.id);

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
      case "mailboxes":
        await handleMailboxes(message);
        return;
      case "emails":
        await handleEmails(message, parsed.args);
        return;
      case "search":
        await handleSearch(message, parsed.args);
        return;
      case "open":
        await handleOpen(message, parsed.args);
        return;
      case "delete":
        await handleDelete(message, parsed.args);
        return;
      case "restore":
        await handleRestore(message, parsed.args);
        return;
      case "purge":
        await handlePurge(message, parsed.args);
        return;
      case "refresh":
        await handleRefresh(message);
        return;
      default:
        if (message.chat.type !== "private") return;
        await replyToMessage(message, formatHelp());
        return;
    }
  }
}
