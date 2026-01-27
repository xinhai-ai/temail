import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";
import { authenticateOpenApiRequest } from "@/lib/open-api/auth";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.string().trim().max(20).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "groups:read" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const group = await prisma.mailboxGroup.findFirst({
    where: { id, userId: authResult.apiKey.userId },
    select: {
      id: true,
      name: true,
      color: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      mailboxes: {
        select: {
          id: true,
          address: true,
          prefix: true,
          status: true,
          note: true,
          domain: { select: { id: true, name: true } },
        },
        orderBy: { address: "asc" },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({ group });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "groups:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);

    const existing = await prisma.mailboxGroup.findFirst({
      where: { id, userId: authResult.apiKey.userId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.mailboxGroup.findUnique({
        where: {
          userId_name: {
            userId: authResult.apiKey.userId,
            name: data.name,
          },
        },
        select: { id: true },
      });

      if (nameConflict) {
        return NextResponse.json({ error: "Group name already exists" }, { status: 400 });
      }
    }

    const updated = await prisma.mailboxGroup.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ group: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[open/v1/groups] update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateOpenApiRequest(request, { requiredScopes: "groups:write" });
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { id } = await params;

  const result = await prisma.mailboxGroup.deleteMany({
    where: { id, userId: authResult.apiKey.userId },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
