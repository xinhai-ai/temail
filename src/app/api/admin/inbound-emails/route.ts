import { NextRequest, NextResponse } from "next/server";
import { DomainSourceType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

function parseSourceType(value: string | null) {
  if (value === "IMAP" || value === "WEBHOOK" || value === "PERSONAL_IMAP") return value as DomainSourceType;
  return null;
}

function parseBoolean(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const domainId = searchParams.get("domainId");
  const mailboxId = searchParams.get("mailboxId");
  const sourceType = parseSourceType(searchParams.get("sourceType"));
  const matched = mailboxId ? null : parseBoolean(searchParams.get("matched"));
  const search = searchParams.get("search") || "";

  const where: Prisma.InboundEmailWhereInput = {
    ...(domainId && { domainId }),
    ...(mailboxId && { mailboxId }),
    ...(sourceType && { sourceType }),
    ...(matched === true && { mailboxId: { not: null } }),
    ...(matched === false && { mailboxId: null }),
    ...(search && {
      OR: [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
        { toAddress: { contains: search } },
        { mailbox: { is: { address: { contains: search } } } },
      ],
    }),
  };

  const [inboundEmails, total] = await Promise.all([
    prisma.inboundEmail.findMany({
      where,
      select: {
        id: true,
        sourceType: true,
        messageId: true,
        fromAddress: true,
        fromName: true,
        toAddress: true,
        subject: true,
        receivedAt: true,
        createdAt: true,
        domain: { select: { id: true, name: true } },
        mailbox: { select: { id: true, address: true, userId: true } },
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inboundEmail.count({ where }),
  ]);

  return NextResponse.json({
    inboundEmails,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
