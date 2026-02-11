import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { issueLoginToken, issueMfaChallenge } from "@/lib/auth-tokens";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { readJsonBody } from "@/lib/request";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getAuthFeatureFlags } from "@/lib/auth-features";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  turnstileToken: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("auth.login", `login:${ip}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);

    const turnstile = await verifyTurnstileToken({ token: data.turnstileToken, ip });
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, password: true, isActive: true, emailVerified: true },
    });

    if (!user?.password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    if (!user.isActive) {
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    const isValid = await bcrypt.compare(data.password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const flags = await getAuthFeatureFlags();
    if (flags.emailVerificationEnabled && !user.emailVerified) {
      return NextResponse.json({ error: "Email is not verified" }, { status: 403 });
    }
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
    console.error("[api/auth/login] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
