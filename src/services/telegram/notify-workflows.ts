import { prisma } from "@/lib/prisma";
import type { TelegramChatBinding } from "@prisma/client";

function notifyWorkflowName(bindingId: string) {
  return `Telegram Notify (${bindingId})`;
}

function buildNotifyWorkflowConfig(binding: TelegramChatBinding) {
  return {
    version: 1,
    nodes: [
      {
        id: "trigger-email",
        type: "trigger:email",
        position: { x: 200, y: 100 },
        data: { label: "Email Trigger" },
      },
      {
        id: "telegram-notify",
        type: "forward:telegram",
        position: { x: 200, y: 260 },
        data: {
          label: "Telegram Notify",
          useAppBot: true,
          chatId: binding.chatId,
          topicRouting: "mailboxTopic",
          parseMode: "None",
          template: `📧 New email\nFrom: {{email.fromAddress}}\nTo: {{email.toAddress}}\nSubject: {{email.subject}}\nTime: {{email.receivedAt}}`,
        },
      },
      {
        id: "end",
        type: "control:end",
        position: { x: 200, y: 420 },
        data: { label: "End" },
      },
    ],
    edges: [
      { id: "e1", source: "trigger-email", target: "telegram-notify" },
      { id: "e2", source: "telegram-notify", target: "end" },
    ],
  };
}

export async function upsertTelegramNotifyWorkflowForBinding(bindingId: string): Promise<void> {
  const binding = await prisma.telegramChatBinding.findUnique({
    where: { id: bindingId },
  });
  if (!binding) return;

  // "MANAGE" bindings represent a bound forum group (with a General topic).
  // Auto-notify workflow routes each email into its mailbox topic.
  if (binding.mode !== "MANAGE") return;

  const name = notifyWorkflowName(binding.id);
  const config = buildNotifyWorkflowConfig(binding);

  const status = binding.enabled ? "ACTIVE" : "INACTIVE";

  const existing = await prisma.workflow.findFirst({
    where: { userId: binding.userId, name },
    select: { id: true },
  });

  if (!existing) {
    await prisma.workflow.create({
      data: {
        name,
        description: `Auto-generated for Telegram binding ${binding.id}. Changes may be overwritten.`,
        userId: binding.userId,
        mailboxId: null,
        config: JSON.stringify(config),
        status,
        version: 1,
      },
      select: { id: true },
    });
    return;
  }

  await prisma.workflow.update({
    where: { id: existing.id },
    data: {
      mailboxId: null,
      status,
      config: JSON.stringify(config),
      version: 1,
    },
    select: { id: true },
  });
}

export async function deleteTelegramNotifyWorkflowForBinding(bindingId: string): Promise<void> {
  const name = notifyWorkflowName(bindingId);
  await prisma.workflow.deleteMany({
    where: { name },
  });
}
