import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";

import { rateLimitByPolicy } from "@/services/rate-limit-settings";
import { parseOpenApiScopes, serializeOpenApiScopes } from "@/lib/open-api/api-keys";
import { OPEN_API_SCOPES_ZOD } from "@/lib/open-api/scopes";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  scopes: z.array(z.enum(OPEN_API_SCOPES_ZOD)).min(1).max(50).optional(),
  disabled: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByPolicy("openApi.keys.update", `open-api:keys:update:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const feature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "openapi" });
  if (!feature.ok) {
    return NextResponse.json({ error: feature.error, code: feature.code, meta: feature.meta }, { status: feature.status });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);
    const updateData: Prisma.ApiKeyUpdateManyMutationInput = {};

    if (typeof data.name === "string") {
      updateData.name = data.name;
    }

    if (Array.isArray(data.scopes)) {
      updateData.scopes = serializeOpenApiScopes(data.scopes);
    }

    if (typeof data.disabled === "boolean") {
      updateData.disabledAt = data.disabled ? new Date() : null;
    }

    const updated = await prisma.apiKey.updateMany({
      where: { id, userId: session.user.id, deletedAt: null },
      data: updateData,
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    const key = await prisma.apiKey.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        usageCount: true,
        lastUsedAt: true,
        disabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      key: key
        ? { ...key, scopes: parseOpenApiScopes(key.scopes) }
        : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open-api/keys] update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByPolicy("openApi.keys.delete", `open-api:keys:delete:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const feature = await assertUserGroupFeatureEnabled({ userId: session.user.id, feature: "openapi" });
  if (!feature.ok) {
    return NextResponse.json({ error: feature.error, code: feature.code, meta: feature.meta }, { status: feature.status });
  }

  const { id } = await params;

  const result = await prisma.apiKey.updateMany({
    where: { id, userId: session.user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
