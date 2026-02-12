import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isImapServiceEnabled, syncImapDomain } from "@/lib/imap-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImapServiceEnabled()) {
    return NextResponse.json({ error: "IMAP sync service is disabled" }, { status: 400 });
  }

  const { id } = await params;

  const account = await prisma.personalImapAccount.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, domainId: true, status: true },
  });

  if (!account) {
    return NextResponse.json({ error: "Personal IMAP account not found" }, { status: 404 });
  }

  if (account.status === "DISABLED") {
    return NextResponse.json({ error: "Personal IMAP account is disabled" }, { status: 400 });
  }

  const result = await syncImapDomain(account.domainId);
  if (!result.success) {
    return NextResponse.json({ error: result.message || "Sync failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: result.message || "Sync triggered" });
}
