import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { executeForwards } from "@/services/forward";
import { Prisma } from "@prisma/client";

function extractEmailAddress(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const angleMatch = trimmed.match(/<([^>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : trimmed).trim();

  // Minimal validation: local@domain with no spaces
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) return null;
  return candidate.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, from, subject, text, html, secret, messageId } = body;

    if (!to || !secret) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const toAddress = extractEmailAddress(to);
    if (!toAddress) {
      return NextResponse.json({ error: "Invalid to address" }, { status: 400 });
    }

    const webhookConfig = await prisma.domainWebhookConfig.findUnique({
      where: { secretKey: secret },
      include: { domain: true },
    });

    if (!webhookConfig || !webhookConfig.isActive) {
      return NextResponse.json(
        { error: "Invalid webhook secret" },
        { status: 401 }
      );
    }

    const domainName = webhookConfig.domain.name.toLowerCase();
    if (!toAddress.endsWith(`@${domainName}`)) {
      return NextResponse.json(
        { error: "Webhook secret does not match recipient domain" },
        { status: 403 }
      );
    }

    if (webhookConfig.domain.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Domain is not active" },
        { status: 403 }
      );
    }

    const mailbox = await prisma.mailbox.findFirst({
      where: {
        address: toAddress,
        domainId: webhookConfig.domainId,
        status: "ACTIVE",
      },
    });

    if (!mailbox) {
      return NextResponse.json(
        { error: "Mailbox not found" },
        { status: 404 }
      );
    }

    if (messageId && typeof messageId === "string") {
      const existing = await prisma.email.findUnique({
        where: { messageId },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ success: true, emailId: existing.id, duplicate: true });
      }
    }

    const email = await prisma.email.create({
      data: {
        messageId: typeof messageId === "string" ? messageId : undefined,
        fromAddress: extractEmailAddress(from) || (typeof from === "string" ? from : null) || "unknown@unknown.com",
        toAddress: toAddress,
        subject: subject || "(No subject)",
        textBody: text,
        htmlBody: html,
        mailboxId: mailbox.id,
      },
    });

    // Execute forward rules asynchronously
    executeForwards(email, mailbox.id).catch(console.error);

    return NextResponse.json({ success: true, emailId: email.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Unique constraint (e.g. messageId) - treat as idempotent
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
