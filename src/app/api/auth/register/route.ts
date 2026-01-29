import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getRegistrationSettings, isInviteCodeValid } from "@/lib/registration";
import { getAuthFeatureFlags } from "@/lib/auth-features";
import { getTurnstileClientConfig } from "@/lib/turnstile";
import { readJsonBody } from "@/lib/request";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { issueEmailVerificationToken } from "@/lib/auth-tokens";
import { sendEmailVerificationEmail } from "@/services/auth/email-verification";
import { getOrCreateDefaultUserGroupId } from "@/services/usergroups/default-group";
import { getAuthProviderConfig } from "@/lib/auth-providers";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  adminSecret: z.string().optional(),
  inviteCode: z.string().trim().min(1).optional(),
  turnstileToken: z.string().trim().min(1).optional(),
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

    const { email, password, name, adminSecret, inviteCode, turnstileToken } = registerSchema.parse(bodyResult.data);

    const turnstile = await verifyTurnstileToken({ token: turnstileToken, ip });
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error }, { status: 400 });
    }

    const flags = await getAuthFeatureFlags();

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
    const bootstrapMail = process.env.BOOTSTRAP_SUPER_ADMIN_MAIL?.trim().toLowerCase();
    const mailMatches = !bootstrapMail || bootstrapMail === email.trim().toLowerCase();
    const isBootstrap =
      userCount === 0 &&
      typeof bootstrapSecret === "string" &&
      typeof adminSecret === "string" &&
      safeEqual(adminSecret, bootstrapSecret) &&
      mailMatches;

    if (!isBootstrap) {
      const providers = await getAuthProviderConfig();
      if (!providers.email.registrationEnabled) {
        return NextResponse.json(
          { error: "Email registration is disabled" },
          { status: 403 }
        );
      }

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
    const requiresEmailVerification = flags.emailVerificationEnabled && !isBootstrap;
    const userGroupId = role === "USER" ? await getOrCreateDefaultUserGroupId() : null;

    if (requiresEmailVerification) {
      const turnstileConfig = await getTurnstileClientConfig();
      if (!turnstileConfig.enabled && !turnstileConfig.bypass) {
        return NextResponse.json(
          { error: "Email verification requires Turnstile to be enabled and configured" },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        ...(userGroupId ? { userGroupId } : {}),
        emailVerified: requiresEmailVerification ? null : new Date(),
      },
    });

    if (requiresEmailVerification) {
      try {
        const token = await issueEmailVerificationToken({ userId: user.id, request });
        await sendEmailVerificationEmail({ to: user.email, token });
      } catch (error) {
        console.error("[api/auth/register] failed to send verification email:", error);
        try {
          await prisma.user.delete({ where: { id: user.id } });
        } catch (cleanupError) {
          console.error("[api/auth/register] failed to cleanup user after mail error:", cleanupError);
        }
        return NextResponse.json(
          { error: "Failed to send verification email" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      requiresEmailVerification,
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
