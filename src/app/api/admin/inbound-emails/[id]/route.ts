import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
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

  return NextResponse.json(inboundEmail);
}

