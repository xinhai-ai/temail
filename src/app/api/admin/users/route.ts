import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeAuthSources, uniqueOAuthProviders } from "@/lib/auth-sources";

export async function GET() {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
