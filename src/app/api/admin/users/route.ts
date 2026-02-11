import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAdminSession } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { computeAuthSources, uniqueOAuthProviders } from "@/lib/auth-sources";

import { rateLimitByPolicy } from "@/services/rate-limit-settings";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().max(320).optional(),
  userGroupId: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  registrationEvent: z.enum(["all", "today", "last7d", "last30d"]).default("all"),
  authSource: z.string().trim().min(1).max(80).optional(),
});

function getRegistrationStart(value: "all" | "today" | "last7d" | "last30d") {
  const now = new Date();
  if (value === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (value === "last7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (value === "last30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitByPolicy("admin.users.list", `admin:users:list:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      name: searchParams.get("name") ?? undefined,
      email: searchParams.get("email") ?? undefined,
      userGroupId: searchParams.get("userGroupId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      registrationEvent: searchParams.get("registrationEvent") ?? undefined,
      authSource: searchParams.get("authSource") ?? undefined,
    });

    const registrationStart = getRegistrationStart(query.registrationEvent);

    const where: Prisma.UserWhereInput = {
      ...(query.name && { name: { contains: query.name } }),
      ...(query.email && { email: { contains: query.email } }),
      ...(query.userGroupId === "__none__"
        ? { userGroupId: null }
        : query.userGroupId
          ? { userGroupId: query.userGroupId }
          : {}),
      ...(query.status === "active" ? { isActive: true } : {}),
      ...(query.status === "inactive" ? { isActive: false } : {}),
      ...(registrationStart ? { createdAt: { gte: registrationStart } } : {}),
      ...(query.authSource === "password"
        ? { password: { not: null } }
        : query.authSource
          ? { accounts: { some: { provider: query.authSource } } }
          : {}),
    };

    const [users, total, userGroups, authProviderRows, hasPasswordUsers] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          userGroupId: true,
          userGroup: { select: { id: true, name: true } },
          createdAt: true,
          password: true,
          accounts: { select: { provider: true } },
          _count: { select: { mailboxes: true, domains: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.user.count({ where }),
      prisma.userGroup.findMany({
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
      prisma.account.findMany({
        distinct: ["provider"],
        select: { provider: true },
      }),
      prisma.user.findFirst({
        where: { password: { not: null } },
        select: { id: true },
      }),
    ]);

    const rows = users.map((row) => {
      const oauthProviders = uniqueOAuthProviders(row.accounts);
      const hasPassword = Boolean(row.password);
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isActive: row.isActive,
        userGroupId: row.userGroupId,
        userGroup: row.userGroup,
        createdAt: row.createdAt,
        _count: row._count,
        authSources: computeAuthSources({ hasPassword, oauthProviders }),
      };
    });

    const providerSet = new Set<string>();
    for (const row of authProviderRows) {
      const provider = row.provider.trim();
      if (!provider) continue;
      providerSet.add(provider);
    }

    const authSources = [
      ...(hasPasswordUsers ? ["password"] : []),
      ...Array.from(providerSet).sort((left, right) => left.localeCompare(right)),
    ];

    return NextResponse.json({
      users: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.max(1, Math.ceil(total / query.limit)),
      },
      facets: {
        userGroups,
        authSources,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
