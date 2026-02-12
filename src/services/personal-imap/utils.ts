import crypto from "node:crypto";

export const PERSONAL_DOMAIN_SUFFIX = "personal.internal";

export function generatePersonalDomainName(): string {
  const token = crypto.randomBytes(8).toString("hex");
  return `personal-${token}.${PERSONAL_DOMAIN_SUFFIX}`;
}

export function deriveMailboxPrefixFromEmail(email: string): string {
  const localPart = email.trim().toLowerCase().split("@")[0] || "inbox";
  const normalized = localPart.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized.slice(0, 32) || "inbox";
}

export function maskEmailAddress(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 1)}***${local.slice(-1)}@${domain}`;
}
