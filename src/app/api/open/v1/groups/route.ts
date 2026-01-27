import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  color: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "groups:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const groups = await prisma.mailboxGroup.findMany({
    where: { userId: authResult.apiKey.userId },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { mailboxes: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    groups: groups.map(({ _count, ...group }) => ({
      ...group,
      mailboxCount: _count.mailboxes,
    })),
  });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "groups:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = createSchema.parse(bodyResult.data);

    const existing = await prisma.mailboxGroup.findUnique({
      where: {
        userId_name: {
          userId: authResult.apiKey.userId,
          name: data.name,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Group name already exists" }, { status: 400 });
    }

    const group = await prisma.mailboxGroup.create({
      data: {
        name: data.name,
        color: data.color,
        description: data.description,
        userId: authResult.apiKey.userId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/groups] create failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
