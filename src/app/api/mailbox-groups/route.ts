import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const archived = searchParams.get("archived") || "exclude";
  const mailboxCountSelect =
    archived === "include"
      ? true
      : {
          where:
            archived === "only"
              ? { archivedAt: { not: null } }
              : { archivedAt: null },
        };

  const groups = await prisma.mailboxGroup.findMany({
    where: { userId: session.user.id },
    include: { _count: { select: { mailboxes: mailboxCountSelect } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(groups);
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
    const data = createSchema.parse(bodyResult.data);

    const created = await prisma.$transaction(async (tx) => {
      const last = await tx.mailboxGroup.findFirst({
        where: { userId: session.user.id },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });

      const nextSortOrder = (last?.sortOrder ?? -1) + 1;

      return tx.mailboxGroup.create({
        data: {
          name: data.name,
          color: data.color,
          description: data.description,
          sortOrder: nextSortOrder,
          userId: session.user.id,
        },
        include: { _count: { select: { mailboxes: true } } },
      });
    });

    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Group name already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
