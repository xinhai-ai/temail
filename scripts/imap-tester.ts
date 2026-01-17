import { ImapFlow, type MessageAddressObject } from "imapflow";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import prisma from "../src/lib/prisma";

type ParsedArgs = {
  help: boolean;
  domain?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  mailbox: string;
  sinceMinutes: number;
  limit: number;
  uid?: number;
  noSource: boolean;
  noParse: boolean;
  fullSource: boolean;
  maxSourceBytes: number;
  verbose: boolean;
};

type ImapRuntime = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  mailbox: string;
};

type ResolveResult = { ok: true; runtime: ImapRuntime; source: string } | { ok: false; error: string };

const DEFAULT_MAILBOX = "INBOX";
const DEFAULT_SINCE_MINUTES = 120;
const DEFAULT_LIMIT = 10;
const DEFAULT_MAX_SOURCE_BYTES = 256 * 1024;

function usage() {
  return [
    "IMAP tester (receive check)",
    "",
    "Usage:",
    "  npm run imap:test -- [options]",
    "  npx tsx scripts/imap-tester.ts [options]",
    "",
    "Options:",
    "  --domain <domainId|domainName>   Load IMAP config from DB (domains + imapConfig)",
    "  --host <host>                   IMAP host (or env IMAP_HOST)",
    "  --port <port>                   IMAP port (or env IMAP_PORT)",
    "  --secure | --insecure           TLS on/off (or env IMAP_SECURE)",
    "  --user <username>               IMAP username (or env IMAP_USER)",
    "  --pass <password>               IMAP password (or env IMAP_PASS)",
    "  --mailbox <name>                Default: INBOX (or env IMAP_MAILBOX)",
    "  --since-minutes <n>             Default: 120 (or env IMAP_SINCE_MINUTES)",
    "  --limit <n>                     Default: 10",
    "  --uid <n>                       Fetch only this UID",
    "  --no-source                     Do not fetch message source (envelope-only)",
    "  --no-parse                      Do not parse message source (even if fetched)",
    "  --max-source-bytes <n>          Default: 262144 (256 KiB)",
    "  --full-source                   Fetch full message source (no max length)",
    "  --verbose                       Print extra details",
    "  --help                          Show this help",
    "",
    "Examples:",
    "  npm run imap:test -- --host imap.example.com --port 993 --secure --user alice --pass \"***\" --limit 5",
    "  npm run imap:test -- --domain example.com --limit 3 --verbose",
  ].join("\n");
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  if (value === "1" || value.toLowerCase() === "true") return true;
  if (value === "0" || value.toLowerCase() === "false") return false;
  return undefined;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseArgs(argv: string[]): { ok: true; args: ParsedArgs } | { ok: false; error: string } {
  const valueArgs = new Set([
    "domain",
    "host",
    "port",
    "user",
    "pass",
    "mailbox",
    "since-minutes",
    "limit",
    "uid",
    "max-source-bytes",
  ]);

  const flagArgs = new Set([
    "secure",
    "insecure",
    "no-source",
    "no-parse",
    "full-source",
    "verbose",
    "help",
  ]);

  const raw: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      return { ok: false, error: `Unexpected argument: ${token}` };
    }

    const trimmed = token.slice(2);
    if (!trimmed) {
      return { ok: false, error: "Invalid flag: --" };
    }

    const [key, inlineValue] = trimmed.split("=", 2);
    if (!key) {
      return { ok: false, error: `Invalid flag: ${token}` };
    }

    if (!valueArgs.has(key) && !flagArgs.has(key)) {
      return { ok: false, error: `Unknown option: --${key}` };
    }

    if (valueArgs.has(key)) {
      const value = inlineValue ?? argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { ok: false, error: `Missing value for --${key}` };
      }
      raw[key] = value;
      if (inlineValue === undefined) index += 1;
      continue;
    }

    raw[key] = true;
  }

  const mailbox = (raw["mailbox"] as string | undefined) || process.env.IMAP_MAILBOX || DEFAULT_MAILBOX;
  const sinceMinutes =
    parseNumber(raw["since-minutes"] as string | undefined) ||
    parseNumber(process.env.IMAP_SINCE_MINUTES) ||
    DEFAULT_SINCE_MINUTES;
  const limit = parseNumber(raw["limit"] as string | undefined) || DEFAULT_LIMIT;
  const maxSourceBytes =
    parseNumber(raw["max-source-bytes"] as string | undefined) || DEFAULT_MAX_SOURCE_BYTES;

  const args: ParsedArgs = {
    help: Boolean(raw.help),
    domain: raw.domain ? String(raw.domain) : undefined,
    host: raw.host ? String(raw.host) : undefined,
    port: parseNumber(raw.port ? String(raw.port) : undefined),
    secure: raw.secure ? true : raw.insecure ? false : undefined,
    user: raw.user ? String(raw.user) : undefined,
    pass: raw.pass ? String(raw.pass) : undefined,
    mailbox,
    sinceMinutes,
    limit,
    uid: parseNumber(raw.uid ? String(raw.uid) : undefined),
    noSource: Boolean(raw["no-source"]),
    noParse: Boolean(raw["no-parse"]),
    fullSource: Boolean(raw["full-source"]),
    maxSourceBytes,
    verbose: Boolean(raw.verbose),
  };

  return { ok: true, args };
}

