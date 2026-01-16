import Link from "next/link";
import { DomainSourceType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Inbox } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

function parseSourceType(value: string | null) {
  if (value === "IMAP" || value === "WEBHOOK") return value as DomainSourceType;
  return null;
}

function parseBoolean(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export default async function AdminInboundEmailsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const getParam = (key: string) => {
    const value = searchParams?.[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, parseInt(getParam("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(getParam("limit") || "50")));
  const search = getParam("search") || "";
  const domainId = getParam("domainId");
  const mailboxId = getParam("mailboxId");
  const sourceType = parseSourceType(getParam("sourceType") || null);
  const matchedRaw = mailboxId ? null : getParam("matched") || null;
  const matched = mailboxId ? null : parseBoolean(matchedRaw);

  const where: Prisma.InboundEmailWhereInput = {
    ...(domainId && { domainId }),
    ...(mailboxId && { mailboxId }),
    ...(sourceType && { sourceType }),
    ...(matched === true && { mailboxId: { not: null } }),
    ...(matched === false && { mailboxId: null }),
    ...(search && {
      OR: [
        { subject: { contains: search } },
        { fromAddress: { contains: search } },
        { toAddress: { contains: search } },
      ],
    }),
  };

  const [inboundEmails, total] = await Promise.all([
    prisma.inboundEmail.findMany({
      where,
      select: {
        id: true,
        sourceType: true,
        messageId: true,
        fromAddress: true,
        toAddress: true,
        subject: true,
        receivedAt: true,
        domain: { select: { id: true, name: true } },
        mailbox: { select: { id: true, address: true, userId: true } },
      },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.inboundEmail.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (domainId) params.set("domainId", domainId);
    if (mailboxId) params.set("mailboxId", mailboxId);
    if (sourceType) params.set("sourceType", sourceType);
    if (matchedRaw) params.set("matched", matchedRaw);
    return `/admin/inbound?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inbound Emails</h1>
        <p className="text-muted-foreground">
          View all incoming messages (including unmatched catch-all)
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Page {page} / {pages} • Total {total}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={buildHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
              Prev
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild disabled={page >= pages}>
            <Link href={buildHref(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </div>
      </div>

      {inboundEmails.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No inbound emails yet</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboundEmails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>{format(new Date(email.receivedAt), "PPpp")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{email.sourceType}</Badge>
                  </TableCell>
                  <TableCell>{email.domain.name}</TableCell>
                  <TableCell className="font-mono text-xs">{email.toAddress}</TableCell>
                  <TableCell>
                    {email.mailbox ? (
                      <Badge>{email.mailbox.address}</Badge>
                    ) : (
                      <Badge variant="secondary">Unmatched</Badge>
                    )}
                  </TableCell>
                  <TableCell>{email.subject}</TableCell>
                  <TableCell className="font-mono text-xs">{email.fromAddress || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/inbound/${email.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

