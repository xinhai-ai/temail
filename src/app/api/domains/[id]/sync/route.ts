import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isAdminRole } from "@/lib/rbac";
import { syncImapDomain, isImapServiceEnabled } from "@/lib/imap-client";
import { isVercelDeployment } from "@/lib/deployment/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Verify domain exists and is IMAP type
  const domain = await prisma.domain.findFirst({
    where: { id },
    include: { imapConfig: { select: { id: true } } },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  if (domain.sourceType !== "IMAP" || !domain.imapConfig) {
    return NextResponse.json(
      { error: "Domain is not configured for IMAP" },
      { status: 400 }
    );
  }

  if (!isImapServiceEnabled()) {
    return NextResponse.json(
      { error: "IMAP service is not enabled" },
      { status: 503 }
    );
  }

  try {
    const result = await syncImapDomain(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
