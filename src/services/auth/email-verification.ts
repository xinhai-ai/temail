import "server-only";

import prisma from "@/lib/prisma";
import { getSystemSettingValue } from "@/services/system-settings";
import { sendSmtpMail } from "@/services/smtp/mailer";
import { sha256Hex } from "@/lib/auth-tokens";
import { pickEmailTemplate, renderEmailTemplate } from "@/services/auth/email-templates";

const VERIFY_EMAIL_TEXT_TEMPLATE_KEY = "email_template_verify_email_text";
const VERIFY_EMAIL_HTML_TEMPLATE_KEY = "email_template_verify_email_html";

const DEFAULT_VERIFY_EMAIL_TEXT_TEMPLATE =
  "Welcome to {{siteName}}.\n\nPlease verify your email address by clicking the link below:\n\n{{actionUrl}}\n\nIf you didn't create an account, you can ignore this email.";

const DEFAULT_VERIFY_EMAIL_HTML_TEMPLATE =
  '<p>Welcome to <strong>{{siteName}}</strong>.</p>\n<p>Please verify your email address by clicking the link below:</p>\n<p><a href="{{actionUrl}}">Verify Email</a></p>\n<p>If you didn\'t create an account, you can ignore this email.</p>';

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

export async function buildVerifyEmailUrl(token: string): Promise<string> {
  const base = await getPublicBaseUrl();
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

export async function sendEmailVerificationEmail(options: { to: string; token: string }): Promise<void> {
  const [siteName, url, customTextTemplate, customHtmlTemplate] = await Promise.all([
    getSiteName(),
    buildVerifyEmailUrl(options.token),
    getSystemSettingValue(VERIFY_EMAIL_TEXT_TEMPLATE_KEY),
    getSystemSettingValue(VERIFY_EMAIL_HTML_TEMPLATE_KEY),
  ]);

  const subject = `${siteName} - Verify your email`;
  const vars = { siteName, actionUrl: url, url };
  const textTemplate = pickEmailTemplate({
    custom: customTextTemplate,
    fallback: DEFAULT_VERIFY_EMAIL_TEXT_TEMPLATE,
    requireActionUrl: true,
  });
  const htmlTemplate = pickEmailTemplate({
    custom: customHtmlTemplate,
    fallback: DEFAULT_VERIFY_EMAIL_HTML_TEMPLATE,
    requireActionUrl: true,
  });

  const text = renderEmailTemplate(textTemplate, vars);
  const html = renderEmailTemplate(htmlTemplate, vars, { html: true });

  await sendSmtpMail({
    to: options.to,
    subject,
    text,
    html,
  });
}

export async function markUserEmailVerified(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
}

export type VerifyEmailTokenResult =
  | { ok: true }
  | { ok: false; error: "missing_token" | "invalid_or_expired" | "internal" };

export async function verifyEmailToken(token: string): Promise<VerifyEmailTokenResult> {
  const raw = token.trim();
  if (!raw) return { ok: false, error: "missing_token" };

  const tokenHash = sha256Hex(raw);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  const now = new Date();
  if (!record || record.expiresAt <= now) {
    return { ok: false, error: "invalid_or_expired" };
  }

  try {
    if (!record.usedAt) {
      await prisma.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
    }

    await prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: now },
    });
  } catch (error) {
    console.error("[email-verification] verify token error:", error);
    return { ok: false, error: "internal" };
  }

  return { ok: true };
}
