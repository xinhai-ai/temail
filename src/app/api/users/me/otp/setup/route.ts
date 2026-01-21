import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { encryptString } from "@/lib/secret-encryption";
import { buildOtpAuthUrl, generateTotpSecretBase32 } from "@/lib/otp";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`otp:setup:${session.user.id}:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isActive: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ["site_name"] } },
    select: { key: true, value: true },
  });
  const siteName = settings.find((x) => x.key === "site_name")?.value?.trim() || "TEmail";

  try {
    const existing = await prisma.userTotp.findUnique({
      where: { userId: user.id },
      select: { id: true, enabledAt: true },
    });
    if (existing?.enabledAt) {
      return NextResponse.json({ error: "OTP is already enabled" }, { status: 400 });
    }

    const secretBase32 = generateTotpSecretBase32();
    const otpauthUrl = buildOtpAuthUrl({
      issuer: siteName,
      label: user.email,
      secretBase32,
    });

    const enc = encryptString(secretBase32);

    const record = await prisma.userTotp.upsert({
      where: { userId: user.id },
      update: {
        secretCiphertext: enc.ciphertext,
        secretIv: enc.iv,
        secretTag: enc.tag,
        enabledAt: null,
      },
      create: {
        userId: user.id,
        secretCiphertext: enc.ciphertext,
        secretIv: enc.iv,
        secretTag: enc.tag,
        enabledAt: null,
      },
      select: { id: true },
    });

    await prisma.userTotpBackupCode.deleteMany({
      where: { userTotpId: record.id },
    });

    return NextResponse.json({ secret: secretBase32, otpauthUrl });
  } catch (error) {
    console.error("[api/users/me/otp/setup] error:", error);
    return NextResponse.json(
      { error: "OTP is not configured on this server" },
      { status: 500 }
    );
  }
}
