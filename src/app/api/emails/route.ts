import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
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
    mailbox: { userId: session.user.id },
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
        mailbox: { select: { address: true } },
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
    const emails = slice.map(({ emailTags, ...rest }) => ({
      ...rest,
      tags: emailTags.map((et) => et.tag),
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
        mailbox: { select: { address: true } },
        emailTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return NextResponse.json({
    emails: emails.map(({ emailTags, ...rest }) => ({
      ...rest,
      tags: emailTags.map((et) => et.tag),
    })),
    pagination: {
      mode: "page",
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
