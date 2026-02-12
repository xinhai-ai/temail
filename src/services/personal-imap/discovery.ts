import { resolveSrv } from "node:dns/promises";

export type ImapConnectionConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  label: string;
  discoveredBy: "preset" | "srv" | "autoconfig" | "autodiscover" | "fallback" | "manual";
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

const DISCOVERY_TIMEOUT_MS = 5000;

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at >= email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function extractTagValue(xml: string, tag: string): string | null {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, "i");
  const match = xml.match(pattern);
  if (!match) return null;
  const value = decodeXmlEntities(match[1]).trim();
  return value || null;
}

function extractBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  const blocks: string[] = [];
  let match = pattern.exec(xml);
  while (match) {
    blocks.push(match[0]);
    match = pattern.exec(xml);
  }
  return blocks;
}

function parsePort(input: string | null): number | null {
  if (!input) return null;
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) return null;
  return parsed;
}

function resolveUsernameTemplate(template: string | null, email: string): string {
  if (!template) return email;
  const [localPart = "", domainPart = ""] = email.split("@");
  const resolved = template
    .replace(/%EMAILADDRESS%/gi, email)
    .replace(/%EMAILLOCALPART%/gi, localPart)
    .replace(/%EMAILDOMAIN%/gi, domainPart)
    .trim();
  return resolved || email;
}

function inferSecure(params: { socketType?: string | null; encryption?: string | null; ssl?: string | null; port: number }): boolean {
  const normalize = (value: string | null | undefined) => (value || "").trim().toLowerCase();

  const socketType = normalize(params.socketType);
  if (socketType.includes("starttls")) return false;
  if (socketType.includes("ssl") || socketType.includes("tls")) return true;

  const encryption = normalize(params.encryption);
  if (encryption.includes("starttls")) return false;
  if (encryption.includes("ssl") || encryption.includes("tls")) return true;

  const ssl = normalize(params.ssl);
  if (ssl === "on" || ssl === "true" || ssl === "1") return true;
  if (ssl === "off" || ssl === "false" || ssl === "0") return false;

  return params.port === 993;
}

async function fetchXml(url: string, init?: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
      headers: {
        Accept: "application/xml, text/xml;q=0.9, */*;q=0.1",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) return null;
    const text = (await response.text()).trim();
    if (!text.startsWith("<")) return null;
    return text;
  } catch {
    return null;
  }
}

function parseAutoconfigXml(xml: string, email: string): ImapConnectionConfig | null {
  const blocks = extractBlocks(xml, "incomingServer");
  for (const block of blocks) {
    const typeMatch = block.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = (typeMatch?.[1] || "").trim().toLowerCase();
    if (type && type !== "imap") continue;

    const host = extractTagValue(block, "hostname") || extractTagValue(block, "server");
    const port = parsePort(extractTagValue(block, "port"));
    if (!host || !port) continue;

    const socketType = extractTagValue(block, "socketType");
    const username = resolveUsernameTemplate(extractTagValue(block, "username"), email);

    return {
      host,
      port,
      secure: inferSecure({ socketType, port }),
      username,
      label: "Autoconfig XML",
      discoveredBy: "autoconfig",
    };
  }
  return null;
}

function parseAutodiscoverXml(xml: string, email: string): ImapConnectionConfig | null {
  const protocolBlocks = extractBlocks(xml, "Protocol");
  for (const block of protocolBlocks) {
    const type = (extractTagValue(block, "Type") || "").trim().toUpperCase();
    if (type !== "IMAP") continue;

    const host = extractTagValue(block, "Server") || extractTagValue(block, "Hostname");
    const port = parsePort(extractTagValue(block, "Port")) || 993;
    if (!host) continue;

    const username = resolveUsernameTemplate(extractTagValue(block, "LoginName"), email);
    const encryption = extractTagValue(block, "Encryption");
    const ssl = extractTagValue(block, "SSL");

    return {
      host,
      port,
      secure: inferSecure({ encryption, ssl, port }),
      username,
      label: "Autodiscover",
      discoveredBy: "autodiscover",
    };
  }
  return null;
}

async function discoverViaAutoconfig(email: string, domain: string): Promise<ImapConnectionConfig | null> {
  const endpoints = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml?emailaddress=${encodeURIComponent(email)}`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];

  for (const endpoint of endpoints) {
    const xml = await fetchXml(endpoint);
    if (!xml) continue;
    const config = parseAutoconfigXml(xml, email);
    if (config) return config;
  }

  return null;
}

async function discoverViaAutodiscover(email: string, domain: string): Promise<ImapConnectionConfig | null> {
  const endpoints = [
    `https://autodiscover.${domain}/autodiscover/autodiscover.xml`,
    `https://${domain}/autodiscover/autodiscover.xml`,
  ];

  const body = `<?xml version="1.0" encoding="utf-8"?>\n<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/requestschema/2006">\n  <Request>\n    <EMailAddress>${email}</EMailAddress>\n    <AcceptableResponseSchema>http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a</AcceptableResponseSchema>\n  </Request>\n</Autodiscover>`;

  for (const endpoint of endpoints) {
    const xml = await fetchXml(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body,
    });
    if (!xml) continue;
    const config = parseAutodiscoverXml(xml, email);
    if (config) return config;
  }

  return null;
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

  const autoconfig = await discoverViaAutoconfig(email, domain);
  if (autoconfig) {
    return {
      ...autoconfig,
      username: params.username?.trim() || autoconfig.username || username,
    };
  }

  const srv = await discoverViaSrv(domain);
  if (srv) {
    return { ...srv, username };
  }

  const autodiscover = await discoverViaAutodiscover(email, domain);
  if (autodiscover) {
    return {
      ...autodiscover,
      username: params.username?.trim() || autodiscover.username || username,
    };
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
