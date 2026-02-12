import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { isAdminRole } from "@/lib/rbac";
import { isReservedMailboxPrefix } from "@/lib/mailbox-prefix";
import { assertCanCreateMailbox, assertDomainAllowedForUser } from "@/services/usergroups/policy";

const overrideDaysSchema = z
  .number()
  .int()
  .min(-1)
  .max(3650)
  .nullable()
  .optional()
  .refine((value) => value === undefined || value === null || value === -1 || value > 0, {
    message: "Override days must be null (inherit), -1 (never), or a positive integer",
  });

const createSchema = z.object({
  prefix: z.string().trim().min(1, "Prefix is required").max(64),
  domainId: z.string().trim().min(1, "Domain is required"),
  note: z.string().trim().max(500).optional(),
  groupId: z.string().trim().min(1).optional(),
  expireMailboxDaysOverride: overrideDaysSchema,
  expireMailboxActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
  expireEmailDaysOverride: overrideDaysSchema,
  expireEmailActionOverride: z.enum(["ARCHIVE", "DELETE"]).nullable().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      userId: authResult.apiKey.userId,
      ...(search && {
        OR: [
          { address: { contains: search } },
          { note: { contains: search } },
        ],
      }),
    },
    select: {
      id: true,
      address: true,
      prefix: true,
      status: true,
      note: true,
      isStarred: true,
      expiresAt: true,
      lastEmailReceivedAt: true,
      expireMailboxDaysOverride: true,
      expireMailboxActionOverride: true,
      expireEmailDaysOverride: true,
      expireEmailActionOverride: true,
      groupId: true,
      createdAt: true,
      updatedAt: true,
      domain: { select: { id: true, name: true } },
      _count: { select: { emails: { where: { status: "UNREAD" } } } },
    },
    orderBy: [{ createdAt: "desc" }, { address: "asc" }],
  });

  return NextResponse.json({
    mailboxes: mailboxes.map(({ _count, ...mailbox }) => ({
      ...mailbox,
      unreadCount: _count.emails,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "mailboxes:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = createSchema.parse(bodyResult.data);

    const quota = await assertCanCreateMailbox(authResult.apiKey.userId);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, code: quota.code, meta: quota.meta }, { status: quota.status });
    }

    const user = await prisma.user.findUnique({
      where: { id: authResult.apiKey.userId },
      select: { role: true },
    });

    const isAdmin = isAdminRole(user?.role);
    if (!isAdmin && isReservedMailboxPrefix(data.prefix)) {
      return NextResponse.json(
        { error: "Mailbox prefix is reserved", code: "MAILBOX_PREFIX_RESERVED", meta: { prefix: data.prefix } },
        { status: 403 }
      );
    }
    const domain = await prisma.domain.findFirst({
      where: isAdmin
        ? { id: data.domainId }
        : { id: data.domainId, isPublic: true, status: "ACTIVE" },
      select: { id: true, name: true },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    const allowed = await assertDomainAllowedForUser({ userId: authResult.apiKey.userId, domainId: domain.id });
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error, code: allowed.code, meta: allowed.meta }, { status: allowed.status });
    }

    const address = `${data.prefix}@${domain.name}`;
    const existing = await prisma.mailbox.findUnique({ where: { address }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Mailbox already exists" }, { status: 400 });
    }

    if (data.groupId) {
      const group = await prisma.mailboxGroup.findFirst({
        where: { id: data.groupId, userId: authResult.apiKey.userId },
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
        userId: authResult.apiKey.userId,
        domainId: domain.id,
        groupId: data.groupId,
        expireMailboxDaysOverride:
          data.expireMailboxDaysOverride === undefined ? undefined : data.expireMailboxDaysOverride,
        expireMailboxActionOverride:
          data.expireMailboxActionOverride === undefined ? undefined : data.expireMailboxActionOverride,
        expireEmailDaysOverride:
          data.expireEmailDaysOverride === undefined ? undefined : data.expireEmailDaysOverride,
        expireEmailActionOverride:
          data.expireEmailActionOverride === undefined ? undefined : data.expireEmailActionOverride,
      },
      select: {
        id: true,
        address: true,
        prefix: true,
        status: true,
        note: true,
        isStarred: true,
        expiresAt: true,
        lastEmailReceivedAt: true,
        expireMailboxDaysOverride: true,
        expireMailboxActionOverride: true,
        expireEmailDaysOverride: true,
        expireEmailActionOverride: true,
        groupId: true,
        createdAt: true,
        updatedAt: true,
        domain: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ mailbox });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/mailboxes] create failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
