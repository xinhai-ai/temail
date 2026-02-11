import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { issueEmailVerificationToken, sha256Hex } from "@/lib/auth-tokens";
import { readJsonBody } from "@/lib/request";
import { getTurnstileClientConfig, verifyTurnstileToken } from "@/lib/turnstile";
import { sendEmailVerificationEmail } from "@/services/auth/email-verification";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  turnstileToken: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limitedIp = await rateLimitByPolicy("auth.verifyEmail.resend.ip", `verify-email:resend:ip:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limitedIp.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limitedIp.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.emailVerificationEnabled) {
    return NextResponse.json({ error: "Email verification is disabled" }, { status: 404 });
  }

  const turnstileConfig = await getTurnstileClientConfig();
  if (!turnstileConfig.enabled && !turnstileConfig.bypass) {
    return NextResponse.json(
      { error: "Email verification requires Turnstile to be enabled and configured" },
      { status: 400 }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);
    const normalizedEmail = data.email.trim();
    const emailKey = sha256Hex(normalizedEmail.toLowerCase());

    const limitedEmail = await rateLimitByPolicy("auth.verifyEmail.resend.email", `verify-email:resend:email:${emailKey}`, { limit: 1, windowMs: 60_000 });
    if (!limitedEmail.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(limitedEmail.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const turnstile = await verifyTurnstileToken({ token: data.turnstileToken, ip });
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, isActive: true, emailVerified: true },
    });

    if (user?.isActive && !user.emailVerified) {
      const token = await issueEmailVerificationToken({ userId: user.id, request });
      await sendEmailVerificationEmail({ to: user.email, token });
    }

    // Always return ok to avoid account enumeration.
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/verify-email/resend] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

