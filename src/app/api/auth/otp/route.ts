import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { readJsonBody } from "@/lib/request";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { decryptString } from "@/lib/secret-encryption";
import { verifyTotpCode } from "@/lib/otp";
import { issueLoginToken, sha256Hex } from "@/lib/auth-tokens";
import { verifyBackupCode, normalizeBackupCode } from "@/lib/backup-codes";

const schema = z.object({
  mfaToken: z.string().trim().min(1),
  code: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`otp:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.otpEnabled) {
    return NextResponse.json({ error: "OTP is disabled" }, { status: 403 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 5_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);

    const tokenHash = sha256Hex(data.mfaToken);
    const now = new Date();

    const challenge = await prisma.mfaChallenge.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true, attempts: true },
    });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= now) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }
    if (challenge.attempts >= 10) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      select: { id: true, email: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: ["site_name"] } },
      select: { key: true, value: true },
    });
    const siteName = settings.find((x) => x.key === "site_name")?.value?.trim() || "TEmail";

    const totp = await prisma.userTotp.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        enabledAt: true,
        secretCiphertext: true,
        secretIv: true,
        secretTag: true,
        digits: true,
        period: true,
        algorithm: true,
      },
    });
    if (!totp?.enabledAt) {
      return NextResponse.json({ error: "OTP is not enabled" }, { status: 400 });
    }

    let ok = false;
    const codeRaw = data.code.trim();
    const codeDigitsOnly = /^\d+$/.test(codeRaw);

    if (codeDigitsOnly && codeRaw.length === totp.digits) {
      const secretBase32 = decryptString({
        ciphertext: totp.secretCiphertext,
        iv: totp.secretIv,
        tag: totp.secretTag,
      });

      ok = verifyTotpCode({
        code: codeRaw,
        issuer: siteName,
        label: user.email,
        secretBase32,
        digits: totp.digits,
        period: totp.period,
        algorithm: totp.algorithm as "SHA1" | "SHA256" | "SHA512",
        window: 1,
      });
    } else {
      const normalized = normalizeBackupCode(codeRaw);
      if (normalized) {
        const backups = await prisma.userTotpBackupCode.findMany({
          where: { userTotpId: totp.id, usedAt: null },
          select: { id: true, codeHash: true },
        });

        for (const item of backups) {
          const match = await verifyBackupCode(normalized, item.codeHash);
          if (!match) continue;
          const updated = await prisma.userTotpBackupCode.updateMany({
            where: { id: item.id, usedAt: null },
            data: { usedAt: now },
          });
          if (updated.count === 1) {
            ok = true;
          }
          break;
        }
      }
    }

    if (!ok) {
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    const used = await prisma.mfaChallenge.updateMany({
      where: { id: challenge.id, usedAt: null },
      data: { usedAt: now },
    });
    if (used.count !== 1) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const loginToken = await issueLoginToken({ userId: user.id, request });
    return NextResponse.json({ loginToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/otp] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

