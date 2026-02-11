import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request) || "unknown";
  const limited = await rateLimitByPolicy("users.otp.disable", `otp:disable:${session.user.id}:${ip}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 5_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true, isActive: true },
    });
    if (!user?.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!user.password) {
      return NextResponse.json({ error: "Password is not set for this account" }, { status: 400 });
    }

    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    await prisma.userTotp.delete({
      where: { userId: user.id },
    }).catch(() => null);

    return NextResponse.json({ disabled: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/me/otp/disable] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
