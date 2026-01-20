import { prisma } from "@/lib/prisma";
import type { TelegramBindPurpose, TelegramBindingMode } from "@prisma/client";
import { isImapServiceEnabled, syncAllImapDomains } from "@/lib/imap-client";
import { formatRemainingTime, tryAcquireSyncLock } from "@/lib/rate-limit";
import { getOrCreateEmailPreviewLink } from "@/services/email-preview-links";
import { moveOwnedEmailToTrash, purgeOwnedEmail, restoreOwnedEmailFromTrash } from "@/services/email-trash";
import { rematchUnmatchedInboundEmailsForUser } from "@/services/inbound/rematch";
import type { TelegramInlineKeyboardMarkup } from "./bot-api";
import {
  getTelegramForumGeneralTopicName,
  telegramAnswerCallbackQuery,
  telegramCreateForumTopic,
  telegramEditMessageText,
  telegramSendMessage,
} from "./bot-api";
import { consumeTelegramBindCode } from "./bind-codes";
import { upsertTelegramNotifyWorkflowForBinding } from "./notify-workflows";
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from "./types";

const TELEGRAM_MAX_MESSAGE_CHARS = 4096;
const EMAILS_PAGE_SIZE = 6;
const CALLBACK_PREFIX = "temail";

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
    "- /mailbox_create <prefix>@<domain> — create a mailbox",
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
    "Commands (forum group):",
    "- /bind <code> — bind this group and create a General topic",
    "",
    "Commands (forum topics):",
    "- Run commands inside the created General topic (global)",
    "- Run commands inside mailbox topics (per-mailbox)",
  ].join("\n");
}

function buildScopeKey(params: { chatId: string; mailboxId: string | null; mode: TelegramBindingMode }) {
  const mailboxPart = params.mailboxId ? params.mailboxId : "all";
  return `chat:${params.chatId}|mailbox:${mailboxPart}|mode:${params.mode}`;
}

