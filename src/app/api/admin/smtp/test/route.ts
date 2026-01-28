import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/rbac";
import { rateLimit } from "@/lib/api-rate-limit";
import { readJsonBody } from "@/lib/request";
import { isVercelDeployment } from "@/lib/deployment/server";
import { sendSmtpMail, verifySmtpTransport, SmtpConfigError } from "@/services/smtp/mailer";

const schema = z.object({
  to: z.string().email("Invalid recipient email address"),
  subject: z.string().trim().min(1).max(200).optional(),
  text: z.string().trim().max(20_000).optional(),
  html: z.string().trim().max(200_000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isVercelDeployment()) {
    return NextResponse.json({ error: "SMTP is disabled in this deployment" }, { status: 404 });
  }

  const limited = rateLimit(`admin:smtp:test:${session.user.id}`, { limit: 10, windowMs: 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(req, { maxBytes: 250_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);
    const subject = data.subject || "TEmail SMTP Test";
    const text =
      data.text ||
      "This is a test email sent from the TEmail admin panel.\n\nIf you received this email, your SMTP configuration is working.";

    await verifySmtpTransport();
    const result = await sendSmtpMail({
      to: data.to,
      subject,
      text,
      html: data.html,
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    if (error instanceof SmtpConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/admin/smtp/test] error:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}

