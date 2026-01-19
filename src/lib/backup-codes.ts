import bcrypt from "bcryptjs";
import crypto from "crypto";

const BACKUP_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const BACKUP_CODE_LENGTH = 10;

export function normalizeBackupCode(value: string): string {
  return (value || "")
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

export function formatBackupCode(value: string): string {
  const normalized = normalizeBackupCode(value);
  if (normalized.length <= 5) return normalized;
  return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
}

export function generateBackupCode(): string {
  const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
  let raw = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i += 1) {
    raw += BACKUP_CODE_ALPHABET[bytes[i] % BACKUP_CODE_ALPHABET.length];
  }
  return formatBackupCode(raw);
}

export async function hashBackupCode(code: string, cost: number = 12): Promise<string> {
  const normalized = normalizeBackupCode(code);
  return bcrypt.hash(normalized, cost);
}

export async function verifyBackupCode(code: string, hash: string): Promise<boolean> {
  const normalized = normalizeBackupCode(code);
  if (!normalized) return false;
  return bcrypt.compare(normalized, hash);
}
