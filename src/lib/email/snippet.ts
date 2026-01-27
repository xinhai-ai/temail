import { Prisma, PrismaClient } from "@prisma/client";

const MAX_SNIPPET_LENGTH = 160;
const TEXT_BODY_FETCH_LIMIT = 512;
const HTML_BODY_FETCH_LIMIT = 4096;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&");
}

function stripHtml(value: string) {
  const withoutScripts = value
    .replace(/<script[\s\S]*?<\/script[^>]*>/gi, " ")
    .replace(/<style[\s\S]*?<\/style[^>]*>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeBasicEntities(withoutTags));
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength).trimEnd();
}

export function buildEmailSnippet(parts: { textBody?: string | null; htmlBody?: string | null }) {
  const text = normalizeWhitespace(parts.textBody || "");
  if (text) return truncate(text, MAX_SNIPPET_LENGTH);
  const html = parts.htmlBody ? stripHtml(parts.htmlBody) : "";
  if (html) return truncate(html, MAX_SNIPPET_LENGTH);
  return null;
}

export async function getEmailSnippetsById(prisma: PrismaClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return new Map<string, string | null>();

  const rows = await prisma.$queryRaw<Array<{ id: string; textBody: string | null; htmlBody: string | null }>>(
    Prisma.sql`
      SELECT
        "id" as id,
        substr("textBody", 1, ${TEXT_BODY_FETCH_LIMIT}) as textBody,
        substr("htmlBody", 1, ${HTML_BODY_FETCH_LIMIT}) as htmlBody
      FROM "emails"
      WHERE "id" IN (${Prisma.join(uniqueIds)})
    `
  );

  const byId = new Map<string, string | null>();
  for (const row of rows) {
    byId.set(row.id, buildEmailSnippet(row));
  }
  for (const id of uniqueIds) {
    if (!byId.has(id)) byId.set(id, null);
  }

  return byId;
}
