import "server-only";

import prisma from "@/lib/prisma";

const TURNSTILE_ENABLED_KEY = "turnstile_enabled";
const TURNSTILE_SITE_KEY = "turnstile_site_key";
const TURNSTILE_SECRET_KEY = "turnstile_secret_key";

export type TurnstileClientConfig = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  misconfigured: boolean;
};

type TurnstileState = {
  enabled: boolean;
  bypass: boolean;
  siteKey: string | null;
  secretKey: string | null;
  active: boolean;
};

function parseBoolean(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

function normalizeKey(value: string | undefined): string | null {
  const v = (value || "").trim();
  return v ? v : null;
}

export function isTurnstileDevBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const raw = (process.env.TURNSTILE_DEV_BYPASS || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function getTurnstileState(): Promise<TurnstileState> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [TURNSTILE_ENABLED_KEY, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY] } },
    select: { key: true, value: true },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const enabled = parseBoolean(map[TURNSTILE_ENABLED_KEY]);
  const siteKey = normalizeKey(map[TURNSTILE_SITE_KEY]);
  const secretKey = normalizeKey(map[TURNSTILE_SECRET_KEY]);
  const bypass = isTurnstileDevBypassEnabled();

  const active = enabled && !bypass && Boolean(siteKey) && Boolean(secretKey);
  return { enabled, bypass, siteKey, secretKey, active };
}

export async function getTurnstileClientConfig(): Promise<TurnstileClientConfig> {
  const state = await getTurnstileState();
  return {
    enabled: state.active,
    bypass: state.bypass,
    siteKey: state.siteKey,
    misconfigured: state.enabled && !state.bypass && !state.active,
  };
}

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

export async function verifyTurnstileToken(options: {
  token: string | null | undefined;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const state = await getTurnstileState();
  if (!state.active) {
    return { ok: true };
  }

  const token = (options.token || "").trim();
  if (!token) {
    return { ok: false, error: "Please complete the Turnstile challenge." };
  }

  const params = new URLSearchParams();
  params.set("secret", state.secretKey as string);
  params.set("response", token);
  const ip = (options.ip || "").trim();
  if (ip) params.set("remoteip", ip);

  let res: Response;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch {
    return { ok: false, error: "Turnstile verification failed. Please try again." };
  }

  if (!res.ok) {
    return { ok: false, error: "Turnstile verification failed. Please try again." };
  }

  const data = (await res.json().catch(() => null)) as TurnstileVerifyResponse | null;
  if (!data?.success) {
    return { ok: false, error: "Turnstile verification failed. Please try again." };
  }

  return { ok: true };
}

