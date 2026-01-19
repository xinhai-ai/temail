import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { decryptString } from "@/lib/secret-encryption";
import { verifyTotpCode } from "@/lib/otp";
import { generateBackupCode, hashBackupCode } from "@/lib/backup-codes";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  code: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    if (!totp) {
      return NextResponse.json({ error: "OTP setup is not initialized" }, { status: 400 });
    }
    if (totp.enabledAt) {
      return NextResponse.json({ error: "OTP is already enabled" }, { status: 400 });
    }

    const secretBase32 = decryptString({
      ciphertext: totp.secretCiphertext,
      iv: totp.secretIv,
      tag: totp.secretTag,
    });

    const ok = verifyTotpCode({
      code: data.code,
      issuer: siteName,
      label: user.email,
      secretBase32,
      digits: totp.digits,
      period: totp.period,
      algorithm: totp.algorithm as "SHA1" | "SHA256" | "SHA512",
      window: 1,
    });
    if (!ok) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      backupCodes.push(generateBackupCode());
    }

    const hashed = await Promise.all(backupCodes.map((code) => hashBackupCode(code)));
    const now = new Date();

    await prisma.$transaction([
      prisma.userTotp.update({
        where: { id: totp.id },
        data: { enabledAt: now },
      }),
      prisma.userTotpBackupCode.deleteMany({ where: { userTotpId: totp.id } }),
      prisma.userTotpBackupCode.createMany({
        data: hashed.map((hash) => ({ userTotpId: totp.id, codeHash: hash })),
      }),
    ]);

    return NextResponse.json({ enabled: true, backupCodes });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/me/otp/confirm] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

