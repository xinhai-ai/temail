import type { EmailRestoreStatus, EmailStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStorage } from "@/lib/storage";

export function getRestoreStatusForTrash(status: EmailStatus): EmailRestoreStatus {
  return status === "UNREAD" ? "UNREAD" : "READ";
}

export async function moveOwnedEmailToTrash(params: {
  emailId: string;
  userId: string;
  now?: Date;
}): Promise<{ id: string; mailboxId: string; status: EmailStatus } | null> {
  const now = params.now ?? new Date();

  const existing = await prisma.email.findFirst({
    where: { id: params.emailId, mailbox: { userId: params.userId } },
    select: { id: true, mailboxId: true, status: true, deletedAt: true },
  });

  if (!existing) return null;

  if (existing.status === "DELETED") {
    return { id: existing.id, mailboxId: existing.mailboxId, status: existing.status };
  }

  const updated = await prisma.email.update({
    where: { id: existing.id },
    data: {
      status: "DELETED",
      deletedAt: existing.deletedAt ?? now,
      restoreStatus: getRestoreStatusForTrash(existing.status),
    },
    select: { id: true, mailboxId: true, status: true },
  });

  return updated;
}

export async function restoreOwnedEmailFromTrash(params: {
  emailId: string;
  userId: string;
}): Promise<{ id: string; mailboxId: string; status: EmailStatus } | null> {
  const existing = await prisma.email.findFirst({
    where: { id: params.emailId, mailbox: { userId: params.userId } },
    select: { id: true, mailboxId: true, status: true, restoreStatus: true },
  });

  if (!existing) return null;
  if (existing.status !== "DELETED") {
    return { id: existing.id, mailboxId: existing.mailboxId, status: existing.status };
  }

  const status: EmailStatus = existing.restoreStatus === "UNREAD" ? "UNREAD" : "READ";

  const updated = await prisma.email.update({
    where: { id: existing.id },
    data: { status, deletedAt: null, restoreStatus: null },
    select: { id: true, mailboxId: true, status: true },
  });

  return updated;
}

export async function purgeOwnedEmail(params: {
  emailId: string;
  userId: string;
}): Promise<{ id: string; mailboxId: string } | null> {
  const existing = await prisma.email.findFirst({
    where: { id: params.emailId, mailbox: { userId: params.userId } },
    select: {
      id: true,
      mailboxId: true,
      rawContentPath: true,
      attachments: { select: { path: true } },
    },
  });

  if (!existing) return null;

  const storage = getStorage();

  if (existing.rawContentPath) {
    await storage.delete(existing.rawContentPath);
  }

  for (const attachment of existing.attachments) {
    await storage.delete(attachment.path);
  }

  await prisma.email.delete({ where: { id: existing.id } });

  return { id: existing.id, mailboxId: existing.mailboxId };
}

