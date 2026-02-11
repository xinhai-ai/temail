import type { EmailRestoreStatus, EmailStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { deleteByRecordStorage } from "@/lib/storage/record-storage";

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
      rawStorageBackend: true,
      attachments: { select: { path: true, storageBackend: true } },
    },
  });

  if (!existing) return null;

  if (existing.rawContentPath) {
    await deleteByRecordStorage(existing.rawContentPath, existing.rawStorageBackend);
  }

  for (const attachment of existing.attachments) {
    await deleteByRecordStorage(attachment.path, attachment.storageBackend);
  }

  await prisma.email.delete({ where: { id: existing.id } });

  return { id: existing.id, mailboxId: existing.mailboxId };
}
