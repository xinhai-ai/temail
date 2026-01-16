import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { isAdminRole } from "@/lib/rbac";

const imapSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().default(993),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  syncInterval: z.number().default(60),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = imapSchema.parse(body);

    // Verify domain ownership
    const domain = await prisma.domain.findFirst({
      where: { id },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    // Upsert IMAP config
    const config = await prisma.imapConfig.upsert({
      where: { domainId: id },
      update: data,
      create: {
        ...data,
        domainId: id,
      },
    });

    // Update domain source type and status
    await prisma.domain.update({
      where: { id },
      data: {
        sourceType: "IMAP",
        status: "PENDING",
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  await prisma.imapConfig.deleteMany({
    where: { domainId: id },
  });

  return NextResponse.json({ success: true });
}
