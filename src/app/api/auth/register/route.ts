import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getRegistrationSettings, isInviteCodeValid } from "@/lib/registration";
import { readJsonBody } from "@/lib/request";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  adminSecret: z.string().optional(),
  inviteCode: z.string().trim().min(1).optional(),
});

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request) || "unknown";
    const limited = rateLimit(`register:${ip}`, { limit: 20, windowMs: 10 * 60_000 });
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

    const { email, password, name, adminSecret, inviteCode } = registerSchema.parse(bodyResult.data);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }

    const userCount = await prisma.user.count();
    const bootstrapSecret = process.env.BOOTSTRAP_SUPER_ADMIN_SECRET;
    const isBootstrap =
      userCount === 0 &&
      typeof bootstrapSecret === "string" &&
      typeof adminSecret === "string" &&
      safeEqual(adminSecret, bootstrapSecret);

    if (!isBootstrap) {
      const { mode, inviteCodes } = await getRegistrationSettings();
      if (mode === "closed") {
        return NextResponse.json(
          { error: "Registration is disabled" },
          { status: 403 }
        );
      }
      if (mode === "invite") {
        if (inviteCodes.length === 0) {
          return NextResponse.json(
            { error: "Invite-code registration is enabled but no invite codes are configured" },
            { status: 500 }
          );
        }
        if (!isInviteCodeValid(inviteCode, inviteCodes)) {
          return NextResponse.json(
            { error: "Invalid invite code" },
            { status: 403 }
          );
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const role = isBootstrap ? "SUPER_ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
