import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { TelegramBindPurpose, TelegramBindingMode } from "@prisma/client";

function generateCode() {
  // 18 bytes => 24 chars base64url-ish, good enough for one-time codes.
  return crypto.randomBytes(18).toString("base64url");
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code, "utf8").digest("hex");
}

export async function createTelegramBindCode(options: {
  userId: string;
  purpose: TelegramBindPurpose;
  mailboxId?: string | null;
  mode?: TelegramBindingMode | null;
  ttlSeconds?: number;
}): Promise<{ code: string; expiresAt: Date }> {
  const ttlSeconds = typeof options.ttlSeconds === "number" && options.ttlSeconds > 0 ? options.ttlSeconds : 10 * 60;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode();
    const codeHash = hashCode(code);
    try {
      await prisma.telegramBindCode.create({
        data: {
          purpose: options.purpose,
          codeHash,
          expiresAt,
          userId: options.userId,
          mailboxId: options.mailboxId ?? null,
          mode: options.mode ?? null,
        },
        select: { id: true },
      });
      return { code, expiresAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unique constraint failed") || message.includes("P2002")) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate Telegram bind code");
}

export async function consumeTelegramBindCode(code: string, purpose: TelegramBindPurpose): Promise<
  | { ok: true; userId: string; mailboxId: string | null; mode: TelegramBindingMode | null }
  | { ok: false; reason: "invalid" | "expired" | "used"; message: string }
> {
  const trimmed = (code || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid", message: "Code is required" };
  }
  const codeHash = hashCode(trimmed);
  const row = await prisma.telegramBindCode.findUnique({
    where: { codeHash },
    select: { userId: true, mailboxId: true, mode: true, purpose: true, expiresAt: true, usedAt: true },
  });

  if (!row || row.purpose !== purpose) {
    return { ok: false, reason: "invalid", message: "Invalid code" };
  }
  if (row.usedAt) {
    return { ok: false, reason: "used", message: "Code has already been used" };
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired", message: "Code has expired" };
  }

  const now = new Date();
  const updated = await prisma.telegramBindCode.updateMany({
    where: { codeHash, purpose, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (updated.count !== 1) {
    return { ok: false, reason: "used", message: "Code is no longer valid" };
  }

  return { ok: true, userId: row.userId, mailboxId: row.mailboxId, mode: row.mode };
}

