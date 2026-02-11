import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags, getWebAuthnConfig } from "@/lib/auth-features";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("auth.passkey.begin", `passkey:begin:${ip}`, { limit: 30, windowMs: 10 * 60_000 });
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

  const config = await getWebAuthnConfig({ request });

  const options = await generateAuthenticationOptions({
    rpID: config.rpID,
    userVerification: "required",
    timeout: 60_000,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000);
  const userAgent = request.headers.get("user-agent") || null;

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: null,
      purpose: "PASSKEY_AUTHENTICATION",
      challenge: options.challenge,
      expiresAt,
      usedAt: null,
      ip,
      userAgent,
    },
    select: { id: true },
  });

  return NextResponse.json({ options, challengeId: challenge.id });
}

