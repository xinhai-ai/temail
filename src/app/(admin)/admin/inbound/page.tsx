import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { Inbox, Search } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InboundEmailActions } from "./_components/InboundEmailActions";

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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, resolvedSearchParams] = await Promise.all([
    getTranslations("admin"),
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
  ]);

  const getParam = (key: string) => {
    const value = resolvedSearchParams[key];
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
        { mailbox: { is: { address: { contains: search } } } },
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
  const buildHref = (nextPage: number, nextSearch: string | null = search) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("limit", String(limit));
    if (nextSearch) params.set("search", nextSearch);
    if (domainId) params.set("domainId", domainId);
    if (mailboxId) params.set("mailboxId", mailboxId);
    if (sourceType) params.set("sourceType", sourceType);
    if (matchedRaw) params.set("matched", matchedRaw);
    return `/admin/inbound?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("inbound.title")}</h1>
        <p className="text-muted-foreground">
          {t("inbound.subtitle")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form action="/admin/inbound" method="GET" className="flex flex-1 items-center gap-2">
          <input type="hidden" name="limit" value={String(limit)} />
          {domainId && <input type="hidden" name="domainId" value={domainId} />}
          {mailboxId && <input type="hidden" name="mailboxId" value={mailboxId} />}
          {sourceType && <input type="hidden" name="sourceType" value={sourceType} />}
          {matchedRaw && <input type="hidden" name="matched" value={matchedRaw} />}

          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              defaultValue={search}
              placeholder={t("inbound.searchPlaceholder")}
              className="pl-10"
            />
          </div>

          <Button type="submit" size="sm" variant="outline">
            {t("common.search")}
          </Button>
          {search && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={buildHref(1, null)}>{t("common.clear")}</Link>
            </Button>
          )}
        </form>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("common.pagination", { page, pages, total })}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={buildHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
              {t("common.prev")}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild disabled={page >= pages}>
            <Link href={buildHref(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
              {t("common.next")}
            </Link>
          </Button>
        </div>
      </div>

      {inboundEmails.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("inbound.empty")}</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.table.received")}</TableHead>
                <TableHead>{t("common.table.source")}</TableHead>
                <TableHead>{t("common.table.domain")}</TableHead>
                <TableHead>{t("common.table.to")}</TableHead>
                <TableHead>{t("common.table.mailbox")}</TableHead>
                <TableHead>{t("common.table.subject")}</TableHead>
                <TableHead>{t("common.table.from")}</TableHead>
                <TableHead className="text-right">{t("common.table.actions")}</TableHead>
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
                      <Badge variant="secondary">{t("common.unmatched")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{email.subject}</TableCell>
                  <TableCell className="font-mono text-xs">{email.fromAddress || "-"}</TableCell>
                  <TableCell className="text-right">
                    <InboundEmailActions id={email.id} />
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
