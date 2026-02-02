import "server-only";

import prisma from "@/lib/prisma";

const EMAIL_REGISTRATION_ENABLED_KEY = "auth_provider_email_registration_enabled";
const GITHUB_ENABLED_KEY = "auth_provider_github_enabled";
const GITHUB_REGISTRATION_ENABLED_KEY = "auth_provider_github_registration_enabled";
const GITHUB_CLIENT_ID_KEY = "auth_provider_github_client_id";
const GITHUB_CLIENT_SECRET_KEY = "auth_provider_github_client_secret";
const LINUXDO_ENABLED_KEY = "auth_provider_linuxdo_enabled";
const LINUXDO_REGISTRATION_ENABLED_KEY = "auth_provider_linuxdo_registration_enabled";
const LINUXDO_CLIENT_ID_KEY = "auth_provider_linuxdo_client_id";
const LINUXDO_CLIENT_SECRET_KEY = "auth_provider_linuxdo_client_secret";

function parseBoolean(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export type AuthProviderConfig = {
  email: {
    registrationEnabled: boolean;
  };
  github: {
    enabled: boolean;
    registrationEnabled: boolean;
    clientId: string | null;
    clientSecret: string | null;
  };
  linuxdo: {
    enabled: boolean;
    registrationEnabled: boolean;
    clientId: string | null;
    clientSecret: string | null;
  };
};

export async function getAuthProviderConfig(): Promise<AuthProviderConfig> {
  const keys = [
    EMAIL_REGISTRATION_ENABLED_KEY,
    GITHUB_ENABLED_KEY,
    GITHUB_REGISTRATION_ENABLED_KEY,
    GITHUB_CLIENT_ID_KEY,
    GITHUB_CLIENT_SECRET_KEY,
    LINUXDO_ENABLED_KEY,
    LINUXDO_REGISTRATION_ENABLED_KEY,
    LINUXDO_CLIENT_ID_KEY,
    LINUXDO_CLIENT_SECRET_KEY,
  ];

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const emailRegistrationEnabled = map[EMAIL_REGISTRATION_ENABLED_KEY] !== "false";
  const githubEnabled = parseBoolean(map[GITHUB_ENABLED_KEY]);
  const githubRegistrationEnabled = map[GITHUB_REGISTRATION_ENABLED_KEY] !== "false";
  const githubClientId = (map[GITHUB_CLIENT_ID_KEY] || "").trim() || null;
  const githubClientSecret = (map[GITHUB_CLIENT_SECRET_KEY] || "").trim() || null;
  const linuxdoEnabled = parseBoolean(map[LINUXDO_ENABLED_KEY]);
  const linuxdoRegistrationEnabled = map[LINUXDO_REGISTRATION_ENABLED_KEY] !== "false";
  const linuxdoClientId = (map[LINUXDO_CLIENT_ID_KEY] || "").trim() || null;
  const linuxdoClientSecret = (map[LINUXDO_CLIENT_SECRET_KEY] || "").trim() || null;

  return {
    email: { registrationEnabled: emailRegistrationEnabled },
    github: {
      enabled: githubEnabled,
      registrationEnabled: githubRegistrationEnabled,
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    },
    linuxdo: {
      enabled: linuxdoEnabled,
      registrationEnabled: linuxdoRegistrationEnabled,
      clientId: linuxdoClientId,
      clientSecret: linuxdoClientSecret,
    },
  };
}

export type AuthProviderFlags = {
  emailRegistrationEnabled: boolean;
  githubLoginEnabled: boolean;
  githubRegistrationEnabled: boolean;
  linuxdoLoginEnabled: boolean;
  linuxdoRegistrationEnabled: boolean;
};

export async function getAuthProviderFlags(): Promise<AuthProviderFlags> {
  const config = await getAuthProviderConfig();
  const githubConfigured = Boolean(config.github.clientId && config.github.clientSecret);
  const githubLoginEnabled = config.github.enabled && githubConfigured;
  const linuxdoConfigured = Boolean(config.linuxdo.clientId && config.linuxdo.clientSecret);
  const linuxdoLoginEnabled = config.linuxdo.enabled && linuxdoConfigured;
  return {
    emailRegistrationEnabled: config.email.registrationEnabled,
    githubLoginEnabled,
    githubRegistrationEnabled: githubLoginEnabled && config.github.registrationEnabled,
    linuxdoLoginEnabled,
    linuxdoRegistrationEnabled: linuxdoLoginEnabled && config.linuxdo.registrationEnabled,
  };
}
