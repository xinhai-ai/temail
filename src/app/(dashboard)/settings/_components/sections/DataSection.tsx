"use client";

import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useTrash } from "../../_hooks/useTrash";

type DataSectionProps = {
  trash: ReturnType<typeof useTrash>;
};

export function DataSection({ trash }: DataSectionProps) {
  const t = useTranslations("settings");

  const {
    trashRetentionDays,
    setTrashRetentionDays,
    trashDirty,
    loadingTrash,
    savingTrash,
    handleSaveTrash,
  } = trash;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          {t("trash.title")}
        </CardTitle>
        <CardDescription>{t("trash.description")}</CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-mono">
            {loadingTrash ? "…" : `${trashRetentionDays || "0"}d`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("trash.retentionLabel")}</Label>
          <Input
            type="number"
            min={0}
            max={3650}
            value={trashRetentionDays}
            onChange={(e) => setTrashRetentionDays(e.target.value)}
            disabled={loadingTrash || savingTrash}
          />
          <p className="text-xs text-muted-foreground">{t("trash.retentionHelp")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTrashRetentionDays("0")}
            disabled={loadingTrash || savingTrash}
          >
            {t("trash.presets.never")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTrashRetentionDays("30")}
            disabled={loadingTrash || savingTrash}
          >
            {t("trash.presets.days30")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTrashRetentionDays("90")}
            disabled={loadingTrash || savingTrash}
          >
            {t("trash.presets.days90")}
          </Button>
        </div>
        <Button onClick={handleSaveTrash} disabled={loadingTrash || savingTrash || !trashDirty}>
          {savingTrash ? t("trash.actions.saving") : t("trash.actions.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
