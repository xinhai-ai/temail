import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";

export async function GET(request: Request) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "tags:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const tags = await prisma.tag.findMany({
    where: { userId: authResult.apiKey.userId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tags });
}
