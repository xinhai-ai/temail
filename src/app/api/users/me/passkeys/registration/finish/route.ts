import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags, getWebAuthnConfig } from "@/lib/auth-features";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { readJsonBody } from "@/lib/request";
import { stringifyAuthenticatorTransports } from "@/lib/webauthn";
import { Prisma } from "@prisma/client";

const schema = z.object({
  challengeId: z.string().trim().min(1),
  response: z.unknown(),
});

type FinishBody = {
  challengeId: string;
  response: RegistrationResponseJSON;
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.passkeyEnabled) {
    return NextResponse.json({ error: "Passkeys are disabled" }, { status: 403 });
  }

  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`passkey:register:finish:${session.user.id}:${ip}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 200_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const parsed = schema.parse(bodyResult.data) as FinishBody;

    const now = new Date();
    const challenge = await prisma.authChallenge.findUnique({
      where: { id: parsed.challengeId },
      select: { id: true, userId: true, purpose: true, challenge: true, expiresAt: true, usedAt: true },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt <= now ||
      challenge.purpose !== "PASSKEY_REGISTRATION" ||
      challenge.userId !== session.user.id
    ) {
      return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = await getWebAuthnConfig({ request });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: parsed.response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origin,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      });
    } catch (error) {
      console.warn("[api/users/me/passkeys/registration/finish] verification error:", error);
      return NextResponse.json({ error: "Invalid attestation" }, { status: 400 });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Invalid attestation" }, { status: 400 });
    }

    const { registrationInfo } = verification;
    const credentialId = Buffer.from(registrationInfo.credentialID).toString("base64url");

    const transportsJson = stringifyAuthenticatorTransports(parsed.response.response.transports);

    try {
      const consumed = await prisma.$transaction(async (tx) => {
        const used = await tx.authChallenge.updateMany({
          where: { id: challenge.id, usedAt: null },
          data: { usedAt: now },
        });
        if (used.count !== 1) return false;

        await tx.passkeyCredential.create({
          data: {
            userId: user.id,
            credentialId,
            publicKey: Buffer.from(registrationInfo.credentialPublicKey),
            counter: registrationInfo.counter,
            deviceType: registrationInfo.credentialDeviceType,
            backedUp: registrationInfo.credentialBackedUp,
            transports: transportsJson,
            lastUsedAt: null,
          },
          select: { id: true },
        });
        return true;
      });
      if (!consumed) {
        return NextResponse.json({ error: "Invalid or expired challenge" }, { status: 400 });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "This passkey is already registered" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ registered: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/me/passkeys/registration/finish] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
