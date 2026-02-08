"use client";

import { useMemo, useState } from "react";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa/use-pwa-install";
import { cn } from "@/lib/utils";

export function InstallPrompt() {
  const t = useTranslations("settings.pwa");
  const { state, canInstall, isIosManual, promptInstall, dismissPrompt } = usePwaInstall();
  const [installing, setInstalling] = useState(false);
  const [hidden, setHidden] = useState(false);

  const shouldShow = useMemo(() => {
    if (hidden) return false;
    return canInstall || isIosManual;
  }, [canInstall, hidden, isIosManual]);

  if (!shouldShow || state === "installed") {
    return null;
  }

  const handleDismiss = () => {
    dismissPrompt();
    setHidden(true);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await promptInstall();
      if (result === "accepted") {
        toast.success(t("toasts.installed"));
        setHidden(true);
      } else if (result === "dismissed") {
        toast.info(t("toasts.dismissed"));
      } else {
        toast.error(t("toasts.unavailable"));
      }
    } catch {
      toast.error(t("toasts.failed"));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[360px]">
      <div className="rounded-xl border bg-card p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t("banner.title")}</p>
              <p className="text-xs text-muted-foreground">{t("banner.description")}</p>
            </div>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="-mr-1 -mt-1"
            onClick={handleDismiss}
            aria-label={t("banner.dismiss")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {canInstall ? (
          <div className="flex gap-2">
            <Button type="button" className="flex-1" onClick={handleInstall} disabled={installing}>
              <Download className={cn("h-4 w-4", installing && "animate-pulse")} />
              {installing ? t("banner.installing") : t("banner.install")}
            </Button>
            <Button type="button" variant="outline" onClick={handleDismiss}>
              {t("banner.later")}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>{t("ios.title")}</p>
            <p className="flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              {t("ios.step1")}
            </p>
            <p>{t("ios.step2")}</p>
            <Button type="button" variant="outline" className="mt-1 w-full" onClick={handleDismiss}>
              {t("banner.gotIt")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
