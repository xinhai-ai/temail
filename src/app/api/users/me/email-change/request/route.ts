import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { issueEmailChangeToken, sha256Hex } from "@/lib/auth-tokens";
import { readJsonBody } from "@/lib/request";
import { sendEmailChangeConfirmationEmail } from "@/services/auth/email-change";

const schema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request) || "unknown";

  const limitedUser = rateLimit(`email-change:request:user:${session.user.id}`, { limit: 5, windowMs: 10 * 60_000 });
  if (!limitedUser.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limitedUser.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const limitedIp = rateLimit(`email-change:request:ip:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
  if (!limitedIp.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limitedIp.retryAfterMs / 1000));
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
    const newEmail = data.newEmail.trim();

    const limitedEmail = rateLimit(`email-change:request:email:${sha256Hex(newEmail.toLowerCase())}`, {
      limit: 1,
      windowMs: 60_000,
    });
    if (!limitedEmail.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(limitedEmail.retryAfterMs / 1000));
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (newEmail === user.email) {
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }

    const token = await issueEmailChangeToken({ userId: user.id, newEmail, request });
    try {
      await sendEmailChangeConfirmationEmail({ to: newEmail, token });
    } catch (error) {
      const tokenHash = sha256Hex(token);
      await prisma.emailChangeToken.delete({ where: { tokenHash } }).catch(() => null);
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/me/email-change/request] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

