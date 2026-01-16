import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Inbox, Mail, Globe, Forward } from "lucide-react";

async function getStats(userId: string) {
  const [mailboxCount, emailCount, domainCount, forwardCount] = await Promise.all([
    prisma.mailbox.count({ where: { userId } }),
    prisma.email.count({
      where: { mailbox: { userId } },
    }),
    prisma.domain.count({ where: { userId } }),
    prisma.forwardRule.count({ where: { userId } }),
  ]);

  const unreadCount = await prisma.email.count({
    where: { mailbox: { userId }, status: "UNREAD" },
  });

  return { mailboxCount, emailCount, domainCount, forwardCount, unreadCount };
}

export default async function DashboardPage() {
  const session = await auth();
  const stats = await getStats(session!.user.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {session?.user?.name || "User"}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          System Online
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mailboxes</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <Inbox className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.mailboxCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active mailboxes</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Emails</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Mail className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.emailCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary font-medium">{stats.unreadCount}</span> unread
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Domains</CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10">
              <Globe className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.domainCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Configured domains</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Forwards</CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Forward className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.forwardCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Active rules</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
