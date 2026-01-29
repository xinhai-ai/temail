"use client";

import { useTranslations } from "next-intl";
import { Key, Plus } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OPEN_API_SCOPES } from "@/lib/open-api/scopes";
import type { useApiKeys } from "../../_hooks/useApiKeys";

type ApiSectionProps = {
  apiKeys: ReturnType<typeof useApiKeys>;
};

export function ApiSection({ apiKeys: hook }: ApiSectionProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const {
    apiKeysLoading,
    apiKeysWorkingId,
    apiKeys,
    showCreateApiKeyDialog,
    setShowCreateApiKeyDialog,
    apiKeyName,
    setApiKeyName,
    apiKeyScopes,
    setApiKeyScopeChecked,
    creatingApiKey,
    createdApiToken,
    editingApiKey,
    editingApiKeyScopes,
    setEditingApiKeyScopeChecked,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateApiKey,
    handleCopyApiToken,
    handleSetApiKeyDisabled,
    handleDeleteApiKey,
    handleCancelEditApiKeyScopes,
    handleSaveApiKeyScopes,
    handleStartEditApiKeyScopes,
  } = hook;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t("apiKeys.title")}
          </CardTitle>
          <CardDescription>{t("apiKeys.description")}</CardDescription>
          <CardAction>
            <Button size="sm" onClick={handleOpenCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              {t("apiKeys.create.create")}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKeysLoading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("apiKeys.list.empty")}</p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key, idx) => (
                <div key={key.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{key.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("apiKeys.list.prefix")}: <span className="font-mono">{key.keyPrefix}</span>
                      </p>
                    </div>
                    {key.disabledAt ? (
                      <Badge variant="secondary">{t("apiKeys.list.status.disabled")}</Badge>
                    ) : (
                      <Badge>{t("apiKeys.list.status.active")}</Badge>
                    )}
                  </div>

                  {key.scopes.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {key.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="font-mono text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {t("apiKeys.list.usage")}: {key.usageCount} · {t("apiKeys.list.lastUsed")}:{" "}
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "—"}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartEditApiKeyScopes(key)}
                      disabled={apiKeysWorkingId === key.id}
                    >
                      {t("apiKeys.list.actions.editScopes")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetApiKeyDisabled(key.id, !key.disabledAt)}
                      disabled={apiKeysWorkingId === key.id}
                    >
                      {key.disabledAt ? t("apiKeys.list.actions.enable") : t("apiKeys.list.actions.disable")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteApiKey(key.id)}
                      disabled={apiKeysWorkingId === key.id}
                    >
                      {t("apiKeys.list.actions.delete")}
                    </Button>
                  </div>

                  {idx < apiKeys.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateApiKeyDialog} onOpenChange={setShowCreateApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.create.title")}</DialogTitle>
            <DialogDescription>{t("apiKeys.description")}</DialogDescription>
          </DialogHeader>
          {createdApiToken ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("apiKeys.token.title")}</Label>
                <Input value={createdApiToken} readOnly className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">{t("apiKeys.token.help")}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCopyApiToken}>
                  {t("apiKeys.token.copy")}
                </Button>
                <Button type="button" onClick={handleCloseCreateDialog}>
                  {tCommon("done")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("apiKeys.create.name")}</Label>
                <Input
                  value={apiKeyName}
                  onChange={(e) => setApiKeyName(e.target.value)}
                  placeholder="My integration key"
                  disabled={creatingApiKey}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("apiKeys.create.scopes")}</Label>
                <div className="grid gap-2 max-h-64 overflow-y-auto">
                  {OPEN_API_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={apiKeyScopes.includes(scope)}
                        onCheckedChange={(checked) => setApiKeyScopeChecked(scope, checked === true)}
                        disabled={creatingApiKey}
                      />
                      <span className="font-mono text-xs">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseCreateDialog} disabled={creatingApiKey}>
                  {tCommon("cancel")}
                </Button>
                <Button onClick={handleCreateApiKey} disabled={creatingApiKey || apiKeyScopes.length === 0}>
                  {creatingApiKey ? t("apiKeys.create.creating") : t("apiKeys.create.create")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editingApiKey !== null} onOpenChange={(open) => !open && handleCancelEditApiKeyScopes()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.edit.title")}</DialogTitle>
            <DialogDescription>
              {editingApiKey?.name} ({editingApiKey?.keyPrefix})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("apiKeys.edit.scopes")}</Label>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {OPEN_API_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={editingApiKeyScopes.includes(scope)}
                      onCheckedChange={(checked) => setEditingApiKeyScopeChecked(scope, checked === true)}
                      disabled={apiKeysWorkingId === editingApiKey?.id}
                    />
                    <span className="font-mono text-xs">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEditApiKeyScopes}
                disabled={apiKeysWorkingId === editingApiKey?.id}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                onClick={handleSaveApiKeyScopes}
                disabled={apiKeysWorkingId === editingApiKey?.id || editingApiKeyScopes.length === 0}
              >
                {apiKeysWorkingId === editingApiKey?.id ? t("apiKeys.edit.saving") : t("apiKeys.edit.save")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
