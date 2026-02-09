import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

export type LinuxDoProfile = {
  id: number | string;
  email?: string;
  username?: string;
  name?: string;
  avatar_template?: string;
  trust_level?: number;
  active?: boolean;
  silenced?: boolean;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function linuxDoAvatarUrl(avatarTemplate: unknown, size: number): string | null {
  const template = normalizeString(avatarTemplate);
  if (!template) return null;

  const replaced = template.replaceAll("{size}", String(size));
  if (replaced.startsWith("https://") || replaced.startsWith("http://")) return replaced;
  if (replaced.startsWith("//")) return `https:${replaced}`;
  if (replaced.startsWith("/")) return `https://connect.linux.do${replaced}`;
  return replaced;
}

export default function LinuxDo(options: OAuthUserConfig<LinuxDoProfile>): OAuthConfig<LinuxDoProfile> {
  return {
    id: "linuxdo",
    name: "LinuxDO",
    type: "oauth",
    authorization: {
      url: "https://connect.linux.do/oauth2/authorize",
      params: { scope: "user" },
    },
    token: "https://connect.linux.do/oauth2/token",
    userinfo: "https://connect.linux.do/api/user",
    profile(profile) {
      const id = typeof profile.id === "number" || typeof profile.id === "string" ? String(profile.id) : "";
      const email = normalizeString(profile.email);
      const username = normalizeString(profile.username);
      const fallbackEmail = id ? `linuxdo_${id}@users.noreply.local` : null;

      return {
        id: id || username || (email ?? ""),
        email: email ?? fallbackEmail ?? undefined,
        name: username ?? null,
        image: linuxDoAvatarUrl(profile.avatar_template, 120),
        role: "USER",
      };
    },
    options,
  };
}
