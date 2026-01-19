import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getAuthFeatureFlags, getWebAuthnConfig } from "@/lib/auth-features";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { parseAuthenticatorTransportsJson } from "@/lib/webauthn";

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
  const limited = rateLimit(`passkey:register:begin:${session.user.id}:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!user?.isActive) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getWebAuthnConfig({ request });

  const existing = await prisma.passkeyCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  const excludeCredentials = existing.map((cred) => ({
    id: Buffer.from(cred.credentialId, "base64url"),
    type: "public-key" as const,
    transports: parseAuthenticatorTransportsJson(cred.transports),
  }));

  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name || user.email,
    timeout: 60_000,
    attestationType: "none",
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60_000);
  const userAgent = request.headers.get("user-agent") || null;

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: user.id,
      purpose: "PASSKEY_REGISTRATION",
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
