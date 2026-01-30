import "server-only";

import prisma from "@/lib/prisma";
import { getClientIp } from "@/lib/api-rate-limit";
import {
  hasOpenApiScope,
  hashOpenApiKeyToken,
  parseOpenApiKeyToken,
  parseOpenApiScopes,
} from "@/lib/open-api/api-keys";
import type { OpenApiScope } from "@/lib/open-api/scopes";
import { assertUserGroupFeatureEnabled } from "@/services/usergroups/policy";

export type OpenApiAuthOk = {
  ok: true;
  apiKey: {
    id: string;
    userId: string;
    scopes: OpenApiScope[];
  };
};

export type OpenApiAuthError = {
  ok: false;
  status: 401 | 403 | 500;
  error: string;
};

export type OpenApiAuthResult = OpenApiAuthOk | OpenApiAuthError;

function extractBearerToken(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice("bearer ".length).trim();
  return token || null;
}

export function getOpenApiTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const bearer = extractBearerToken(authorization);
    if (bearer) return bearer;
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey) return apiKey.trim() || null;

  return null;
}

export async function authenticateOpenApiRequest(
  request: Request,
  options?: { requiredScopes?: OpenApiScope | OpenApiScope[] }
): Promise<OpenApiAuthResult> {
  try {
    const token = getOpenApiTokenFromRequest(request);
    if (!token) {
      return { ok: false, status: 401, error: "Missing API key" };
    }

    const parsed = parseOpenApiKeyToken(token);
    if (!parsed) {
      return { ok: false, status: 401, error: "Invalid API key" };
    }

    const keyHash = hashOpenApiKeyToken(parsed.token);
    const key = await prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        userId: true,
        scopes: true,
        disabledAt: true,
        deletedAt: true,
      },
    });

    if (!key || key.deletedAt) {
      return { ok: false, status: 401, error: "Invalid API key" };
    }

    if (key.disabledAt) {
      return { ok: false, status: 403, error: "API key disabled" };
    }

    const scopes = parseOpenApiScopes(key.scopes);
    const required = options?.requiredScopes;
    if (required && !hasOpenApiScope(scopes, required)) {
      return { ok: false, status: 403, error: "Missing scope" };
    }

    const feature = await assertUserGroupFeatureEnabled({ userId: key.userId, feature: "openapi" });
    if (!feature.ok) {
      const status = feature.status === 404 ? 401 : feature.status;
      if (status !== 401 && status !== 403 && status !== 500) {
        return { ok: false, status: 500, error: "Internal server error" };
      }
      return { ok: false, status, error: feature.error };
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") || null;
    const now = new Date();

    try {
      await prisma.apiKey.update({
        where: { id: key.id },
        data: {
          usageCount: { increment: 1 },
          lastUsedAt: now,
          lastUsedIp: ip,
          lastUsedUserAgent: userAgent,
        },
      });
    } catch (error) {
      console.error("[open-api] failed to record api key usage:", error);
    }

    return { ok: true, apiKey: { id: key.id, userId: key.userId, scopes } };
  } catch (error) {
    console.error("[open-api] auth failed:", error);
    return { ok: false, status: 500, error: "Internal server error" };
  }
}
