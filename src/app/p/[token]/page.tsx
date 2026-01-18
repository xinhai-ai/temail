import { Prisma } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmailHtmlPreview } from "@/components/email/EmailHtmlPreview";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EmailPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) notFound();

  const link = await prisma.emailPreviewLink
    .update({
      where: { token },
      data: { lastAccessedAt: new Date() },
      select: {
        email: {
          select: {
            subject: true,
            fromAddress: true,
            fromName: true,
            toAddress: true,
            receivedAt: true,
            htmlBody: true,
            textBody: true,
          },
        },
      },
    })
    .catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    });

  if (!link?.email) notFound();

  const email = link.email;
  const subject = email.subject || "(No subject)";
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">Email Preview</div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inbox">Go to Inbox</Link>
            </Button>
          </div>
          <div className="text-xl font-semibold break-words">{subject}</div>
          <div className="text-sm text-muted-foreground break-words">
            <span className="font-medium text-foreground">From:</span> {from}
          </div>
          <div className="text-sm text-muted-foreground break-words">
            <span className="font-medium text-foreground">To:</span>{" "}
            <span className="font-mono">{email.toAddress}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Received:</span>{" "}
            {email.receivedAt.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            Remote images are blocked by default for privacy.
          </div>
        </div>

        {email.htmlBody ? (
          <EmailHtmlPreview html={email.htmlBody} />
        ) : (
          <pre className="whitespace-pre-wrap break-words text-sm bg-white p-4 rounded-md border min-h-[360px]">
            {email.textBody || "No content"}
          </pre>
        )}
      </div>
    </div>
  );
}
