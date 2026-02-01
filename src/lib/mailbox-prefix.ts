const RESERVED_PREFIXES = [
  "abuse",
  "admin",
  "administrator",
  "billing",
  "do-not-reply",
  "donotreply",
  "help",
  "helpdesk",
  "hostmaster",
  "mailer-daemon",
  "no-reply",
  "noreply",
  "postmaster",
  "root",
  "security",
  "support",
  "super-admin",
  "superadmin",
  "system",
] as const;

const RESERVED_PREFIX_BOUNDARY = /[0-9._-]/;

export function normalizeMailboxPrefix(prefix: string): string {
  return (prefix || "").trim().toLowerCase();
}

export function isReservedMailboxPrefix(prefix: string): boolean {
  const normalized = normalizeMailboxPrefix(prefix);
  if (!normalized) return false;

  for (const reserved of RESERVED_PREFIXES) {
    if (normalized === reserved) return true;

    if (normalized.startsWith(reserved)) {
      const next = normalized[reserved.length];
      if (next && RESERVED_PREFIX_BOUNDARY.test(next)) return true;
    }
  }

  return false;
}

