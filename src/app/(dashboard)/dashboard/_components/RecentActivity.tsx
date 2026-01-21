import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Mail, Inbox, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityItem = {
  id: string;
  type: "email" | "mailbox";
  message: string;
  timestamp: Date;
  metadata?: string;
};

type RecentActivityProps = {
  activities: ActivityItem[];
};

const activityIcons = {
  email: Mail,
  mailbox: Inbox,
};

const activityColors = {
  email: "text-blue-500 bg-blue-500/10",
  mailbox: "text-primary bg-primary/10",
};

export function RecentActivity({ activities }: RecentActivityProps) {
  if (activities.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Activity will appear here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Recent Activity</CardTitle>
        <p className="text-xs text-muted-foreground">Latest events in your account</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const Icon = activityIcons[activity.type];
            const colorClass = activityColors[activity.type];
            return (
              <div key={activity.id} className="flex gap-3">
                <div className="relative">
                  <div className={cn("p-2 rounded-full", colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {index < activities.length - 1 && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px h-6 bg-border" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
