import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).default([]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 50_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = reorderSchema.parse(bodyResult.data);
    const orderedIds = data.orderedIds;
    const uniqueOrderedIds = Array.from(new Set(orderedIds));

    if (uniqueOrderedIds.length !== orderedIds.length) {
      return NextResponse.json({ error: "Duplicate group ids" }, { status: 400 });
    }

    const existing = await prisma.mailboxGroup.findMany({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const existingIds = existing.map((group) => group.id);
    const existingIdSet = new Set(existingIds);

    if (uniqueOrderedIds.length !== existingIds.length) {
      return NextResponse.json({ error: "Group list does not match server state" }, { status: 400 });
    }

    const unknownIds = uniqueOrderedIds.filter((id) => !existingIdSet.has(id));
    if (unknownIds.length > 0) {
      return NextResponse.json({ error: "Invalid group ids" }, { status: 400 });
    }

    await prisma.$transaction(
      uniqueOrderedIds.map((id, index) =>
        prisma.mailboxGroup.updateMany({
          where: { id, userId: session.user.id },
          data: { sortOrder: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

