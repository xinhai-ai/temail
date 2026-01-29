import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";
import { getAllowedDomainIdsForUser } from "@/services/usergroups/policy";

export async function GET(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "domains:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") || "").trim();

  const user = await prisma.user.findUnique({
    where: { id: authResult.apiKey.userId },
    select: { role: true },
  });

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const allowed = await getAllowedDomainIdsForUser(authResult.apiKey.userId);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error, code: allowed.code }, { status: allowed.status });
  }

  const domains = await prisma.domain.findMany({
    where: {
      ...(!isAdmin && { isPublic: true, status: "ACTIVE" }),
      ...(!isAdmin && allowed.domainIds ? { id: { in: allowed.domainIds } } : {}),
      ...(search && { name: { contains: search } }),
    },
    select: {
      id: true,
      name: true,
      status: true,
      isPublic: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ domains });
}
