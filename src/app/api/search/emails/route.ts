import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma, { databaseType } from "@/lib/prisma";

let cachedFtsAvailable: boolean | null = null;

const querySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(200),
  mailboxId: z.string().trim().min(1).optional(),
  tagId: z.string().trim().min(1).optional(),
  status: z.enum(["UNREAD", "READ", "ARCHIVED", "DELETED"]).optional(),
  excludeArchived: z.coerce.boolean().optional(),
  cursor: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type EmailListItem = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  status: string;
  isStarred: boolean;
  receivedAt: string;
  mailboxId: string;
  mailbox: { address: string };
  tags?: Array<{ id: string; name: string; color: string | null }>;
};

async function attachTags(items: EmailListItem[]) {
  const ids = items.map((i) => i.id);
  if (ids.length === 0) return items;

  const rows = await prisma.emailTag.findMany({
    where: { emailId: { in: ids } },
    select: {
      emailId: true,
      tag: { select: { id: true, name: true, color: true } },
    },
  });

  const byEmail = new Map<string, Array<{ id: string; name: string; color: string | null }>>();
  for (const row of rows) {
    const list = byEmail.get(row.emailId) || [];
    list.push(row.tag);
    byEmail.set(row.emailId, list);
  }

  for (const list of byEmail.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return items.map((item) => ({
    ...item,
    tags: byEmail.get(item.id) || [],
  }));
}

function containsCjk(input: string) {
  const value = input || "";
  try {
    return /\p{Script=Han}/u.test(value);
  } catch {
    return /[\u3400-\u9fff]/.test(value);
  }
}

function buildFallbackTokens(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10);
}

function buildFtsQuery(input: string) {
  const tokens = input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)
    .map((token) => token.replace(/\"/g, "\"\""));

  if (tokens.length === 0) return null;
  return tokens
    .map((t, index) => {
      const isLast = index === tokens.length - 1;
      return isLast ? `"${t}"*` : `"${t}"`;
    })
    .join(" AND ");
}

function isFtsMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("no such table: emails_fts") ||
    message.includes("no such module: fts5") ||
    message.includes("fts5")
  );
}

