import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

type RecentEmail = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName: string | null;
  status: string;
  receivedAt: Date;
  mailbox: { address: string };
};

type RecentEmailsProps = {
  emails: RecentEmail[];
};

export function RecentEmails({ emails }: RecentEmailsProps) {
  if (emails.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Recent Emails</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted mb-3">
              <Mail className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No emails yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Emails will appear here when received
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">Recent Emails</CardTitle>
          <p className="text-xs text-muted-foreground">Latest incoming messages</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inbox">
            View All
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {emails.map((email) => (
            <Link
              key={email.id}
              href={`/emails/${email.id}`}
              className="flex items-start gap-3 p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                {(email.fromName || email.fromAddress || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {email.subject || "(No subject)"}
                  </span>
                  {email.status === "UNREAD" && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                      New
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{email.fromName || email.fromAddress}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="flex-shrink-0">
                    {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground/70">
                  To: {email.mailbox.address}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
