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
  const mailboxId = searchParams.get("mailboxId");
  const mode = searchParams.get("mode");
  const cursor = searchParams.get("cursor");
  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit") || searchParams.get("take") || "20";
  const limit = Math.min(100, Math.max(1, parseInt(limitParam)));

  const where = {
    mailbox: { userId: session.user.id },
    ...(search && {
      OR: [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
      ],
    }),
    ...(status && { status: status as "UNREAD" | "READ" | "ARCHIVED" | "DELETED" }),
    ...(mailboxId && { mailboxId }),
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
        receivedAt: true,
        mailboxId: true,
        mailbox: { select: { address: true } },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
    });

    const hasMore = items.length > limit;
    const emails = hasMore ? items.slice(0, limit) : items;
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
        receivedAt: true,
        mailboxId: true,
        mailbox: { select: { address: true } },
      },
      orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return NextResponse.json({
    emails,
    pagination: {
      mode: "page",
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
