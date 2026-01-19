import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  FileText,
  Globe,
  Inbox,
  Mail,
  Settings,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import {
  checkImapServiceHealth,
  getImapServiceStatus,
  isImapServiceEnabled,
  type ImapHealthResult,
  type ImapServiceStatus,
} from "@/lib/imap-client";
import { AdminRefreshButton } from "@/app/(admin)/admin/_components/AdminRefreshButton";

async function getAdminDashboardData() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    userCount,
    domainCount,
    mailboxCount,
    emailCount,
    inboundTotalCount,
    inboundUnmatchedCount,
    logs24hCount,
    errorLogs24hCount,
    recentInbound,
    recentUnmatchedInbound,
    recentUsers,
    topDomains,
    topLogActions24h,
    imapConfigCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.domain.count(),
    prisma.mailbox.count(),
    prisma.email.count(),
    prisma.inboundEmail.count(),
    prisma.inboundEmail.count({ where: { mailboxId: null } }),
    prisma.log.count({ where: { createdAt: { gte: since24h } } }),
    prisma.log.count({ where: { createdAt: { gte: since24h }, level: "ERROR" } }),
    prisma.inboundEmail.findMany({
      select: {
        id: true,
        sourceType: true,
        toAddress: true,
        subject: true,
        receivedAt: true,
        domain: { select: { name: true } },
        mailbox: { select: { address: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 8,
    }),
    prisma.inboundEmail.findMany({
      where: { mailboxId: null },
      select: {
        id: true,
        sourceType: true,
        toAddress: true,
        subject: true,
        receivedAt: true,
        domain: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
      take: 8,
    }),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.domain.findMany({
      select: {
        id: true,
        name: true,
        sourceType: true,
        status: true,
        createdAt: true,
        _count: { select: { mailboxes: true, inboundEmails: true } },
      },
      orderBy: { mailboxes: { _count: "desc" } },
      take: 8,
    }),
    prisma.log.groupBy({
      by: ["action"],
      where: { createdAt: { gte: since24h } },
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 6,
    }),
    prisma.imapConfig.count(),
  ]);

  const imapEnabled = isImapServiceEnabled();
  let imapHealth: ImapHealthResult | null = null;
  let imapServiceStatus: ImapServiceStatus | null = null;
  let imapServiceError: string | null = null;

  if (imapEnabled) {
    const [health, statusResult] = await Promise.all([
      checkImapServiceHealth(),
      getImapServiceStatus(),
    ]);

    imapHealth = health;
    if (statusResult.ok) {
      imapServiceStatus = statusResult.status;
    } else {
      imapServiceError = statusResult.error;
    }
  }

  return {
    counts: {
      userCount,
      domainCount,
      mailboxCount,
      emailCount,
      inboundTotalCount,
      inboundUnmatchedCount,
      logs24hCount,
      errorLogs24hCount,
    },
    recentInbound,
    recentUnmatchedInbound,
    recentUsers,
    topDomains,
    topLogActions24h,
    imap: {
      enabled: imapEnabled,
      configCount: imapConfigCount,
      health: imapHealth,
      serviceStatus: imapServiceStatus,
      serviceError: imapServiceError,
    },
  };
}

export default async function AdminPage() {
  const data = await getAdminDashboardData();
  const { counts } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">System overview</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminRefreshButton />
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/settings">
              <Settings className="h-4 w-4" />
              System settings
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.userCount}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/domains" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Domains</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.domainCount}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/mailboxes" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Mailboxes</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.mailboxCount}</div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/inbox" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Emails</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.emailCount}</div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/inbound" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inbound emails</CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.inboundTotalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">All sources</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/inbound?matched=false" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unmatched inbound</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.inboundUnmatchedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs mailbox mapping</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/logs" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Logs (24h)</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.logs24hCount}</div>
              <p className="text-xs text-muted-foreground mt-1">System activity</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/logs" className="block">
          <Card className="hover:bg-accent/40 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Errors (24h)</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts.errorLogs24hCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Log level ERROR</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent inbound</CardTitle>
            <CardDescription>Latest messages received by the system</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.recentInbound.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No inbound emails yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentInbound.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.receivedAt), "PP p")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.toAddress}</TableCell>
                      <TableCell className="max-w-[520px] truncate">{item.subject}</TableCell>
                      <TableCell>
                        {item.mailbox ? (
                          <Badge>{item.mailbox.address}</Badge>
                        ) : (
                          <Badge variant="secondary">Unmatched</Badge>
                        )}
                        <Badge variant="outline" className="ml-2">
                          {item.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/inbound/${item.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common admin shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid gap-2">
              <Button asChild variant="default" size="sm">
                <Link href="/admin/users">Manage users</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/inbound?matched=false">Review unmatched inbound</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/logs">View logs</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/domains">Manage domains</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Unmatched inbound (latest)</CardTitle>
            <CardDescription>Catch-all messages that need mailbox mapping</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.recentUnmatchedInbound.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No unmatched inbound</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Subject</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentUnmatchedInbound.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(item.receivedAt), "PP p")}
                      </TableCell>
                      <TableCell>{item.domain.name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.toAddress}</TableCell>
                      <TableCell className="max-w-[520px] truncate">
                        <Link href={`/admin/inbound/${item.id}`} className="hover:underline">
                          {item.subject}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Domains overview</CardTitle>
            <CardDescription>Top domains by mailbox count</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.topDomains.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No domains yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Mailboxes</TableHead>
                    <TableHead className="text-right">Inbound</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topDomains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-medium">
                        <Link href={`/domains/${domain.id}`} className="hover:underline">
                          {domain.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            domain.status === "ACTIVE"
                              ? "default"
                              : domain.status === "ERROR"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {domain.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{domain.sourceType}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{domain._count.mailboxes}</TableCell>
                      <TableCell className="text-right tabular-nums">{domain._count.inboundEmails}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent users</CardTitle>
            <CardDescription>Newest accounts created</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {data.recentUsers.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No users yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/admin/users/${user.id}`} className="hover:underline">
                          {user.email}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(user.createdAt), "PP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">System health</CardTitle>
            <CardDescription>Runtime status and signals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">IMAP service mode</div>
              <Badge variant={data.imap.enabled ? "default" : "secondary"}>
                {data.imap.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">IMAP configs</div>
              <div className="text-sm tabular-nums">{data.imap.configCount}</div>
            </div>

            {data.imap.enabled && (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm">Service health</div>
                  <Badge variant={data.imap.health?.status === "ok" ? "default" : "destructive"}>
                    {data.imap.health?.status === "ok" ? "OK" : "Error"}
                  </Badge>
                </div>

                {data.imap.health?.status !== "ok" && (
                  <div className="text-xs text-muted-foreground break-words">
                    {data.imap.health?.error || data.imap.serviceError || "Unknown error"}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm">Workers</div>
                  <div className="text-sm tabular-nums">{data.imap.serviceStatus?.workersCount || 0}</div>
                </div>
              </>
            )}

            <div className="pt-2">
              <CardTitle className="text-base">Top actions (24h)</CardTitle>
              <CardDescription>Most frequent log actions</CardDescription>
            </div>

            {data.topLogActions24h.length === 0 ? (
              <div className="text-sm text-muted-foreground">No logs in the last 24 hours</div>
            ) : (
              <div className="space-y-2">
                {data.topLogActions24h.map((item) => (
                  <div key={item.action} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{item.action}</span>
                    <span className="tabular-nums text-muted-foreground">{item._count.action}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="pt-2 text-xs text-muted-foreground">
        Last updated: {format(new Date(), "PPpp")}
      </div>
    </div>
  );
}
