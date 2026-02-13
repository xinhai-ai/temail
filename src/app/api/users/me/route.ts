import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";
import { computeAuthSources, uniqueOAuthProviders } from "@/lib/auth-sources";
import { getClientIp } from "@/lib/api-rate-limit";
import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { setUserMailContentStoragePreferenceCache } from "@/services/user-mail-content-storage";

const patchSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, "Name is too long")
    .nullable()
    .optional(),
  storeRawAndAttachments: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      storeRawAndAttachments: true,
      role: true,
      createdAt: true,
      password: true,
      accounts: { select: { provider: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const oauthProviders = uniqueOAuthProviders(user.accounts);
  const hasPassword = Boolean(user.password);

  return NextResponse.json({
    email: user.email,
    name: user.name,
    storeRawAndAttachments: user.storeRawAndAttachments,
    role: user.role,
    createdAt: user.createdAt,
    authSources: computeAuthSources({ hasPassword, oauthProviders }),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByPolicy("users.me.update", `users:me:update:${session.user.id}`, { limit: 30, windowMs: 60_000 });
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
    const data = patchSchema.parse(bodyResult.data);
    const updateData: {
      name?: string | null;
      storeRawAndAttachments?: boolean;
    } = {};

    if (data.name !== undefined) {
      const nextName = typeof data.name === "string" ? data.name.trim() : data.name;
      updateData.name = nextName ? nextName : null;
    }
    if (typeof data.storeRawAndAttachments === "boolean") {
      updateData.storeRawAndAttachments = data.storeRawAndAttachments;
    }
    if (!("name" in updateData) && !("storeRawAndAttachments" in updateData)) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { email: true, name: true, storeRawAndAttachments: true },
    });
    await setUserMailContentStoragePreferenceCache(session.user.id, updated.storeRawAndAttachments);

    try {
      const ip = getClientIp(request);
      const userAgent = request.headers.get("user-agent");
      await prisma.log.create({
        data: {
          level: "INFO",
          action: "USER_UPDATE",
          message: "User updated profile",
          metadata: JSON.stringify({
            userId: session.user.id,
            updatedFields: Object.keys(updateData),
          }),
          ip: ip || null,
          userAgent: userAgent || null,
          userId: session.user.id,
        },
      });
    } catch (error) {
      console.error("[api/users/me] failed to write audit log:", error);
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/users/me] update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