async function replyToMessage(message: TelegramMessage, text: string, options?: { replyMarkup?: TelegramInlineKeyboardMarkup }) {
  await telegramSendMessage({
    chatId: String(message.chat.id),
    messageThreadId: typeof message.message_thread_id === "number" ? message.message_thread_id : undefined,
    text,
    ...(options?.replyMarkup ? { replyMarkup: options.replyMarkup } : {}),
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

type TelegramTopicContext =
  | { kind: "private" }
  | { kind: "forum-general"; chatId: string; threadId: string }
  | { kind: "forum-mailbox"; chatId: string; threadId: string; mailboxId: string };

async function resolveTopicContext(message: TelegramMessage, userId: string): Promise<TelegramTopicContext | null> {
  if (message.chat.type === "private") return { kind: "private" };

  const chatId = String(message.chat.id);
  const threadId = typeof message.message_thread_id === "number" ? String(message.message_thread_id) : null;
  if (!threadId) return null;

  const general = await prisma.telegramChatBinding.findFirst({
    where: { userId, enabled: true, chatId, mode: "MANAGE", threadId },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
  if (general) return { kind: "forum-general", chatId, threadId };

  const mailbox = await prisma.telegramChatBinding.findFirst({
    where: { userId, enabled: true, chatId, mode: "NOTIFY", threadId, mailboxId: { not: null } },
    select: { mailboxId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (mailbox?.mailboxId) return { kind: "forum-mailbox", chatId, threadId, mailboxId: mailbox.mailboxId };

  return null;
}

async function requireTopicContext(message: TelegramMessage, userId: string): Promise<TelegramTopicContext | null> {
  const ctx = await resolveTopicContext(message, userId);
  if (ctx) return ctx;
  if (message.chat.type !== "private") {
    await replyToMessage(message, "This Topic is not linked. Use /bind in the group to set it up.");
  }
  return null;
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
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

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

async function handleMailboxCreate(message: TelegramMessage, args: string) {
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;
  if (ctx.kind === "forum-mailbox") {
    await replyToMessage(message, "Please use the General topic to create mailboxes.");
    return;
  }

  const raw = (args || "").trim();
  if (!raw) {
    await replyToMessage(message, "Usage: /mailbox_create <prefix>@<domain>");
    return;
  }

  const parsed = raw.includes("@")
    ? (() => {
        const [prefix, domain] = raw.split("@");
        return { prefix: (prefix || "").trim(), domain: (domain || "").trim() };
      })()
    : (() => {
        const [prefix, domain] = raw.split(/\s+/);
        return { prefix: (prefix || "").trim(), domain: (domain || "").trim() };
      })();

  if (!parsed.prefix || !parsed.domain) {
    await replyToMessage(message, "Usage: /mailbox_create <prefix>@<domain>");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const domain = await prisma.domain.findFirst({
    where: isAdmin ? { name: parsed.domain } : { name: parsed.domain, isPublic: true, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  if (!domain) {
    await replyToMessage(message, "Domain not found (or not available). Create mailboxes in public ACTIVE domains.");
    return;
  }

  const address = `${parsed.prefix}@${domain.name}`;
  const existing = await prisma.mailbox.findUnique({
    where: { address },
    select: { id: true },
  });
  if (existing) {
    await replyToMessage(message, `Mailbox already exists: ${address}`);
    return;
  }

  const mailbox = await prisma.mailbox.create({
    data: {
      prefix: parsed.prefix,
      address,
      userId,
      domainId: domain.id,
    },
    select: { id: true, address: true },
  });

  await replyToMessage(message, `Mailbox created: ${mailbox.address}\nid: ${mailbox.id}`);
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

function truncateTelegramText(input: string, maxChars: number) {
  const value = (input || "").trim();
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function truncateButtonText(input: string, maxChars = 48) {
  const value = (input || "").replace(/\s+/g, " ").trim();
  if (value.length <= maxChars) return value;
  return value.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function buildEmailsListCallback(scope: { kind: "all" } | { kind: "mailbox"; mailboxId: string }, page: number) {
  if (scope.kind === "all") return `${CALLBACK_PREFIX}:emails:all:${page}`;
  return `${CALLBACK_PREFIX}:emails:mb:${scope.mailboxId}:${page}`;
}

function buildOpenEmailCallback(emailId: string) {
  return `${CALLBACK_PREFIX}:open:${emailId}`;
}

async function buildEmailsListPayload(params: {
  userId: string;
  mailboxId: string | null;
  mailboxAddress: string | null;
  page: number;
}) {
  const page = Number.isFinite(params.page) && params.page > 0 ? Math.floor(params.page) : 1;
  const skip = (page - 1) * EMAILS_PAGE_SIZE;

  const rows = await prisma.email.findMany({
    where: {
      mailbox: { userId: params.userId },
      ...(params.mailboxId ? { mailboxId: params.mailboxId } : {}),
    },
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      status: true,
      isStarred: true,
      receivedAt: true,
      mailbox: { select: { address: true } },
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    skip,
    take: EMAILS_PAGE_SIZE + 1,
  });

  const hasNext = rows.length > EMAILS_PAGE_SIZE;
  const emails = rows.slice(0, EMAILS_PAGE_SIZE);

  const headerMailbox = params.mailboxAddress ? `(${params.mailboxAddress})` : "(latest)";
  const title = `Emails ${headerMailbox} — page ${page}`;

  if (emails.length === 0) {
    return {
      text: `${title}\n\nNo emails found.`,
      replyMarkup: undefined as TelegramInlineKeyboardMarkup | undefined,
      hasNext: false,
    };
  }

  const lines = emails.map((e, idx) => {
    const subject = truncateLine(e.subject || "(No subject)", 80);
    const from = truncateLine(e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress, 60);
    const flags = `${e.status}${e.isStarred ? " ★" : ""}`;
    return `${idx + 1}) [${flags}] ${subject}\n   from: ${from}\n   id: ${e.id}`;
  });

  const scope: { kind: "all" } | { kind: "mailbox"; mailboxId: string } = params.mailboxId
    ? { kind: "mailbox", mailboxId: params.mailboxId }
    : { kind: "all" };

  const inline_keyboard: TelegramInlineKeyboardMarkup["inline_keyboard"] = [];
  for (const [idx, email] of emails.entries()) {
    const subject = truncateButtonText(email.subject || "(No subject)");
    inline_keyboard.push([
      {
        text: `${idx + 1} · ${subject}`,
        callback_data: buildOpenEmailCallback(email.id),
      },
    ]);
  }

  const navRow: Array<{ text: string; callback_data: string }> = [];
  if (page > 1) navRow.push({ text: "◀ Prev", callback_data: buildEmailsListCallback(scope, page - 1) });
  if (hasNext) navRow.push({ text: "Next ▶", callback_data: buildEmailsListCallback(scope, page + 1) });
  if (navRow.length) inline_keyboard.push(navRow);

  return {
    text: `${title}\n\n${lines.join("\n")}\n\nClick a button to view the full email.`,
    replyMarkup: { inline_keyboard },
    hasNext,
  };
}

async function sendEmailDetails(message: TelegramMessage, userId: string, emailId: string) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, mailbox: { userId } },
    select: {
      id: true,
      fromAddress: true,
      fromName: true,
      toAddress: true,
      subject: true,
      textBody: true,
      receivedAt: true,
      mailbox: { select: { address: true } },
    },
  });
  if (!email) {
    await replyToMessage(message, "Email not found.");
    return;
  }

  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  const body = (email.textBody || "").trim() || "(No text body)";
  const bodyMax = 2600;

  const link = await getOrCreateEmailPreviewLink(email.id);
  const previewUrl = link?.url || null;

  const parts: string[] = [];
  parts.push("📧 Email");
  parts.push(`Mailbox: ${email.mailbox.address}`);
  parts.push(`From: ${truncateLine(from, 120)}`);
  parts.push(`To: ${truncateLine(email.toAddress, 120)}`);
  parts.push(`Subject: ${truncateLine(email.subject || "(No subject)", 200)}`);
  parts.push(`Time: ${email.receivedAt.toISOString()}`);
  parts.push("");
  parts.push(truncateTelegramText(body, bodyMax));

  if (previewUrl) {
    parts.push("");
    parts.push(`Preview link: ${previewUrl}`);
  } else {
    parts.push("");
    parts.push("Preview link: (unavailable)");
  }

  let text = parts.join("\n");
  if (text.length > TELEGRAM_MAX_MESSAGE_CHARS) {
    text = truncateTelegramText(text, TELEGRAM_MAX_MESSAGE_CHARS);
  }

  const replyMarkup: TelegramInlineKeyboardMarkup | undefined = previewUrl
    ? { inline_keyboard: [[{ text: "Open Preview", url: previewUrl }]] }
    : undefined;

  await replyToMessage(message, text, { replyMarkup });
}

async function handleEmails(message: TelegramMessage, args: string) {
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

  const tokens = (args || "").trim().split(/\s+/).filter(Boolean);
  const last = tokens.length ? tokens[tokens.length - 1] : "";
  const pageToken = last && /^[0-9]+$/.test(last) ? Number.parseInt(last, 10) : null;
  const page = pageToken && Number.isFinite(pageToken) && pageToken > 0 ? pageToken : 1;
  const rawArg = pageToken ? tokens.slice(0, -1).join(" ").trim() : (args || "").trim();

  let mailbox: { id: string; address: string } | null = null;
  if (ctx.kind === "forum-mailbox") {
    const mailboxArg = rawArg || ctx.mailboxId;
    mailbox = await resolveMailboxIdForUser(userId, mailboxArg);
    if (!mailbox) {
      await replyToMessage(message, "Mailbox not found.");
      return;
    }
    if (mailbox.id !== ctx.mailboxId) {
      await replyToMessage(message, "This Topic is bound to a different mailbox. Use the General topic for other mailboxes.");
      return;
    }
  } else if (rawArg) {
    mailbox = await resolveMailboxIdForUser(userId, rawArg);
    if (!mailbox) {
      await replyToMessage(message, "Mailbox not found. Use /mailboxes to list available mailboxes.");
      return;
    }
  }

  const payload = await buildEmailsListPayload({
    userId,
    mailboxId: mailbox?.id || null,
    mailboxAddress: mailbox?.address || null,
    page,
  });

  await replyToMessage(message, payload.text, payload.replyMarkup ? { replyMarkup: payload.replyMarkup } : undefined);
}

async function handleSearch(message: TelegramMessage, args: string) {
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

  const q = (args || "").trim();
  if (!q) {
    await replyToMessage(message, "Query is required: /search <query>");
    return;
  }

  const emails = await prisma.email.findMany({
    where: {
      mailbox: { userId },
      ...(ctx.kind === "forum-mailbox" ? { mailboxId: ctx.mailboxId } : {}),
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
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

  const emailId = (args || "").trim();
  if (!emailId) {
    await replyToMessage(message, "Email id is required: /open <emailId>");
    return;
  }

  await sendEmailDetails(message, userId, emailId);
}

async function handleDelete(message: TelegramMessage, args: string) {
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

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
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

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
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

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
  const userId = await requireLinkedUserId(message);
  if (!userId) return;

  const ctx = await requireTopicContext(message, userId);
  if (!ctx) return;

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
    where: { userId: link.userId, mode: "MANAGE" },
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
    await replyToMessage(message, "Please run /bind inside your target forum group.");
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

  const mode: TelegramBindingMode = "MANAGE" satisfies TelegramBindingMode;
  const chatId = String(message.chat.id);
  const scopeKey = buildScopeKey({ chatId, mailboxId: null, mode });

  let generalThreadId: number;
  try {
    const topicName = await getTelegramForumGeneralTopicName();
    const created = await telegramCreateForumTopic({ chatId, name: topicName });
    generalThreadId = created.messageThreadId;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    await replyToMessage(
      message,
      `Bind failed: cannot create Topics in this group.\n\nMake sure:\n- The group has Topics enabled\n- The bot is an admin with Manage Topics permission\n\nDetails: ${messageText}`
    );
    return;
  }

  const threadId = String(generalThreadId);

  const stored = await prisma.telegramChatBinding.upsert({
    where: { userId_scopeKey: { userId: link.userId, scopeKey } },
    update: {
      enabled: true,
      mode,
      chatId,
      chatType: message.chat.type,
      chatTitle: message.chat.title || null,
      threadId,
      mailboxId: null,
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
      mailboxId: null,
    },
    select: { id: true },
  });

  await prisma.telegramChatBinding.deleteMany({
    where: {
      userId: link.userId,
      chatId,
      mode: "MANAGE",
      id: { not: stored.id },
    },
  });

  await upsertTelegramNotifyWorkflowForBinding(stored.id);

  await replyToMessage(message, "Bound. A General topic has been created for TEmail management.");

  await telegramSendMessage({
    chatId,
    messageThreadId: generalThreadId,
    text: [
      "✅ TEmail is connected to this group.",
      "",
      "Use this topic for global management:",
      "- /mailboxes",
      "- /search <q>",
      "- /refresh",
      "",
      "Mailbox topics will be created automatically when emails are forwarded by workflows.",
    ].join("\n"),
    disableWebPagePreview: true,
  });
}

async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
  if (callbackQuery.from?.is_bot) return;
  const message = callbackQuery.message;
  const data = (callbackQuery.data || "").trim();
  if (!message || !data) return;

  if (!data.startsWith(`${CALLBACK_PREFIX}:`)) return;

  const telegramUserId = String(callbackQuery.from.id);
  const link = await prisma.telegramUserLink.findUnique({
    where: { telegramUserId },
    select: { userId: true, revokedAt: true },
  });
  if (!link || link.revokedAt) {
    await telegramAnswerCallbackQuery({ callbackQueryId: callbackQuery.id, text: "Not linked. DM /start <code> first.", showAlert: true });
    return;
  }

  const ctx = await resolveTopicContext(message, link.userId);
  if (!ctx) {
    await telegramAnswerCallbackQuery({ callbackQueryId: callbackQuery.id, text: "This Topic is not linked.", showAlert: true });
    return;
  }

  const parts = data.split(":");
  if (parts[0] !== CALLBACK_PREFIX) return;

  try {
    // Stop the Telegram spinner quickly.
    await telegramAnswerCallbackQuery({ callbackQueryId: callbackQuery.id });

    if (parts[1] === "open") {
      const emailId = (parts[2] || "").trim();
      if (!emailId) return;
      await sendEmailDetails(message, link.userId, emailId);
      return;
    }

    if (parts[1] === "emails") {
      const kind = parts[2] || "";
      const chatId = String(message.chat.id);
      const messageId = message.message_id;

      let mailboxId: string | null = null;
      let mailboxAddress: string | null = null;
      let page = 1;

      if (kind === "all") {
        page = Number.parseInt(parts[3] || "1", 10);
      } else if (kind === "mb") {
        mailboxId = (parts[3] || "").trim() || null;
        page = Number.parseInt(parts[4] || "1", 10);
      } else {
        return;
      }

      if (!Number.isFinite(page) || page <= 0) page = 1;

      if (mailboxId) {
        const mailbox = await prisma.mailbox.findFirst({
          where: { id: mailboxId, userId: link.userId },
          select: { id: true, address: true },
        });
        if (!mailbox) {
          await telegramEditMessageText({
            chatId,
            messageId,
            text: "Mailbox not found.",
            disableWebPagePreview: true,
          });
          return;
        }
        if (ctx.kind === "forum-mailbox" && ctx.mailboxId !== mailbox.id) {
          await telegramEditMessageText({
            chatId,
            messageId,
            text: "This Topic is bound to a different mailbox.",
            disableWebPagePreview: true,
          });
          return;
        }
        mailboxAddress = mailbox.address;
      } else if (ctx.kind === "forum-mailbox") {
        mailboxId = ctx.mailboxId;
        const mailbox = await prisma.mailbox.findFirst({
          where: { id: mailboxId, userId: link.userId },
          select: { address: true },
        });
        mailboxAddress = mailbox?.address || null;
      }

      const payload = await buildEmailsListPayload({
        userId: link.userId,
        mailboxId,
        mailboxAddress,
        page,
      });

      await telegramEditMessageText({
        chatId,
        messageId,
        text: payload.text,
        ...(payload.replyMarkup ? { replyMarkup: payload.replyMarkup } : {}),
        disableWebPagePreview: true,
      });
      return;
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    const clipped = truncateTelegramText(messageText, 180);
    await telegramAnswerCallbackQuery({ callbackQueryId: callbackQuery.id, text: clipped, showAlert: true });
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

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
      case "mailbox_create":
      case "mailbox-create":
        await handleMailboxCreate(message, parsed.args);
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
