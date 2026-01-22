import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const querySchema = z.object({
  search: z.string().trim().max(200).optional(),
  groupId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5).default(5),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      search: searchParams.get("search") || undefined,
      groupId: searchParams.get("groupId") || undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const search = parsed.search?.trim() || "";
    const groupId = parsed.groupId;

    const where: Prisma.MailboxWhereInput = {
      userId: session.user.id,
      ...(search && {
        OR: [
          { address: { contains: search } },
          { note: { contains: search } },
        ],
      }),
      ...(groupId === "__ungrouped__"
        ? { groupId: null }
        : groupId
          ? { groupId }
          : {}),
    };

    const total = await prisma.mailbox.count({ where });
    const pages = Math.max(1, Math.ceil(total / parsed.limit));
    const page = Math.min(parsed.page, pages);
    const offset = (page - 1) * parsed.limit;

    const mailboxes = await prisma.mailbox.findMany({
      where,
      include: {
        domain: true,
        group: true,
        _count: {
          select: {
            emails: { where: { status: "UNREAD" } },
          },
        },
      },
      orderBy: { address: "asc" },
      skip: offset,
      take: parsed.limit,
    });

    return NextResponse.json({
      mailboxes,
      pagination: {
        page,
        pages,
        total,
        limit: parsed.limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
