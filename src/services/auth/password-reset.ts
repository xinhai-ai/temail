import "server-only";

import { getSystemSettingValue } from "@/services/system-settings";
import { sendSmtpMail } from "@/services/smtp/mailer";

function normalizeOrigin(raw: string | null | undefined): string | null {
  const value = (raw || "").trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function getPublicBaseUrl(): Promise<string> {
  const configured = normalizeOrigin(await getSystemSettingValue("site_url"));
  const fallback =
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.AUTH_URL) ||
    "http://localhost:3000";

  return (configured || fallback).replace(/\/+$/, "");
}

async function getSiteName(): Promise<string> {
  const configured = (await getSystemSettingValue("site_name")) || "";
  const fallback = (process.env.NEXT_PUBLIC_APP_NAME || "").trim() || "TEmail";
  return (configured || fallback).trim() || "TEmail";
}

export async function buildPasswordResetUrl(token: string): Promise<string> {
  const base = await getPublicBaseUrl();
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(options: { to: string; token: string }): Promise<void> {
  const [siteName, url] = await Promise.all([
    getSiteName(),
    buildPasswordResetUrl(options.token),
  ]);

  const subject = `${siteName} - Reset your password`;
  const text = `We received a request to reset your ${siteName} password.\n\nUse the link below to set a new password:\n\n${url}\n\nIf you did not request a password reset, you can ignore this email.`;
  const html = `<p>We received a request to reset your <strong>${siteName}</strong> password.</p>\n<p>Use the link below to set a new password:</p>\n<p><a href="${url}">Reset Password</a></p>\n<p>If you did not request a password reset, you can ignore this email.</p>`;

  await sendSmtpMail({
    to: options.to,
    subject,
    text,
    html,
  });
}

