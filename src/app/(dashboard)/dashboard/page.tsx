import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail, Globe, TrendingUp, TrendingDown } from "lucide-react";
import { EmailActivityChart } from "./_components/EmailActivityChart";
import { RecentEmails } from "./_components/RecentEmails";
import { QuickActions } from "./_components/QuickActions";
import { TopMailboxes } from "./_components/TopMailboxes";
import { RecentActivity } from "./_components/RecentActivity";

async function getStats(userId: string) {
  const [mailboxCount, emailCount] = await Promise.all([
    prisma.mailbox.count({ where: { userId } }),
    prisma.email.count({
      where: { mailbox: { userId } },
    }),
  ]);

  const unreadCount = await prisma.email.count({
    where: { mailbox: { userId }, status: "UNREAD" },
  });

  // Get starred mailboxes count
  const starredCount = await prisma.mailbox.count({
    where: { userId, isStarred: true },
  });

  // Get today's email count
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEmailCount = await prisma.email.count({
    where: {
      mailbox: { userId },
      receivedAt: { gte: today },
    },
  });

  // Get yesterday's email count for comparison
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEmailCount = await prisma.email.count({
    where: {
      mailbox: { userId },
      receivedAt: { gte: yesterday, lt: today },
    },
  });

  return {
    mailboxCount,
    emailCount,
    unreadCount,
    starredCount,
    todayEmailCount,
    yesterdayEmailCount,
  };
}

async function getEmailActivityData(userId: string) {
  const days = 7;
  const data: { date: string; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.email.count({
      where: {
        mailbox: { userId },
        receivedAt: { gte: date, lt: nextDate },
      },
    });

    data.push({
      date: date.toLocaleDateString("en-US", { weekday: "short" }),
      count,
    });
  }

  return data;
}

async function getRecentEmails(userId: string) {
  return prisma.email.findMany({
    where: { mailbox: { userId } },
    orderBy: { receivedAt: "desc" },
    take: 5,
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      fromName: true,
      status: true,
      receivedAt: true,
      mailbox: { select: { address: true } },
    },
  });
}

async function getTopMailboxes(userId: string) {
  return prisma.mailbox.findMany({
    where: { userId },
    orderBy: { emails: { _count: "desc" } },
    take: 5,
    select: {
      id: true,
      address: true,
      isStarred: true,
      _count: { select: { emails: true } },
    },
  });
}

async function getRecentActivity(userId: string) {
  // Get recent emails
  const recentEmails = await prisma.email.findMany({
    where: { mailbox: { userId } },
    orderBy: { receivedAt: "desc" },
    take: 3,
    select: {
      id: true,
      subject: true,
      fromAddress: true,
      receivedAt: true,
    },
  });

  // Get recent mailboxes
  const recentMailboxes = await prisma.mailbox.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: {
      id: true,
      address: true,
      createdAt: true,
    },
  });

  // Combine and sort by timestamp
  const activities = [
    ...recentEmails.map((email) => ({
      id: `email-${email.id}`,
      type: "email" as const,
      message: `Received email: "${email.subject || "(No subject)"}"`,
      timestamp: email.receivedAt,
    })),
    ...recentMailboxes.map((mailbox) => ({
      id: `mailbox-${mailbox.id}`,
      type: "mailbox" as const,
      message: `Created mailbox: ${mailbox.address}`,
      timestamp: mailbox.createdAt,
    })),
  ];

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 6);
}

async function getAvailableDomainsCount() {
  return prisma.domain.count({
    where: { isPublic: true, status: "ACTIVE" },
  });
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [stats, activityData, recentEmails, topMailboxes, activities, availableDomains] =
    await Promise.all([
      getStats(userId),
      getEmailActivityData(userId),
      getRecentEmails(userId),
      getTopMailboxes(userId),
      getRecentActivity(userId),
      getAvailableDomainsCount(),
    ]);

  const maxEmails = Math.max(...topMailboxes.map((m) => m._count.emails), 1);

  // Calculate email trend
  const emailTrend =
    stats.yesterdayEmailCount > 0
      ? ((stats.todayEmailCount - stats.yesterdayEmailCount) / stats.yesterdayEmailCount) * 100
      : stats.todayEmailCount > 0
        ? 100
        : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/50 hover:border-primary/30 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Mailboxes</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <Inbox className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.mailboxCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-yellow-500 font-medium">{stats.starredCount}</span> starred
            </p>
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
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                {stats.unreadCount} unread
              </Badge>
              {emailTrend !== 0 && (
                <span className="flex items-center text-xs">
                  {emailTrend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-0.5" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-500 mr-0.5" />
                  )}
                  <span className={emailTrend > 0 ? "text-green-500" : "text-red-500"}>
                    {Math.abs(Math.round(emailTrend))}%
                  </span>
                </span>
              )}
            </div>
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
            <div className="text-3xl font-bold">{availableDomains}</div>
            <p className="text-xs text-muted-foreground mt-1">Available for use</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email Activity Chart */}
          <EmailActivityChart data={activityData} />

          {/* Recent Emails */}
          <RecentEmails emails={recentEmails} />
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <QuickActions />

          {/* Top Mailboxes */}
          <TopMailboxes mailboxes={topMailboxes} maxEmails={maxEmails} />

          {/* Recent Activity */}
          <RecentActivity activities={activities} />
        </div>
      </div>
    </div>
  );
}
