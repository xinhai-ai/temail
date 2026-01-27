import "server-only";

import crypto from "crypto";
import { OPEN_API_SCOPES, type OpenApiScope } from "@/lib/open-api/scopes";

export const OPEN_API_KEY_TAG = "temail_api_v1";

const PREFIX_BYTES = 6;
const SECRET_BYTES = 24;

function getPepper() {
  const value = process.env.OPEN_API_KEY_PEPPER || process.env.AUTH_SECRET || "";
  if (!value) {
    throw new Error("OPEN_API_KEY_PEPPER (or AUTH_SECRET) is required");
  }
  return value;
}

export function isOpenApiKeyToken(token: string): boolean {
  return token.trim().startsWith(`${OPEN_API_KEY_TAG}.`);
}

export function parseOpenApiKeyToken(raw: string): { token: string; keyPrefix: string } | null {
  const token = raw.trim();
  if (!token) return null;
  if (!token.startsWith(`${OPEN_API_KEY_TAG}.`)) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [tag, keyPrefix, secret] = parts;
  if (tag !== OPEN_API_KEY_TAG) return null;
  if (!keyPrefix || !secret) return null;

  return { token, keyPrefix };
}

export function hashOpenApiKeyToken(token: string): string {
  return crypto.createHmac("sha256", getPepper()).update(token, "utf8").digest("hex");
}

export function generateOpenApiKeyToken(): { token: string; keyPrefix: string; keyHash: string } {
  const keyPrefix = crypto.randomBytes(PREFIX_BYTES).toString("base64url");
  const secret = crypto.randomBytes(SECRET_BYTES).toString("base64url");
  const token = `${OPEN_API_KEY_TAG}.${keyPrefix}.${secret}`;
  return { token, keyPrefix, keyHash: hashOpenApiKeyToken(token) };
}

export function serializeOpenApiScopes(scopes: OpenApiScope[]): string {
  const unique = Array.from(new Set(scopes));
  unique.sort();
  return JSON.stringify(unique);
}

export function parseOpenApiScopes(value: string): OpenApiScope[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    const allowed = new Set<string>(OPEN_API_SCOPES);
    const normalized: OpenApiScope[] = [];
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (!allowed.has(trimmed)) continue;
      normalized.push(trimmed as OpenApiScope);
    }

    return Array.from(new Set(normalized)).sort();
  } catch {
    return [];
  }
}

export function hasOpenApiScope(scopes: OpenApiScope[], required: OpenApiScope | OpenApiScope[]): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  const scopeSet = new Set(scopes);
  return requiredList.every((scope) => scopeSet.has(scope));
}
