import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const domain = await prisma.domain.findFirst({
    where: { id, userId: session.user.id },
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

  const { id } = await params;
  const body = await request.json();

  const domain = await prisma.domain.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const config = await prisma.domainWebhookConfig.update({
    where: { domainId: id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json(config);
}
