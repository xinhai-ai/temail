import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Inbox, Star } from "lucide-react";
import Link from "next/link";

type TopMailbox = {
  id: string;
  address: string;
  isStarred: boolean;
  _count: { emails: number };
};

type TopMailboxesProps = {
  mailboxes: TopMailbox[];
  maxEmails: number;
};

export function TopMailboxes({ mailboxes, maxEmails }: TopMailboxesProps) {
  if (mailboxes.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Top Mailboxes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No mailboxes yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Create a mailbox to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Top Mailboxes</CardTitle>
        <p className="text-xs text-muted-foreground">Most active mailboxes by email count</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {mailboxes.map((mailbox, index) => {
          const percentage = maxEmails > 0 ? (mailbox._count.emails / maxEmails) * 100 : 0;
          return (
            <Link
              key={mailbox.id}
              href={`/inbox?mailbox=${mailbox.id}`}
              className="block group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground font-medium w-4">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {mailbox.address}
                  </span>
                  {mailbox.isStarred && (
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {mailbox._count.emails}
                </Badge>
              </div>
              <Progress value={percentage} className="h-1.5" />
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
