import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default async function AdminInboundEmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const inboundEmail = await prisma.inboundEmail.findUnique({
    where: { id },
    include: {
      domain: { select: { id: true, name: true } },
      mailbox: { select: { id: true, address: true, userId: true } },
    },
  });

  if (!inboundEmail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">Inbound Email</h1>
          <p className="text-muted-foreground break-all">{inboundEmail.id}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/inbound">Back</Link>
        </Button>
      </div>

      <Card className="p-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{inboundEmail.sourceType}</Badge>
          <Badge variant="secondary">{inboundEmail.domain.name}</Badge>
          {inboundEmail.mailbox ? (
            <Badge>{inboundEmail.mailbox.address}</Badge>
          ) : (
            <Badge variant="secondary">Unmatched</Badge>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <div>
            <span className="font-medium">Received:</span>{" "}
            {format(new Date(inboundEmail.receivedAt), "PPpp")}
          </div>
          <div>
            <span className="font-medium">From:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.fromAddress || "-"}</span>
          </div>
          <div>
            <span className="font-medium">To:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.toAddress}</span>
          </div>
          <div>
            <span className="font-medium">Subject:</span> {inboundEmail.subject}
          </div>
          <div>
            <span className="font-medium">Message-Id:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.messageId || "-"}</span>
          </div>
        </div>
      </Card>

      {inboundEmail.textBody && (
        <Card className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">Text Body</h2>
          <pre className="whitespace-pre-wrap break-words text-sm">{inboundEmail.textBody}</pre>
        </Card>
      )}

      {inboundEmail.htmlBody && (
        <Card className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">HTML Body</h2>
          <pre className="whitespace-pre-wrap break-words text-sm">{inboundEmail.htmlBody}</pre>
        </Card>
      )}

      {inboundEmail.rawContent && (
        <Card className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">Raw</h2>
          <pre className="whitespace-pre-wrap break-words text-xs bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[520px]">
            {inboundEmail.rawContent}
          </pre>
        </Card>
      )}
    </div>
  );
}

