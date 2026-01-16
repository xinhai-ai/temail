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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

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

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      include: { mailbox: { select: { address: true } } },
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
