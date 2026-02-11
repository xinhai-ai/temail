import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { issueLoginToken, sha256Hex } from "@/lib/auth-tokens";
import { readJsonBody } from "@/lib/request";

const schema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("auth.verifyEmail", `verify-email:${ip}`, { limit: 60, windowMs: 10 * 60_000 });
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

    const raw = data.token.trim();
    const tokenHash = sha256Hex(raw);
    const record = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    const now = new Date();
    if (!record || record.expiresAt <= now) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    let canIssueLoginToken = false;
    if (!record.usedAt) {
      const updated = await prisma.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      canIssueLoginToken = updated.count === 1;
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: now },
    });

    const loginToken = canIssueLoginToken ? await issueLoginToken({ userId: record.userId, request }) : null;

    return NextResponse.json({ ok: true, loginToken });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/verify-email] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
