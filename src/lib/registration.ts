import crypto from "crypto";

export type RegistrationMode = "open" | "invite" | "closed";

import prisma from "@/lib/prisma";

const REGISTRATION_MODE_KEY = "registration_mode";
const REGISTRATION_INVITE_CODES_KEY = "registration_invite_codes";

function normalizeMode(value: string | undefined): RegistrationMode {
  const raw = (value || "").trim().toLowerCase();
  if (raw === "invite" || raw === "invitation") return "invite";
  if (raw === "closed" || raw === "off" || raw === "disabled" || raw === "false" || raw === "0") return "closed";
  return "open";
}

function parseInviteCodes(value: string | undefined): string[] {
  const raw = (value || "").trim();
  if (!raw) return [];

  const parts = raw
    .split(/[,\n\r\t ]+/)
    .map((code) => code.trim())
    .filter(Boolean);

  return Array.from(new Set(parts));
}

export async function getRegistrationSettings(): Promise<{ mode: RegistrationMode; inviteCodes: string[] }> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [REGISTRATION_MODE_KEY, REGISTRATION_INVITE_CODES_KEY] } },
    select: { key: true, value: true },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  return {
    mode: normalizeMode(map[REGISTRATION_MODE_KEY]),
    inviteCodes: parseInviteCodes(map[REGISTRATION_INVITE_CODES_KEY]),
  };
}

export async function getRegistrationMode(): Promise<RegistrationMode> {
  const { mode } = await getRegistrationSettings();
  return mode;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function isInviteCodeValid(input: string | undefined, inviteCodes: string[]): boolean {
  const code = (input || "").trim();
  if (!code) return false;

  if (inviteCodes.length === 0) return false;

  return inviteCodes.some((allowed) => safeEqual(code, allowed));
}
