import { resolveSrv } from "node:dns/promises";

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  label: string;
  discoveredBy: "preset" | "srv" | "fallback" | "manual";
};

type Preset = {
  host: string;
  port: number;
  secure: boolean;
  label: string;
};

const IMAP_PRESETS: Record<string, Preset> = {
  "gmail.com": { host: "imap.gmail.com", port: 993, secure: true, label: "Gmail" },
  "outlook.com": { host: "outlook.office365.com", port: 993, secure: true, label: "Outlook" },
  "hotmail.com": { host: "outlook.office365.com", port: 993, secure: true, label: "Outlook" },
  "live.com": { host: "outlook.office365.com", port: 993, secure: true, label: "Outlook" },
  "icloud.com": { host: "imap.mail.me.com", port: 993, secure: true, label: "iCloud" },
  "me.com": { host: "imap.mail.me.com", port: 993, secure: true, label: "iCloud" },
  "qq.com": { host: "imap.qq.com", port: 993, secure: true, label: "QQ Mail" },
  "163.com": { host: "imap.163.com", port: 993, secure: true, label: "NetEase 163" },
};

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at >= email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

async function discoverViaSrv(domain: string): Promise<ImapConnectionConfig | null> {
  const candidates: Array<{ record: string; secure: boolean }> = [
    { record: `_imaps._tcp.${domain}`, secure: true },
    { record: `_imap._tcp.${domain}`, secure: false },
  ];

  for (const candidate of candidates) {
    try {
      const records = await resolveSrv(candidate.record);
      if (!records.length) continue;
      const sorted = [...records].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.weight - a.weight;
      });
      const top = sorted[0];
      return {
        host: top.name,
        port: top.port,
        secure: candidate.secure || top.port === 993,
        username: "",
        label: `SRV ${candidate.record}`,
        discoveredBy: "srv",
      };
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export async function discoverImapConnection(params: {
  email: string;
  username?: string;
  host?: string;
  port?: number;
  secure?: boolean;
}): Promise<ImapConnectionConfig> {
  const email = normalizeEmailAddress(params.email);
  const username = (params.username || email).trim();

  if (!email || !username) {
    throw new Error("Email and username are required");
  }

  if (params.host) {
    const port = Number.isFinite(params.port) ? Number(params.port) : 993;
    return {
      host: params.host.trim(),
      port,
      secure: typeof params.secure === "boolean" ? params.secure : port === 993,
      username,
      label: "Manual IMAP",
      discoveredBy: "manual",
    };
  }

  const domain = extractDomain(email);
  if (!domain) {
    throw new Error("Invalid email address");
  }

  const preset = IMAP_PRESETS[domain];
  if (preset) {
    return {
      host: preset.host,
      port: preset.port,
      secure: preset.secure,
      username,
      label: preset.label,
      discoveredBy: "preset",
    };
  }

  const srv = await discoverViaSrv(domain);
  if (srv) {
    return { ...srv, username };
  }

  return {
    host: `imap.${domain}`,
    port: 993,
    secure: true,
    username,
    label: `Fallback imap.${domain}`,
    discoveredBy: "fallback",
  };
}
