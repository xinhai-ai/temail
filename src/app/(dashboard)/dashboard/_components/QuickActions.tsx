import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Link2, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function QuickActions() {
  const t = await getTranslations("dashboard");

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("widgets.quickActions.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("widgets.quickActions.subtitle")}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/inbox">
            <Inbox className="h-5 w-5 text-primary" />
            <span className="text-xs">{t("widgets.quickActions.goToInbox")}</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/inbox?action=new-mailbox">
            <Plus className="h-5 w-5 text-green-500" />
            <span className="text-xs">{t("widgets.quickActions.newMailbox")}</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/settings">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs">{t("widgets.quickActions.settings")}</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
          <Link href="/inbox?action=connect-imap">
            <Link2 className="h-5 w-5 text-blue-500" />
            <span className="text-xs">{t("widgets.quickActions.connectImap")}</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
