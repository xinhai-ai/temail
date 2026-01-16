import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

let cachedFtsAvailable: boolean | null = null;

const querySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(200),
  mailboxId: z.string().trim().min(1).optional(),
  cursor: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

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
      cursor: searchParams.get("cursor") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || searchParams.get("take") || undefined,
    });

    const ftsQuery = buildFtsQuery(parsed.q);
    if (!ftsQuery) {
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
          },
          select: { id: true, receivedAt: true },
        })
      : null;

    if (useCursor && parsed.cursor && !cursorEmail) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }

    const shouldUseFts = await ensureFtsAvailable();

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
            `),
          ]);

          const total = Number(countRows?.[0]?.total ?? 0);

          const emails = rows.map((row) => ({
            id: row.id,
            subject: row.subject,
            fromAddress: row.fromAddress,
            fromName: row.fromName,
            status: row.status,
            isStarred: Boolean(row.isStarred),
            receivedAt: row.receivedAt,
            mailboxId: row.mailboxId,
            mailbox: { address: row.mailboxAddress },
          }));

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

      const fallbackWhere = {
        mailbox: { userId: session.user.id },
        ...(parsed.mailboxId ? { mailboxId: parsed.mailboxId } : {}),
        textBody: { contains: parsed.q },
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
          },
          orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
          skip: offset,
          take: parsed.limit,
        }),
        prisma.email.count({ where: fallbackWhere }),
      ]);

      return NextResponse.json({
        emails: items,
        pagination: {
          mode: "page",
          page,
          limit: parsed.limit,
          total,
          pages: Math.ceil(total / parsed.limit),
        },
        mode: "fallback",
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

        const emails = slice.map((row) => ({
          id: row.id,
          subject: row.subject,
          fromAddress: row.fromAddress,
          fromName: row.fromName,
          status: row.status,
          isStarred: Boolean(row.isStarred),
          receivedAt: row.receivedAt,
          mailboxId: row.mailboxId,
          mailbox: { address: row.mailboxAddress },
        }));

        return NextResponse.json({ emails, hasMore, nextCursor, mode: "fts" });
      } catch (error) {
        if (!isFtsMissingError(error)) {
          console.error("Email search (FTS) failed:", error);
          return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
        cachedFtsAvailable = false;
      }
    }

    const fallbackWhere = {
      mailbox: { userId: session.user.id },
      ...(parsed.mailboxId ? { mailboxId: parsed.mailboxId } : {}),
      textBody: { contains: parsed.q },
      ...(cursorEmail
        ? {
            OR: [
              { receivedAt: { lt: cursorEmail.receivedAt } },
              { receivedAt: cursorEmail.receivedAt, id: { lt: cursorEmail.id } },
            ],
          }
        : {}),
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
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      take: parsed.limit + 1,
    });

    const hasMore = items.length > parsed.limit;
    const slice = hasMore ? items.slice(0, parsed.limit) : items;
    const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null;

    return NextResponse.json({ emails: slice, hasMore, nextCursor, mode: "fallback" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Email search failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
