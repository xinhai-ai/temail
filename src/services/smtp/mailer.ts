import "server-only";

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import prisma from "@/lib/prisma";

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "smtp_secure"] as const;

type SmtpKey = (typeof SMTP_KEYS)[number];

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
};

export class SmtpConfigError extends Error {
  code: "SMTP_NOT_CONFIGURED" | "SMTP_INVALID_CONFIG";

  constructor(code: SmtpConfigError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function parseBoolean(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function parsePort(value: string | undefined): number | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return null;
  return parsed;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeFrom(value: string | null | undefined, fallbackUser: string | null): string {
  const raw = (value || "").trim();
  if (raw) return raw;
  if (fallbackUser && looksLikeEmail(fallbackUser)) return fallbackUser;
  return "no-reply@example.com";
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: SMTP_KEYS as unknown as string[] } },
    select: { key: true, value: true },
  });

  const map: Partial<Record<SmtpKey, string>> = {};
  for (const row of rows) {
    map[row.key as SmtpKey] = row.value;
  }

  const host = (map.smtp_host || "").trim();
  if (!host) {
    throw new SmtpConfigError("SMTP_NOT_CONFIGURED", "SMTP host is not configured");
  }

  const secure = parseBoolean(map.smtp_secure);
  const port = parsePort(map.smtp_port) ?? (secure ? 465 : 587);

  const user = (map.smtp_user || "").trim() || null;
  const pass = (map.smtp_pass || "").trim() || null;
  if ((user && !pass) || (!user && pass)) {
    throw new SmtpConfigError("SMTP_INVALID_CONFIG", "SMTP username/password must be configured together");
  }

  const from = normalizeFrom(map.smtp_from, user);

  return { host, port, secure, user, pass, from };
}

export async function createSmtpTransporter(): Promise<{ transporter: Transporter; config: SmtpConfig }> {
  const config = await getSmtpConfig();
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
  });
  return { transporter, config };
}

export async function verifySmtpTransport(): Promise<void> {
  const { transporter } = await createSmtpTransporter();
  await transporter.verify();
}

export async function sendSmtpMail(options: {
  to: string;
  subject: string;
  text?: string | null;
  html?: string | null;
  replyTo?: string | null;
}): Promise<{ messageId: string }> {
  const { transporter, config } = await createSmtpTransporter();
  const info = await transporter.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    text: options.text || undefined,
    html: options.html || undefined,
    replyTo: options.replyTo || undefined,
  });
  return { messageId: info.messageId };
}

