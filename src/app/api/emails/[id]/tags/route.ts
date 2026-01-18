import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { readJsonBody } from "@/lib/request";

const patchSchema = z.object({
  add: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  remove: z.array(z.string().trim().min(1)).max(50).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    select: {
      id: true,
      emailTags: {
        select: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const tags = email.emailTags.map((et) => et.tag).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ tags });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = patchSchema.parse(bodyResult.data);
    const addNames = Array.from(
      new Set((data.add || []).map((t) => t.trim()).filter(Boolean))
    );
    const removeIds = Array.from(
      new Set((data.remove || []).map((t) => t.trim()).filter(Boolean))
    );

    const email = await prisma.email.findFirst({
      where: { id, mailbox: { userId: session.user.id } },
      select: { id: true },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const tags = await prisma.$transaction(async (tx) => {
      if (addNames.length > 0) {
        const ensured = await Promise.all(
          addNames.map((name) =>
            tx.tag.upsert({
              where: { userId_name: { userId: session.user.id, name } },
              create: { userId: session.user.id, name },
              update: {},
              select: { id: true },
            })
          )
        );
        const ensuredIds = Array.from(new Set(ensured.map((t) => t.id)));
        if (ensuredIds.length > 0) {
          const existing = await tx.emailTag.findMany({
            where: { emailId: id, tagId: { in: ensuredIds } },
            select: { tagId: true },
          });
          const existingIds = new Set(existing.map((row) => row.tagId));
          const toCreate = ensuredIds.filter((tagId) => !existingIds.has(tagId));
          if (toCreate.length > 0) {
            await tx.emailTag.createMany({
              data: toCreate.map((tagId) => ({ emailId: id, tagId })),
            });
          }
        }
      }

      if (removeIds.length > 0) {
        await tx.emailTag.deleteMany({
          where: { emailId: id, tagId: { in: removeIds } },
        });
      }

      const rows = await tx.emailTag.findMany({
        where: { emailId: id },
        select: { tag: { select: { id: true, name: true, color: true } } },
      });
      return rows.map((r) => r.tag).sort((a, b) => a.name.localeCompare(b.name));
    });

    return NextResponse.json({ tags });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update email tags failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
