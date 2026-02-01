import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";
import { isReservedMailboxPrefix } from "@/lib/mailbox-prefix";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { assertCanCreateMailbox, assertDomainAllowedForUser } from "@/services/usergroups/policy";

const mailboxSchema = z.object({
  prefix: z.string().min(1, "Prefix is required"),
  domainId: z.string().min(1, "Domain is required"),
  note: z.string().optional(),
  groupId: z.string().trim().min(1).optional(),
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
      _count: {
        select: {
          emails: { where: { status: "UNREAD" } },
        },
      },
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

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = mailboxSchema.parse(bodyResult.data);

    const isAdmin = isAdminRole(session.user.role);
    if (!isAdmin && isReservedMailboxPrefix(data.prefix)) {
      return NextResponse.json(
        { error: "Mailbox prefix is reserved", code: "MAILBOX_PREFIX_RESERVED", meta: { prefix: data.prefix } },
        { status: 403 }
      );
    }

    const quota = await assertCanCreateMailbox(session.user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, code: quota.code, meta: quota.meta }, { status: quota.status });
    }

    const domain = await prisma.domain.findFirst({
      where: isAdmin
        ? { id: data.domainId }
        : { id: data.domainId, isPublic: true, status: "ACTIVE" },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const allowed = await assertDomainAllowedForUser({ userId: session.user.id, domainId: domain.id });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error, code: allowed.code, meta: allowed.meta }, { status: allowed.status });
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

    if (data.groupId) {
      const group = await prisma.mailboxGroup.findFirst({
        where: { id: data.groupId, userId: session.user.id },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
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