async function ensureFtsAvailable() {
  if (cachedFtsAvailable !== null) return cachedFtsAvailable;
  try {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>(Prisma.sql`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ${"emails_fts"}
      LIMIT 1
    `);
    cachedFtsAvailable = Array.isArray(rows) && rows.length > 0;
  } catch {
    cachedFtsAvailable = false;
  }
  return cachedFtsAvailable;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || undefined;
    const parsed = querySchema.parse({
      q: searchParams.get("q") || "",
      mailboxId: searchParams.get("mailboxId") || undefined,
      tagId: searchParams.get("tagId") || undefined,
      status: searchParams.get("status") || undefined,
      excludeArchived: searchParams.get("excludeArchived") || undefined,
      cursor: searchParams.get("cursor") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || searchParams.get("take") || undefined,
    });

    const ftsQuery = buildFtsQuery(parsed.q);
    if (!ftsQuery && databaseType === "sqlite") {
      return NextResponse.json({ emails: [], hasMore: false, nextCursor: null });
    }

    const fallbackTokens = buildFallbackTokens(parsed.q);
    if (fallbackTokens.length === 0) {
      return NextResponse.json({ emails: [], hasMore: false, nextCursor: null });
    }

    const useCursor = mode === "cursor" || typeof parsed.cursor === "string";
    const usePage = !useCursor && (mode === "page" || typeof parsed.page === "number");

    const cursorEmail = useCursor
      ? await prisma.email.findFirst({
          where: {
            id: parsed.cursor,
            ...(parsed.mailboxId ? { mailboxId: parsed.mailboxId } : {}),
            mailbox: { userId: session.user.id },
            ...(parsed.tagId ? { emailTags: { some: { tagId: parsed.tagId } } } : {}),
          },
          select: { id: true, receivedAt: true },
        })
      : null;

    if (useCursor && parsed.cursor && !cursorEmail) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    // PostgreSQL uses ILIKE directly, SQLite uses FTS when available
    const shouldUseFts =
      databaseType === "sqlite" &&
      (await ensureFtsAvailable()) &&
      !containsCjk(parsed.q);

    if (usePage) {
      const page = parsed.page ?? 1;
      const offset = (page - 1) * parsed.limit;

      if (shouldUseFts) {
        try {
          const [rows, countRows] = await Promise.all([
            prisma.$queryRaw<
              Array<{
                id: string;
                subject: string;
                fromAddress: string;
                fromName: string | null;
                status: string;
                isStarred: number;
                receivedAt: string;
                mailboxId: string;
                mailboxAddress: string;
              }>
            >(Prisma.sql`
              SELECT
                e.id as id,
                e.subject as subject,
                e.fromAddress as fromAddress,
                e.fromName as fromName,
                e.status as status,
                e.isStarred as isStarred,
                e.receivedAt as receivedAt,
                e.mailboxId as mailboxId,
                m.address as mailboxAddress
              FROM emails_fts
              JOIN emails e ON e.id = emails_fts.emailId
              JOIN mailboxes m ON m.id = e.mailboxId
              WHERE m.userId = ${session.user.id}
                AND emails_fts MATCH ${ftsQuery}
                ${parsed.mailboxId ? Prisma.sql`AND e.mailboxId = ${parsed.mailboxId}` : Prisma.empty}
                ${
                  parsed.tagId
                    ? Prisma.sql`AND EXISTS (SELECT 1 FROM email_tags et WHERE et.emailId = e.id AND et.tagId = ${parsed.tagId})`
                    : Prisma.empty
                }
                ${parsed.status ? Prisma.sql`AND e.status = ${parsed.status}` : Prisma.empty}
                ${
                  !parsed.status
                    ? parsed.excludeArchived
                      ? Prisma.sql`AND e.status NOT IN ('ARCHIVED', 'DELETED')`
                      : Prisma.sql`AND e.status != 'DELETED'`
                    : Prisma.empty
                }
              ORDER BY e.receivedAt DESC, e.id DESC
              LIMIT ${parsed.limit}
              OFFSET ${offset}
            `),
            prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
              SELECT COUNT(*) as total
              FROM emails_fts
              JOIN emails e ON e.id = emails_fts.emailId
              JOIN mailboxes m ON m.id = e.mailboxId
              WHERE m.userId = ${session.user.id}
                AND emails_fts MATCH ${ftsQuery}
                ${parsed.mailboxId ? Prisma.sql`AND e.mailboxId = ${parsed.mailboxId}` : Prisma.empty}
                ${
                  parsed.tagId
                    ? Prisma.sql`AND EXISTS (SELECT 1 FROM email_tags et WHERE et.emailId = e.id AND et.tagId = ${parsed.tagId})`
                    : Prisma.empty
                }
                ${parsed.status ? Prisma.sql`AND e.status = ${parsed.status}` : Prisma.empty}
                ${
                  !parsed.status
                    ? parsed.excludeArchived
                      ? Prisma.sql`AND e.status NOT IN ('ARCHIVED', 'DELETED')`
                      : Prisma.sql`AND e.status != 'DELETED'`
                    : Prisma.empty
                }
            `),
          ]);

          const total = Number(countRows?.[0]?.total ?? 0);

          const emails = await attachTags(rows.map((row) => ({
            id: row.id,
            subject: row.subject,
            fromAddress: row.fromAddress,
            fromName: row.fromName,
            status: row.status,
            isStarred: Boolean(row.isStarred),
            receivedAt: row.receivedAt,
            mailboxId: row.mailboxId,
            mailbox: { address: row.mailboxAddress },
          })));

          return NextResponse.json({
            emails,
            pagination: {
              mode: "page",
              page,
              limit: parsed.limit,
              total,
              pages: Math.ceil(total / parsed.limit),
            },
            mode: "fts",
          });
        } catch (error) {
          if (!isFtsMissingError(error)) {
            console.error("Email search (FTS) failed:", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
          }
          cachedFtsAvailable = false;
        }
      }

      const excludedStatuses: Array<"ARCHIVED" | "DELETED"> = [];
      if (!parsed.status) {
        excludedStatuses.push("DELETED");
        if (parsed.excludeArchived) excludedStatuses.push("ARCHIVED");
      }

      const fallbackWhere = {
        AND: [
          {
            mailbox: { userId: session.user.id },
            ...(parsed.mailboxId ? { mailboxId: parsed.mailboxId } : {}),
            ...(parsed.tagId ? { emailTags: { some: { tagId: parsed.tagId } } } : {}),
            ...(parsed.status
              ? { status: parsed.status }
              : excludedStatuses.length === 1
                ? { status: { not: excludedStatuses[0] } }
                : excludedStatuses.length > 1
                  ? { status: { notIn: excludedStatuses } }
                  : {}),
          },
          ...fallbackTokens.map((token) => ({
            OR:
              databaseType === "postgresql"
                ? [
                    { subject: { contains: token, mode: "insensitive" as const } },
                    { fromAddress: { contains: token, mode: "insensitive" as const } },
                    { fromName: { contains: token, mode: "insensitive" as const } },
                    { toAddress: { contains: token, mode: "insensitive" as const } },
                    { textBody: { contains: token, mode: "insensitive" as const } },
                    { htmlBody: { contains: token, mode: "insensitive" as const } },
                  ]
                : [
                    { subject: { contains: token } },
                    { fromAddress: { contains: token } },
                    { fromName: { contains: token } },
                    { toAddress: { contains: token } },
                    { textBody: { contains: token } },
                    { htmlBody: { contains: token } },
                  ],
          })),
        ],
      };

      const [items, total] = await Promise.all([
        prisma.email.findMany({
          where: fallbackWhere,
          select: {
            id: true,
            subject: true,
            fromAddress: true,
            fromName: true,
            status: true,
            isStarred: true,
            receivedAt: true,
            mailboxId: true,
            mailbox: { select: { address: true } },
            emailTags: {
              select: { tag: { select: { id: true, name: true, color: true } } },
            },
          },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          skip: offset,
          take: parsed.limit,
        }),
        prisma.email.count({ where: fallbackWhere }),
      ]);

      return NextResponse.json({
        emails: items.map(({ emailTags, ...rest }) => ({ ...rest, tags: emailTags.map((et) => et.tag) })),
        pagination: {
          mode: "page",
          page,
          limit: parsed.limit,
          total,
          pages: Math.ceil(total / parsed.limit),
        },
        mode: databaseType === "postgresql" ? "ilike" : "fallback",
      });
    }

    if (shouldUseFts) {
      try {
        const rows = await prisma.$queryRaw<
          Array<{
            id: string;
            subject: string;
            fromAddress: string;
            fromName: string | null;
            status: string;
            isStarred: number;
            receivedAt: string;
            mailboxId: string;
            mailboxAddress: string;
          }>
        >(Prisma.sql`
          SELECT
            e.id as id,
            e.subject as subject,
            e.fromAddress as fromAddress,
            e.fromName as fromName,
            e.status as status,
            e.isStarred as isStarred,
            e.receivedAt as receivedAt,
            e.mailboxId as mailboxId,
            m.address as mailboxAddress
          FROM emails_fts
          JOIN emails e ON e.id = emails_fts.emailId
          JOIN mailboxes m ON m.id = e.mailboxId
          WHERE m.userId = ${session.user.id}
            AND emails_fts MATCH ${ftsQuery}
            ${parsed.mailboxId ? Prisma.sql`AND e.mailboxId = ${parsed.mailboxId}` : Prisma.empty}
            ${
              parsed.tagId
                ? Prisma.sql`AND EXISTS (SELECT 1 FROM email_tags et WHERE et.emailId = e.id AND et.tagId = ${parsed.tagId})`
                : Prisma.empty
            }
            ${parsed.status ? Prisma.sql`AND e.status = ${parsed.status}` : Prisma.empty}
            ${
              !parsed.status
                ? parsed.excludeArchived
                  ? Prisma.sql`AND e.status NOT IN ('ARCHIVED', 'DELETED')`
                  : Prisma.sql`AND e.status != 'DELETED'`
                : Prisma.empty
            }
            ${
              cursorEmail
                ? Prisma.sql`AND (e.receivedAt < ${cursorEmail.receivedAt} OR (e.receivedAt = ${cursorEmail.receivedAt} AND e.id < ${cursorEmail.id}))`
                : Prisma.empty
            }
          ORDER BY e.receivedAt DESC, e.id DESC
          LIMIT ${parsed.limit + 1}
        `);

        const hasMore = rows.length > parsed.limit;
        const slice = hasMore ? rows.slice(0, parsed.limit) : rows;
        const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

        const emails = await attachTags(slice.map((row) => ({
          id: row.id,
          subject: row.subject,
          fromAddress: row.fromAddress,
          fromName: row.fromName,
          status: row.status,
          isStarred: Boolean(row.isStarred),
          receivedAt: row.receivedAt,
          mailboxId: row.mailboxId,
          mailbox: { address: row.mailboxAddress },
        })));

        return NextResponse.json({ emails, hasMore, nextCursor, mode: "fts" });
      } catch (error) {
        if (!isFtsMissingError(error)) {
          console.error("Email search (FTS) failed:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
        cachedFtsAvailable = false;
      }
    }

    const excludedStatuses: Array<"ARCHIVED" | "DELETED"> = [];
    if (!parsed.status) {
      excludedStatuses.push("DELETED");
      if (parsed.excludeArchived) excludedStatuses.push("ARCHIVED");
    }

    const fallbackWhere = {
      AND: [
        {
          mailbox: { userId: session.user.id },
          ...(parsed.mailboxId ? { mailboxId: parsed.mailboxId } : {}),
          ...(parsed.tagId ? { emailTags: { some: { tagId: parsed.tagId } } } : {}),
          ...(parsed.status
            ? { status: parsed.status }
            : excludedStatuses.length === 1
              ? { status: { not: excludedStatuses[0] } }
              : excludedStatuses.length > 1
                ? { status: { notIn: excludedStatuses } }
                : {}),
        },
        ...fallbackTokens.map((token) => ({
          OR:
            databaseType === "postgresql"
              ? [
                  { subject: { contains: token, mode: "insensitive" as const } },
                  { fromAddress: { contains: token, mode: "insensitive" as const } },
                  { fromName: { contains: token, mode: "insensitive" as const } },
                  { toAddress: { contains: token, mode: "insensitive" as const } },
                  { textBody: { contains: token, mode: "insensitive" as const } },
                  { htmlBody: { contains: token, mode: "insensitive" as const } },
                ]
              : [
                  { subject: { contains: token } },
                  { fromAddress: { contains: token } },
                  { fromName: { contains: token } },
                  { toAddress: { contains: token } },
                  { textBody: { contains: token } },
                  { htmlBody: { contains: token } },
                ],
        })),
        ...(cursorEmail
          ? [
              {
                OR: [
                  { receivedAt: { lt: cursorEmail.receivedAt } },
                  { receivedAt: cursorEmail.receivedAt, id: { lt: cursorEmail.id } },
                ],
              },
            ]
          : []),
      ],
    };

    const items = await prisma.email.findMany({
      where: fallbackWhere,
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        fromName: true,
        status: true,
        isStarred: true,
        receivedAt: true,
        mailboxId: true,
        mailbox: { select: { address: true } },
        emailTags: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: parsed.limit + 1,
    });

    const hasMore = items.length > parsed.limit;
    const slice = hasMore ? items.slice(0, parsed.limit) : items;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    return NextResponse.json({
      emails: slice.map(({ emailTags, ...rest }) => ({ ...rest, tags: emailTags.map((et) => et.tag) })),
      hasMore,
      nextCursor,
      mode: databaseType === "postgresql" ? "ilike" : "fallback",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Email search failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
