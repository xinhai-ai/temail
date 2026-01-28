import "server-only";

import prisma from "@/lib/prisma";

const AUTH_PASSKEY_ENABLED_KEY = "auth_passkey_enabled";
const AUTH_OTP_ENABLED_KEY = "auth_otp_enabled";
const AUTH_EMAIL_VERIFICATION_ENABLED_KEY = "auth_email_verification_enabled";
const AUTH_PASSWORD_RESET_ENABLED_KEY = "auth_password_reset_enabled";
const WEBAUTHN_RP_ID_KEY = "webauthn_rp_id";
const WEBAUTHN_ORIGIN_KEY = "webauthn_origin";

const SITE_NAME_KEY = "site_name";
const SITE_URL_KEY = "site_url";

function parseBoolean(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function normalizeUrl(value: string | undefined): string | null {
  const raw = (value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return null;
  }
}

export type AuthFeatureFlags = {
  passkeyEnabled: boolean;
  otpEnabled: boolean;
  emailVerificationEnabled: boolean;
  passwordResetEnabled: boolean;
};

export async function getAuthFeatureFlags(): Promise<AuthFeatureFlags> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [AUTH_PASSKEY_ENABLED_KEY, AUTH_OTP_ENABLED_KEY, AUTH_EMAIL_VERIFICATION_ENABLED_KEY, AUTH_PASSWORD_RESET_ENABLED_KEY] } },
    select: { key: true, value: true },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  return {
    passkeyEnabled: parseBoolean(map[AUTH_PASSKEY_ENABLED_KEY]),
    otpEnabled: parseBoolean(map[AUTH_OTP_ENABLED_KEY]),
    emailVerificationEnabled: parseBoolean(map[AUTH_EMAIL_VERIFICATION_ENABLED_KEY]),
    passwordResetEnabled: parseBoolean(map[AUTH_PASSWORD_RESET_ENABLED_KEY]),
  };
}

export type WebAuthnConfig = {
  rpID: string;
  origin: string;
  rpName: string;
};

export async function getWebAuthnConfig(options: { request: Request }): Promise<WebAuthnConfig> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [WEBAUTHN_RP_ID_KEY, WEBAUTHN_ORIGIN_KEY, SITE_NAME_KEY, SITE_URL_KEY] } },
    select: { key: true, value: true },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const requestOrigin = new URL(options.request.url).origin;
  const origin =
    normalizeUrl(map[WEBAUTHN_ORIGIN_KEY]) ||
    normalizeUrl(map[SITE_URL_KEY]) ||
    normalizeUrl(process.env.AUTH_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    requestOrigin;

  const rpID = (map[WEBAUTHN_RP_ID_KEY] || "").trim() || new URL(origin).hostname;
  const rpName =
    (map[SITE_NAME_KEY] || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_NAME || "").trim() ||
    "TEmail";

  return { rpID, origin, rpName };
}
