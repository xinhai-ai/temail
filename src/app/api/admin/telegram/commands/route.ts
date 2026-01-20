import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import { telegramSetMyCommands, type TelegramBotCommand } from "@/services/telegram/bot-api";

function buildPrivateCommands(): TelegramBotCommand[] {
  return [
    { command: "start", description: "Link your account: /start <code>" },
    { command: "mailbox_create", description: "Create a mailbox" },
    { command: "mailboxes", description: "List mailboxes" },
    { command: "emails", description: "List recent emails" },
    { command: "search", description: "Search emails" },
    { command: "open", description: "Show an email's details" },
    { command: "delete", description: "Move an email to Trash" },
    { command: "restore", description: "Restore from Trash" },
    { command: "purge", description: "Permanently delete" },
    { command: "refresh", description: "Sync inbound mail" },
    { command: "help", description: "Show help" },
    { command: "unlink", description: "Unlink this Telegram account" },
  ];
}

function buildGroupCommands(): TelegramBotCommand[] {
  return [
    { command: "bind", description: "Bind this forum group: /bind <code>" },
    { command: "mailboxes", description: "List mailboxes" },
    { command: "emails", description: "List recent emails" },
    { command: "search", description: "Search emails" },
    { command: "open", description: "Show an email's details" },
    { command: "delete", description: "Move an email to Trash" },
    { command: "restore", description: "Restore from Trash" },
    { command: "purge", description: "Permanently delete" },
    { command: "refresh", description: "Sync inbound mail" },
    { command: "help", description: "Show help" },
  ];
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await telegramSetMyCommands({
      scope: { type: "default" },
      commands: buildGroupCommands(),
    });
    await telegramSetMyCommands({
      scope: { type: "all_private_chats" },
      commands: buildPrivateCommands(),
    });
    await telegramSetMyCommands({
      scope: { type: "all_group_chats" },
      commands: buildGroupCommands(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
