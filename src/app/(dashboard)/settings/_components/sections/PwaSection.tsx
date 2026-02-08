"use client";

import { Smartphone, Download, CheckCircle2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";

export function PwaSection() {
  const t = useTranslations("settings.pwa");
  const { state, canInstall, isIosManual, isInstalled, promptInstall } = usePwaInstall();

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result === "accepted") {
      toast.success(t("toasts.installed"));
      return;
    }
    if (result === "dismissed") {
      toast.info(t("toasts.dismissed"));
      return;
    }
    toast.error(t("toasts.unavailable"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isInstalled ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("status.installed")}
            </Badge>
          ) : canInstall ? (
            <Badge variant="secondary">{t("status.available")}</Badge>
          ) : isIosManual ? (
            <Badge variant="outline">{t("status.iosManual")}</Badge>
          ) : (
            <Badge variant="outline">{t("status.unavailable")}</Badge>
          )}

          {state === "unsupported" && <Badge variant="destructive">{t("status.unsupported")}</Badge>}
        </div>

        {canInstall && (
          <Button type="button" onClick={handleInstall}>
            <Download className="h-4 w-4" />
            {t("actions.install")}
          </Button>
        )}

        {isIosManual && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">{t("ios.title")}</p>
            <p className="mb-1 flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              {t("ios.step1")}
            </p>
            <p>{t("ios.step2")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
