import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where = {
    userId: id,
    ...(search && {
      OR: [
        { address: { contains: search } },
        { note: { contains: search } },
      ],
    }),
    ...(status && { status: status as "ACTIVE" | "INACTIVE" | "DELETED" }),
  };

  const [mailboxes, total] = await Promise.all([
    prisma.mailbox.findMany({
      where,
      include: {
        domain: true,
        group: true,
        _count: { select: { emails: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.mailbox.count({ where }),
  ]);

  return NextResponse.json({
    mailboxes,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

