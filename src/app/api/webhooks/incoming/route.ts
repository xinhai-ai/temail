import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { executeForwards } from "@/services/forward";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, from, subject, text, html, secret } = body;

    if (!to || !secret) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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

    const mailbox = await prisma.mailbox.findUnique({
      where: { address: to },
    });

    if (!mailbox) {
      return NextResponse.json(
        { error: "Mailbox not found" },
        { status: 404 }
      );
    }

    const email = await prisma.email.create({
      data: {
        fromAddress: from || "unknown@unknown.com",
        toAddress: to,
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
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
