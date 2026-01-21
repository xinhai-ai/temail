import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Plus, Settings } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Quick Actions</CardTitle>
        <p className="text-xs text-muted-foreground">Common tasks at your fingertips</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/inbox">
            <Inbox className="h-5 w-5 text-primary" />
            <span className="text-xs">Go to Inbox</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/inbox?action=new-mailbox">
            <Plus className="h-5 w-5 text-green-500" />
            <span className="text-xs">New Mailbox</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/settings">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">Settings</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
