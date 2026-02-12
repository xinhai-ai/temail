"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const INBOX_DESKTOP_LAYOUT_MODE_KEY = "temail.inbox.desktopLayoutMode";

function getInboxDesktopLayoutMode(): "three" | "two" {
  if (typeof window === "undefined") return "three";
  try {
    const raw = localStorage.getItem(INBOX_DESKTOP_LAYOUT_MODE_KEY);
    return raw === "two" ? "two" : "three";
  } catch {
    return "three";
  }
}

export function AppearanceSection() {
  const t = useTranslations("settings");
  const [inboxDesktopLayoutMode, setInboxDesktopLayoutMode] = useState<"three" | "two">(() => getInboxDesktopLayoutMode());

  const handleInboxDesktopLayoutModeChange = (value: string) => {
    const next = value === "two" ? "two" : "three";
    setInboxDesktopLayoutMode(next);
    try {
      localStorage.setItem(INBOX_DESKTOP_LAYOUT_MODE_KEY, next);
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {t("appearance.title")}
        </CardTitle>
        <CardDescription>{t("appearance.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("appearance.inbox.layout.label")}</Label>
          <Select value={inboxDesktopLayoutMode} onValueChange={handleInboxDesktopLayoutModeChange}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="three">{t("appearance.inbox.layout.mode.three")}</SelectItem>
              <SelectItem value="two">{t("appearance.inbox.layout.mode.two")}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("appearance.inbox.layout.help")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
