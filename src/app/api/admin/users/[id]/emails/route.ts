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
  const mailboxId = searchParams.get("mailboxId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where = {
    mailbox: { userId: id },
    ...(search && {
      OR: [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
        { toAddress: { contains: search } },
      ],
    }),
    ...(status && { status: status as "UNREAD" | "READ" | "ARCHIVED" | "DELETED" }),
    ...(mailboxId && { mailboxId }),
  };

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      include: { mailbox: { select: { id: true, address: true } } },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.email.count({ where }),
  ]);

  return NextResponse.json({
    emails,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

