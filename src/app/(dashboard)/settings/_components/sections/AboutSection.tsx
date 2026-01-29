"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type AppInfoResponse = {
  version: string;
  commitSha: string | null;
  commitShortSha: string | null;
  repository: { owner: string; name: string; url: string };
};

export function AboutSection() {
  const t = useTranslations("settings");

  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setAppInfoLoading(true);
      const res = await fetch("/api/app-info");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setAppInfo(data as AppInfoResponse);
      }
      setAppInfoLoading(false);
    };
    load().catch(() => setAppInfoLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          {t("about.title")}
        </CardTitle>
        <CardDescription>{t("about.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("about.labels.version")}</span>
          <Badge variant="secondary" className="font-mono">
            {appInfoLoading ? "…" : appInfo?.version || t("unknown")}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("about.labels.commit")}</span>
          <Badge variant="outline" className="font-mono" title={appInfo?.commitSha || ""}>
            {appInfoLoading ? "…" : appInfo?.commitShortSha || appInfo?.commitSha || t("unknown")}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t("about.labels.github")}</span>
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href={appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}
            target="_blank"
            rel="noreferrer"
          >
            {appInfo?.repository.owner && appInfo?.repository.name
              ? `${appInfo.repository.owner}/${appInfo.repository.name}`
              : "xinhai-ai/temail"}
          </a>
        </div>
        <Separator />
        <div className="flex flex-wrap gap-3">
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href={`${appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}/releases`}
            target="_blank"
            rel="noreferrer"
          >
            {t("about.links.releases")}
          </a>
          <a
            className="underline underline-offset-4 hover:text-foreground"
            href={`${appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}/issues`}
            target="_blank"
            rel="noreferrer"
          >
            {t("about.links.issues")}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
