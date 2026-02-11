import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { readJsonBody } from "@/lib/request";
import { verifyTurnstileToken, getTurnstileClientConfig } from "@/lib/turnstile";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { issuePasswordResetToken, sha256Hex } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/services/auth/password-reset";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  turnstileToken: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("auth.password.forgot", `password:forgot:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const flags = await getAuthFeatureFlags();
  if (!flags.passwordResetEnabled) {
    return NextResponse.json({ error: "Password reset is disabled" }, { status: 404 });
  }

  const turnstileConfig = await getTurnstileClientConfig();
  if (!turnstileConfig.enabled && !turnstileConfig.bypass) {
    return NextResponse.json(
      { error: "Password reset requires Turnstile to be enabled and configured" },
      { status: 400 }
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

    const normalizedEmail = data.email.trim();
    const emailKey = sha256Hex(normalizedEmail.toLowerCase());
    const limitedEmail = await rateLimitByPolicy("auth.password.forgot.email", `password:forgot:email:${emailKey}`, { limit: 1, windowMs: 60_000 });
    if (!limitedEmail.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(limitedEmail.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerified: true, isActive: true },
    });

    if (user?.isActive && user.emailVerified) {
      try {
        const token = await issuePasswordResetToken({ userId: user.id, request });
        await sendPasswordResetEmail({ to: user.email, token });
      } catch (error) {
        console.error("[api/auth/password/forgot] failed to send reset email:", error);
      }
    }

    // Always return ok to avoid account enumeration.
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/password/forgot] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
