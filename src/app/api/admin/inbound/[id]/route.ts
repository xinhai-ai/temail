import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

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

  // Exclude rawContent from response, but indicate if it's available
  const { rawContent, ...emailWithoutRawContent } = inboundEmail;
  const response = {
    ...emailWithoutRawContent,
    // Set rawContent to true if available (either in DB or file)
    rawContent: rawContent || inboundEmail.rawContentPath ? true : undefined,
  };

  return NextResponse.json(response);
}
