import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { getEmailSnippetsById } from "@/lib/email/snippet";

export async function GET(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "emails:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();
  const status = searchParams.get("status");
  const excludeArchived = searchParams.get("excludeArchived") === "true";
  const mailboxId = searchParams.get("mailboxId");
  const tagId = searchParams.get("tagId");
  const mode = searchParams.get("mode");
  const cursor = searchParams.get("cursor");
  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit") || searchParams.get("take") || "20";
  const limit = Math.min(100, Math.max(1, parseInt(limitParam)));

  const excludedStatuses: Array<"ARCHIVED" | "DELETED"> = [];
  if (!status) {
    excludedStatuses.push("DELETED");
    if (excludeArchived) excludedStatuses.push("ARCHIVED");
  }

  const where = {
    mailbox: { userId: authResult.apiKey.userId },
    ...(search && {
      OR: [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
      ],
    }),
    ...(status && { status: status as "UNREAD" | "READ" | "ARCHIVED" | "DELETED" }),
    ...(!status &&
      excludedStatuses.length > 0 && {
        status: excludedStatuses.length === 1
          ? { not: excludedStatuses[0] }
          : { notIn: excludedStatuses },
      }),
    ...(mailboxId && { mailboxId }),
    ...(tagId && { emailTags: { some: { tagId } } }),
  };

  if (mode === "cursor" || typeof cursor === "string") {
    const take = limit + 1;

    const items = await prisma.email.findMany({
      where,
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        fromName: true,
        status: true,
        isStarred: true,
        deletedAt: true,
        receivedAt: true,
        mailboxId: true,
        mailbox: { select: { id: true, address: true } },
        emailTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
    });

    const hasMore = items.length > limit;
    const slice = hasMore ? items.slice(0, limit) : items;
    const baseEmails = slice.map(({ emailTags, ...rest }) => ({
      ...rest,
      tags: emailTags.map((et) => et.tag),
    }));
    const snippetsById = await getEmailSnippetsById(prisma, baseEmails.map((email) => email.id));
    const emails = baseEmails.map((email) => ({
      ...email,
      snippet: snippetsById.get(email.id) ?? null,
    }));
    const nextCursor = hasMore && emails.length > 0 ? emails[emails.length - 1].id : null;

    return NextResponse.json({
      emails,
      hasMore,
      nextCursor,
      pagination: {
        mode: "cursor",
        limit,
        cursor: cursor || null,
        nextCursor,
        hasMore,
      },
    });
  }

  const safePage = Number.isFinite(page) ? Math.max(1, page) : 1;

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      select: {
        id: true,
        subject: true,
        fromAddress: true,
        fromName: true,
        status: true,
        isStarred: true,
        deletedAt: true,
        receivedAt: true,
        mailboxId: true,
        mailbox: { select: { id: true, address: true } },
        emailTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (safePage - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  const snippetsById = await getEmailSnippetsById(prisma, emails.map((email) => email.id));

  return NextResponse.json({
    emails: emails.map(({ emailTags, ...rest }) => ({
      ...rest,
      tags: emailTags.map((et) => et.tag),
      snippet: snippetsById.get(rest.id) ?? null,
    })),
    pagination: {
      mode: "page",
      page: safePage,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
