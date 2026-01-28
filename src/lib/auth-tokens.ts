import "server-only";

import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";

const LOGIN_TOKEN_BYTES = 32;
const LOGIN_TOKEN_TTL_MS = 10 * 60_000;
const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60_000;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60_000;
const MFA_CHALLENGE_BYTES = 32;
const MFA_CHALLENGE_TTL_MS = 10 * 60_000;

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateOpaqueToken(bytes: number = LOGIN_TOKEN_BYTES): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export async function issueLoginToken(options: {
  userId: string;
  request?: Request;
  ttlMs?: number;
}): Promise<string> {
  const token = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? LOGIN_TOKEN_TTL_MS));

  const ip = options.request ? getClientIp(options.request) : null;
  const userAgent = options.request?.headers.get("user-agent") || null;

  await prisma.loginToken.create({
    data: {
      userId: options.userId,
      tokenHash: sha256Hex(token),
      expiresAt,
      ip,
      userAgent,
    },
  });

  return token;
}

export async function consumeLoginToken(token: string): Promise<{ userId: string } | null> {
  const raw = token.trim();
  if (!raw) return null;

  const now = new Date();
  const tokenHash = sha256Hex(raw);

  const existing = await prisma.loginToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!existing || existing.usedAt || existing.expiresAt <= now) {
    return null;
  }

  const updated = await prisma.loginToken.updateMany({
    where: { id: existing.id, usedAt: null },
    data: { usedAt: now },
  });
  if (updated.count !== 1) return null;

  return { userId: existing.userId };
}

export async function issueMfaChallenge(options: {
  userId: string;
  request?: Request;
  ttlMs?: number;
}): Promise<string> {
  const token = generateOpaqueToken(MFA_CHALLENGE_BYTES);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? MFA_CHALLENGE_TTL_MS));

  const ip = options.request ? getClientIp(options.request) : null;
  const userAgent = options.request?.headers.get("user-agent") || null;

  await prisma.mfaChallenge.create({
    data: {
      userId: options.userId,
      tokenHash: sha256Hex(token),
      expiresAt,
      ip,
      userAgent,
    },
  });

  return token;
}

export async function issueEmailVerificationToken(options: {
  userId: string;
  request?: Request;
  ttlMs?: number;
}): Promise<string> {
  const token = generateOpaqueToken(EMAIL_VERIFICATION_TOKEN_BYTES);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? EMAIL_VERIFICATION_TOKEN_TTL_MS));

  const ip = options.request ? getClientIp(options.request) : null;
  const userAgent = options.request?.headers.get("user-agent") || null;

  await prisma.emailVerificationToken.create({
    data: {
      userId: options.userId,
      tokenHash: sha256Hex(token),
      expiresAt,
      ip,
      userAgent,
    },
  });

  return token;
}

export async function consumeEmailVerificationToken(token: string): Promise<{ userId: string } | null> {
  const raw = token.trim();
  if (!raw) return null;

  const now = new Date();
  const tokenHash = sha256Hex(raw);

  const existing = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!existing || existing.usedAt || existing.expiresAt <= now) {
    return null;
  }

  const updated = await prisma.emailVerificationToken.updateMany({
    where: { id: existing.id, usedAt: null },
    data: { usedAt: now },
  });
  if (updated.count !== 1) return null;

  return { userId: existing.userId };
}

export async function issuePasswordResetToken(options: {
  userId: string;
  request?: Request;
  ttlMs?: number;
}): Promise<string> {
  const token = generateOpaqueToken(PASSWORD_RESET_TOKEN_BYTES);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.ttlMs ?? PASSWORD_RESET_TOKEN_TTL_MS));

  const ip = options.request ? getClientIp(options.request) : null;
  const userAgent = options.request?.headers.get("user-agent") || null;

  await prisma.passwordResetToken.create({
    data: {
      userId: options.userId,
      tokenHash: sha256Hex(token),
      expiresAt,
      ip,
      userAgent,
    },
  });

  return token;
}

export async function consumePasswordResetToken(token: string): Promise<{ userId: string } | null> {
  const raw = token.trim();
  if (!raw) return null;

  const now = new Date();
  const tokenHash = sha256Hex(raw);

  const existing = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!existing || existing.usedAt || existing.expiresAt <= now) {
    return null;
  }

  const updated = await prisma.passwordResetToken.updateMany({
    where: { id: existing.id, usedAt: null },
    data: { usedAt: now },
  });
  if (updated.count !== 1) return null;

  return { userId: existing.userId };
}
