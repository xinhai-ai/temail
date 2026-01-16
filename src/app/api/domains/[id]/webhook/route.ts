import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { isAdminRole } from "@/lib/rbac";
import { z } from "zod";

const updateWebhookSchema = z.object({
  isActive: z.boolean(),
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

  const domain = await prisma.domain.findFirst({
    where: { id },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  // Generate secret key
  const secretKey = crypto.randomBytes(32).toString("hex");
  const endpoint = `/api/webhooks/incoming`;

  // Upsert webhook config
  const config = await prisma.domainWebhookConfig.upsert({
    where: { domainId: id },
    update: {
      secretKey,
      isActive: true,
    },
    create: {
      secretKey,
      endpoint,
      domainId: id,
    },
  });

  // Update domain
  await prisma.domain.update({
    where: { id },
    data: {
      sourceType: "WEBHOOK",
      status: "ACTIVE",
    },
  });

  return NextResponse.json(config);
}

export async function PATCH(
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
  const body = await request.json().catch(() => ({}));
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 });
  }

  const domain = await prisma.domain.findFirst({
    where: { id },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  try {
    const config = await prisma.domainWebhookConfig.update({
      where: { domainId: id },
      data: { isActive: parsed.data.isActive },
    });
    return NextResponse.json(config);
  } catch {
    return NextResponse.json({ error: "Webhook config not found" }, { status: 404 });
  }

  
}
