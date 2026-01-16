import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]),
  config: z.string(),
  mailboxId: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rules = await prisma.forwardRule.findMany({
    where: { userId: id },
    include: { mailbox: { select: { id: true, address: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rules);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const data = createSchema.parse(body);

    if (data.mailboxId) {
      const mailbox = await prisma.mailbox.findFirst({
        where: { id: data.mailboxId, userId: id },
        select: { id: true },
      });
      if (!mailbox) {
        return NextResponse.json(
          { error: "Mailbox not found for this user" },
          { status: 404 }
        );
      }
    }

    const rule = await prisma.forwardRule.create({
      data: {
        name: data.name,
        type: data.type,
        status: data.status ?? "ACTIVE",
        config: data.config,
        userId: id,
        mailboxId: data.mailboxId ?? null,
      },
    });

    return NextResponse.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

