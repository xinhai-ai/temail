import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";
import { z } from "zod";

const mailboxSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
  domainId: z.string().min(1, "Domain is required"),
  note: z.string().optional(),
  groupId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const groupId = searchParams.get("groupId");

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      userId: session.user.id,
      ...(search && {
        OR: [
          { address: { contains: search } },
          { note: { contains: search } },
        ],
      }),
      ...(groupId && { groupId }),
    },
    include: {
      domain: true,
      group: true,
      _count: { select: { emails: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(mailboxes);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = mailboxSchema.parse(body);

    const isAdmin = isAdminRole(session.user.role);
    const domain = await prisma.domain.findFirst({
      where: isAdmin
        ? { id: data.domainId }
        : { id: data.domainId, isPublic: true, status: "ACTIVE" },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const address = `${data.prefix}@${domain.name}`;

    const existing = await prisma.mailbox.findUnique({
      where: { address },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Mailbox already exists" },
        { status: 400 }
      );
    }

    const mailbox = await prisma.mailbox.create({
      data: {
        prefix: data.prefix,
        address,
        note: data.note,
        userId: session.user.id,
        domainId: data.domainId,
        groupId: data.groupId,
      },
      include: { domain: true },
    });

    return NextResponse.json(mailbox);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
