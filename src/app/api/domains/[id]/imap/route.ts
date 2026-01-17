import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { isAdminRole } from "@/lib/rbac";
import { triggerImapReconcile, isImapServiceEnabled } from "@/lib/imap-client";

const imapSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().default(993),
  secure: z.boolean().default(true),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required").optional(),
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

    const existingConfig = await prisma.imapConfig.findUnique({
      where: { domainId: id },
      select: { id: true },
    });

    if (!existingConfig && !data.password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const baseConfigData = {
      host: data.host,
      port: data.port,
      secure: data.secure,
      username: data.username,
      syncInterval: data.syncInterval,
    };

    const config = existingConfig
      ? await prisma.imapConfig.update({
          where: { domainId: id },
          data: {
            ...baseConfigData,
            ...(data.password ? { password: data.password } : {}),
          },
        })
      : await prisma.imapConfig.create({
          data: {
            ...baseConfigData,
            password: data.password!,
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

    // Trigger reconcile in the IMAP service
    if (isImapServiceEnabled()) {
      triggerImapReconcile().catch((err) => {
        console.error("[api/domains/imap] reconcile error:", err);
      });
    }

    // Convert BigInt to string for JSON serialization
    return NextResponse.json({
      ...config,
      lastUidValidity: config.lastUidValidity?.toString() ?? null,
    });
  } catch (error) {
    console.error("[api/domains/imap] POST error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
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

  try {
    const domain = await prisma.domain.findFirst({
      where: { id },
    });

    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    await prisma.imapConfig.deleteMany({
      where: { domainId: id },
    });

    // Trigger reconcile in the IMAP service
    if (isImapServiceEnabled()) {
      triggerImapReconcile().catch((err) => {
        console.error("[api/domains/imap] reconcile error:", err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/domains/imap] DELETE error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
