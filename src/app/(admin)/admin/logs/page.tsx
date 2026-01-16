import Link from "next/link";
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
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";

export default async function AdminLogsPage({
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

  const where = {
    ...(search && {
      OR: [
        { message: { contains: search } },
        { metadata: { contains: search } },
        { ip: { contains: search } },
      ],
    }),
  };

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.log.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const prevHref = `/admin/logs?page=${Math.max(1, page - 1)}&limit=${limit}&search=${encodeURIComponent(search)}`;
  const nextHref = `/admin/logs?page=${Math.min(pages, page + 1)}&limit=${limit}&search=${encodeURIComponent(search)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Logs</h1>
        <p className="text-muted-foreground">View system activity</p>
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
                <TableHead>Level</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.createdAt), "PPpp")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.level === "ERROR"
                          ? "destructive"
                          : log.level === "WARN"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.message}</TableCell>
                  <TableCell>{log.user?.email || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