function formatAddresses(addresses: MessageAddressObject[] | undefined) {
  if (!addresses || addresses.length === 0) return "-";
  return addresses
    .map((addr) => {
      const name = typeof addr.name === "string" ? addr.name.trim() : "";
      const address = typeof addr.address === "string" ? addr.address.trim() : "";
      if (name && address) return `${name} <${address}>`;
      return address || name || "";
    })
    .filter(Boolean)
    .join(", ");
}

function formatMailparserAddresses(value: AddressObject | AddressObject[] | null | undefined) {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const texts = value.map((entry) => entry.text).filter(Boolean);
    return texts.join(", ");
  }
  return value.text;
}

function buildTextSnippet(parsed: ParsedMail | null) {
  const raw = (parsed?.text || "").replace(/\s+/g, " ").trim();
  if (!raw) return undefined;
  return raw.slice(0, 240);
}

async function resolveImapRuntime(args: ParsedArgs): Promise<ResolveResult> {
  if (args.domain) {
    const domain = await prisma.domain.findFirst({
      where: { OR: [{ id: args.domain }, { name: args.domain }] },
      include: { imapConfig: true },
    });

    if (!domain) return { ok: false, error: `Domain not found: ${args.domain}` };
    if (!domain.imapConfig) return { ok: false, error: `Domain has no IMAP config: ${domain.name}` };

    return {
      ok: true,
      source: `db:domain=${domain.name}`,
      runtime: {
        host: domain.imapConfig.host,
        port: domain.imapConfig.port,
        secure: domain.imapConfig.secure,
        user: domain.imapConfig.username,
        pass: domain.imapConfig.password,
        mailbox: args.mailbox || DEFAULT_MAILBOX,
      },
    };
  }

  const host = args.host || process.env.IMAP_HOST;
  if (!host) return { ok: false, error: "Missing IMAP host (use --host or IMAP_HOST)" };

  const port = args.port || parseNumber(process.env.IMAP_PORT) || 993;

  const secure =
    typeof args.secure === "boolean"
      ? args.secure
      : parseBooleanEnv(process.env.IMAP_SECURE) ?? port === 993;

  const user = args.user || process.env.IMAP_USER;
  if (!user) return { ok: false, error: "Missing IMAP user (use --user or IMAP_USER)" };

  const pass = args.pass || process.env.IMAP_PASS;
  if (!pass) return { ok: false, error: "Missing IMAP pass (use --pass or IMAP_PASS)" };

  return {
    ok: true,
    source: "args/env",
    runtime: { host, port, secure, user, pass, mailbox: args.mailbox || DEFAULT_MAILBOX },
  };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  if (parsed.args.help) {
    console.log(usage());
    return;
  }

  const resolved = await resolveImapRuntime(parsed.args);
  if (!resolved.ok) {
    console.error(resolved.error);
    console.error("");
    console.error(usage());
    process.exitCode = 1;
    return;
  }

  const runtime = resolved.runtime;
  const includeSource = !parsed.args.noSource;
  const includeParse = includeSource && !parsed.args.noParse;
  const sourceQuery = includeSource
    ? parsed.args.fullSource
      ? true
      : { maxLength: Math.max(1, parsed.args.maxSourceBytes) }
    : false;

  console.log("[imap] starting tester");
  console.log(`[imap] source=${resolved.source}`);
  console.log(`[imap] host=${runtime.host} port=${runtime.port} secure=${runtime.secure}`);
  console.log(`[imap] user=${runtime.user}`);
  console.log(`[imap] mailbox=${runtime.mailbox}`);

  const client = new ImapFlow({
    host: runtime.host,
    port: runtime.port,
    secure: runtime.secure,
    auth: {
      user: runtime.user,
      pass: runtime.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("[imap] connected");

    const lock = await client.getMailboxLock(runtime.mailbox);
    try {
      const mailbox = client.mailbox;
      if (!mailbox) {
        console.log("[imap] mailbox selected, but no mailbox info returned");
      } else {
        console.log(
          `[imap] selected=${mailbox.path} exists=${mailbox.exists} uidNext=${mailbox.uidNext} uidValidity=${mailbox.uidValidity.toString()}`
        );
      }

      const since = new Date(Date.now() - parsed.args.sinceMinutes * 60_000);

      const searchResult = await client.search({ since });
      const allUids = Array.isArray(searchResult) ? searchResult : [];
      const sortedUids = allUids
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .sort((a, b) => a - b);

      const selectedUids = (() => {
        if (typeof parsed.args.uid === "number") return [parsed.args.uid];
        const limit = Math.max(1, parsed.args.limit);
        return sortedUids.slice(-limit);
      })();

      console.log(
        `[imap] search since=${since.toISOString()} matched=${sortedUids.length} showing=${selectedUids.length}`
      );

      if (selectedUids.length === 0) {
        console.log("[imap] no messages found");
        return;
      }

      const query = {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        size: true,
        source: sourceQuery,
      } as const;

      for await (const message of client.fetch(selectedUids, query)) {
        const uid = typeof message.uid === "number" ? message.uid : undefined;
        const envelope = message.envelope;
        const internalDate = message.internalDate;
        const flags = message.flags;
        const size = message.size;

        const raw = message.source?.toString("utf8") || "";
        const parsedMail = includeParse && raw ? await simpleParser(raw).catch(() => null) : null;

        const subject = parsedMail?.subject || envelope?.subject || "(No subject)";
        const messageId = parsedMail?.messageId || envelope?.messageId;
        const date = parsedMail?.date || envelope?.date || internalDate;
        const fromText = formatMailparserAddresses(parsedMail?.from) || formatAddresses(envelope?.from);
        const toText = formatMailparserAddresses(parsedMail?.to) || formatAddresses(envelope?.to);
        const textSnippet = buildTextSnippet(parsedMail);

        console.log("");
        console.log(`--- UID ${uid ?? "?"} ---`);
        console.log(`Date: ${date ? new Date(date).toISOString() : "-"}`);
        console.log(`From: ${fromText || "-"}`);
        console.log(`To: ${toText || "-"}`);
        console.log(`Subject: ${subject}`);

        if (parsed.args.verbose) {
          console.log(`Message-Id: ${messageId || "-"}`);
          console.log(`Flags: ${flags ? Array.from(flags).join(", ") : "-"}`);
          console.log(`Size: ${typeof size === "number" ? size : "-"}`);
          console.log(`Source bytes: ${raw ? Buffer.byteLength(raw, "utf8") : 0}`);
          console.log(`Attachments: ${parsedMail?.attachments?.length ?? "-"}`);
        }

        if (textSnippet) {
          console.log(`Text: ${textSnippet}`);
        }

        if (includeSource && !raw) {
          console.log("Source: (empty)");
        }
      }
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("[imap] error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore
    }
    await prisma.$disconnect().catch(() => {
      // ignore
    });
  }
}

main().catch((error) => {
  console.error("[imap] fatal:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
