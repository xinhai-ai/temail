import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { consumeEmailChangeToken, sha256Hex } from "@/lib/auth-tokens";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("emailChange.confirm.ip", `email-change:confirm:ip:${ip}`, { limit: 60, windowMs: 10 * 60_000 });
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
    const consumed = await consumeEmailChangeToken(data.token);
    if (!consumed) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: consumed.userId },
      select: { id: true, email: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: consumed.newEmail },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
    }

    const now = new Date();
    await prisma.user.update({
      where: { id: user.id },
      data: { email: consumed.newEmail, emailVerified: now },
    });

    const userAgent = request.headers.get("user-agent");
    await prisma.log.create({
      data: {
        level: "INFO",
        action: "USER_UPDATE",
        message: "User changed email",
        metadata: JSON.stringify({
          userId: user.id,
          oldEmailHash: sha256Hex(user.email.toLowerCase()),
          newEmailHash: sha256Hex(consumed.newEmail.toLowerCase()),
        }),
        ip: ip || null,
        userAgent: userAgent || null,
        userId: user.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/email-change/confirm] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

