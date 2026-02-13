"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { useTrash } from "../../_hooks/useTrash";
import type { useRetention } from "../../_hooks/useRetention";
import type { useStorageUsage } from "../../_hooks/useStorageUsage";
import type { useMailContentStorage } from "../../_hooks/useMailContentStorage";

type DataSectionProps = {
  trash: ReturnType<typeof useTrash>;
  retention: ReturnType<typeof useRetention>;
  storageUsage: ReturnType<typeof useStorageUsage>;
  mailContentStorage: ReturnType<typeof useMailContentStorage>;
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function DataSection({ trash, retention, storageUsage, mailContentStorage }: DataSectionProps) {
  const t = useTranslations("settings");

  const {
    trashRetentionDays,
    setTrashRetentionDays,
    trashDirty,
    loadingTrash,
    savingTrash,
    handleSaveTrash,
  } = trash;

  const {
    mailboxExpireDays,
    setMailboxExpireDays,
    mailboxExpireAction,
    setMailboxExpireAction,
    emailExpireDays,
    setEmailExpireDays,
    emailExpireAction,
    setEmailExpireAction,
    retentionDirty,
    loadingRetention,
    savingRetention,
    handleSaveRetention,
  } = retention;

  const {
    storeRawAndAttachments,
    setStoreRawAndAttachments,
    loadingMailContentStorage,
    savingMailContentStorage,
    mailContentStorageDirty,
    handleSaveMailContentStorage,
  } = mailContentStorage;

  const storage = storageUsage.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("storage.title")}</CardTitle>
          <CardDescription>{t("storage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>{t("storage.usedSpace")}</span>
            <span className="font-medium">{storageUsage.loading ? "…" : formatBytes(storage?.usage.bytes || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("storage.usedFiles")}</span>
            <span className="font-medium">{storageUsage.loading ? "…" : storage?.usage.files || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("storage.quotaSpace")}</span>
            <span className="font-medium">
              {storageUsage.loading
                ? "…"
                : storage?.quota.maxStorageMb === null || storage?.quota.maxStorageMb === undefined
                  ? t("userGroup.unlimited")
                  : `${storage.quota.maxStorageMb} MB`}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>{t("storage.quotaFiles")}</span>
            <span className="font-medium">
              {storageUsage.loading
                ? "…"
                : storage?.quota.maxStorageFiles === null || storage?.quota.maxStorageFiles === undefined
                  ? t("userGroup.unlimited")
                  : storage.quota.maxStorageFiles}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("mailContentStorage.title")}</CardTitle>
          <CardDescription>{t("mailContentStorage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="mail-content-storage-toggle">{t("mailContentStorage.toggleLabel")}</Label>
              <p className="text-xs text-muted-foreground">{t("mailContentStorage.help")}</p>
            </div>
            <Switch
              id="mail-content-storage-toggle"
              checked={storeRawAndAttachments}
              onCheckedChange={setStoreRawAndAttachments}
              disabled={loadingMailContentStorage || savingMailContentStorage}
            />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              <span>{t("mailContentStorage.warningTitle")}</span>
            </div>
            <p className="mt-1">{t("mailContentStorage.warningDescription")}</p>
          </div>

          <Button
            onClick={handleSaveMailContentStorage}
            disabled={loadingMailContentStorage || savingMailContentStorage || !mailContentStorageDirty}
          >
            {savingMailContentStorage ? t("mailContentStorage.actions.saving") : t("mailContentStorage.actions.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("retention.title")}</CardTitle>
          <CardDescription>{t("retention.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("retention.mailbox.days")}</Label>
              <Input
                type="number"
                min={-1}
                max={3650}
                value={mailboxExpireDays}
                onChange={(e) => setMailboxExpireDays(e.target.value)}
                disabled={loadingRetention || savingRetention}
              />
              <p className="text-xs text-muted-foreground">{t("retention.helpDays")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("retention.mailbox.action")}</Label>
              <Select
                value={mailboxExpireAction}
                onValueChange={(value) => setMailboxExpireAction(value as "ARCHIVE" | "DELETE")}
                disabled={loadingRetention || savingRetention}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARCHIVE">{t("retention.actions.archive")}</SelectItem>
                  <SelectItem value="DELETE">{t("retention.actions.mailboxDelete")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("retention.email.days")}</Label>
              <Input
                type="number"
                min={-1}
                max={3650}
                value={emailExpireDays}
                onChange={(e) => setEmailExpireDays(e.target.value)}
                disabled={loadingRetention || savingRetention}
              />
              <p className="text-xs text-muted-foreground">{t("retention.helpDays")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("retention.email.action")}</Label>
              <Select
                value={emailExpireAction}
                onValueChange={(value) => setEmailExpireAction(value as "ARCHIVE" | "DELETE")}
                disabled={loadingRetention || savingRetention}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARCHIVE">{t("retention.actions.archive")}</SelectItem>
                  <SelectItem value="DELETE">{t("retention.actions.emailDelete")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSaveRetention} disabled={loadingRetention || savingRetention || !retentionDirty}>
            {savingRetention ? t("retention.actions.saving") : t("retention.actions.save")}
          </Button>
        </CardContent>
      </Card>

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
    </div>
  );
}
