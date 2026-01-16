import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, FileText } from "lucide-react";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ForwardRuleLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  const resolvedSearchParams = (await searchParams) || {};

  const getParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, parseInt(getParam("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(getParam("limit") || "50")));

  const rule = await prisma.forwardRule.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, name: true },
  });

  if (!rule) {
    notFound();
  }

  const where = { ruleId: rule.id };

  const [logs, total] = await Promise.all([
    prisma.forwardLog.findMany({
      where,
      include: { target: { select: { type: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.forwardLog.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const buildHref = (nextPage: number) => `/forwards/${rule.id}/logs?page=${nextPage}&limit=${limit}`;
  const prevHref = buildHref(Math.max(1, page - 1));
  const nextHref = buildHref(Math.min(pages, page + 1));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Forward Logs</h1>
          <p className="text-muted-foreground">
            Rule: <span className="font-medium text-foreground">{rule.name}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/forwards">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/forwards/${rule.id}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Page {page} / {pages} • Total {total}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={prevHref} aria-disabled={page <= 1}>
              Prev
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild disabled={page >= pages}>
            <Link href={nextHref} aria-disabled={page >= pages}>
              Next
            </Link>
          </Button>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No logs yet</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.createdAt), "PPpp")}</TableCell>
                  <TableCell>{log.target?.type || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={log.success ? "default" : "destructive"}>{log.success ? "SUCCESS" : "FAILED"}</Badge>
                  </TableCell>
                  <TableCell>{typeof log.responseCode === "number" ? log.responseCode : "-"}</TableCell>
                  <TableCell>{log.message || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

