import { prisma } from "@/lib/prisma";

function notifyWorkflowName(bindingId: string) {
  return `Telegram Notify (${bindingId})`;
}

export async function deleteTelegramNotifyWorkflowForBinding(bindingId: string): Promise<void> {
  const name = notifyWorkflowName(bindingId);
  await prisma.workflow.deleteMany({
    where: { name },
  });
}
