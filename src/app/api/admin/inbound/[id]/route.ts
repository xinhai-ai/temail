import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { deleteByRecordStorage } from "@/lib/storage/record-storage";
import { isVercelDeployment } from "@/lib/deployment/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const inboundEmail = await prisma.inboundEmail.findUnique({
    where: { id },
    include: {
      domain: { select: { id: true, name: true } },
      mailbox: { select: { id: true, address: true, userId: true } },
    },
  });

  if (!inboundEmail) {
    return NextResponse.json({ error: "Inbound email not found" }, { status: 404 });
  }

  const vercelMode = isVercelDeployment();

  // Exclude rawContent from response, but indicate if it's available
  const { rawContent, rawContentPath, rawStorageBackend, ...emailWithoutRawContent } = inboundEmail;
  const response = {
    ...emailWithoutRawContent,
    // Set rawContent to true if available (either in DB or file)
    ...(vercelMode ? {} : { rawContentPath, rawStorageBackend }),
    rawContent: vercelMode ? undefined : rawContent || rawContentPath ? true : undefined,
  };

  return NextResponse.json(response);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const inboundEmail = await prisma.inboundEmail.findUnique({
    where: { id },
    select: { id: true, rawContentPath: true, rawStorageBackend: true },
  });

  if (!inboundEmail) {
    return NextResponse.json({ error: "Inbound email not found" }, { status: 404 });
  }

  if (inboundEmail.rawContentPath) {
    await deleteByRecordStorage(inboundEmail.rawContentPath, inboundEmail.rawStorageBackend);
  }

  await prisma.inboundEmail.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
