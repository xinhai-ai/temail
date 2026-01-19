import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags, getWebAuthnConfig } from "@/lib/auth-features";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { parseAuthenticatorTransportsJson } from "@/lib/webauthn";
import { readJsonBody } from "@/lib/request";
import { issueLoginToken, issueMfaChallenge } from "@/lib/auth-tokens";

const schema = z.object({
  challengeId: z.string().trim().min(1),
  response: z.unknown(),
});

type FinishBody = {
  challengeId: string;
  response: AuthenticationResponseJSON;
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`passkey:finish:${ip}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.passkeyEnabled) {
    return NextResponse.json({ error: "Passkeys are disabled" }, { status: 403 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 100_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const parsed = schema.parse(bodyResult.data) as FinishBody;

    const now = new Date();
    const challenge = await prisma.authChallenge.findUnique({
      where: { id: parsed.challengeId },
      select: { id: true, purpose: true, challenge: true, expiresAt: true, usedAt: true },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt <= now ||
      challenge.purpose !== "PASSKEY_AUTHENTICATION"
    ) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
    }

    const credentialId = parsed.response.id;
    const credential = await prisma.passkeyCredential.findUnique({
      where: { credentialId },
      select: {
        id: true,
        userId: true,
        credentialId: true,
        publicKey: true,
        counter: true,
        transports: true,
      },
    });
    if (!credential) {
      return NextResponse.json({ error: "Unknown credential" }, { status: 400 });
    }

    const config = await getWebAuthnConfig({ request });

    const transports = parseAuthenticatorTransportsJson(credential.transports);

    const verification = await verifyAuthenticationResponse({
      response: parsed.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      authenticator: {
        credentialID: Buffer.from(credential.credentialId, "base64url"),
        credentialPublicKey: credential.publicKey,
        counter: credential.counter,
        transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Invalid assertion" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: credential.userId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.$transaction([
      prisma.authChallenge.update({
        where: { id: challenge.id },
        data: { usedAt: now },
      }),
      prisma.passkeyCredential.update({
        where: { id: credential.id },
        data: {
          counter: verification.authenticationInfo.newCounter,
          lastUsedAt: now,
        },
      }),
    ]);

    if (flags.otpEnabled) {
      const totp = await prisma.userTotp.findUnique({
        where: { userId: user.id },
        select: { enabledAt: true },
      });
      if (totp?.enabledAt) {
        const mfaToken = await issueMfaChallenge({ userId: user.id, request });
        return NextResponse.json({ requiresOtp: true, mfaToken });
      }
    }

    const loginToken = await issueLoginToken({ userId: user.id, request });
    return NextResponse.json({ loginToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/passkey/finish] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
