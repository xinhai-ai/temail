import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { readJsonBody } from "@/lib/request";
import { consumePasswordResetToken } from "@/lib/auth-tokens";
import { getAuthFeatureFlags } from "@/lib/auth-features";

const schema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("auth.password.reset", `password:reset:${ip}`, { limit: 30, windowMs: 10 * 60_000 });
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

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);
    const consumed = await consumePasswordResetToken(data.token);
    if (!consumed) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/password/reset] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

