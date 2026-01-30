import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { computeAuthSources, uniqueOAuthProviders } from "@/lib/auth-sources";
import { rateLimit } from "@/lib/api-rate-limit";

export async function GET() {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`admin:users:list:${session.user.id}`, { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const users = await prisma.user.findMany({
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
    orderBy: { createdAt: "desc" },
  });

  const response = users.map((row) => {
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

  return NextResponse.json(response);
}
