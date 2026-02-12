"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save, Power, PowerOff, History, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { ExecutionLogsPanel } from "@/components/workflow/panels/ExecutionLogsPanel";
import { WorkflowTestDialog } from "@/components/workflow/WorkflowTestDialog";
import { useWorkflowStore } from "@/lib/workflow/store";
import { normalizeTypedWorkflowConfigForPolicy } from "@/lib/workflow/normalize";
import { validateWorkflow } from "@/lib/workflow/utils";
import { useTranslations } from "next-intl";
import type { NodeType, WorkflowConfig } from "@/lib/workflow/types";
import { isVercelDeployment } from "@/lib/deployment/public";
import { getApiErrorMessage, type Translator } from "@/lib/policy-client";

type UserGroupInfo = {
  userGroup: {
    telegramEnabled: boolean;
    workflowForwardEmailEnabled: boolean;
    workflowForwardWebhookEnabled: boolean;
  } | null;
};

function getDisabledWorkflowNodeTypes(params: {
  vercelMode: boolean;
  userGroup: UserGroupInfo["userGroup"];
}): Set<NodeType> {
  const disabled = new Set<NodeType>();
  if (params.vercelMode) disabled.add("forward:email");
  if (params.userGroup && !params.userGroup.workflowForwardEmailEnabled) disabled.add("forward:email");
  if (params.userGroup && !params.userGroup.workflowForwardWebhookEnabled) {
    disabled.add("forward:webhook");
    disabled.add("forward:feishu");
    disabled.add("forward:serverchan");
  }
  if (params.userGroup && !params.userGroup.telegramEnabled) {
    disabled.add("forward:telegram");
    disabled.add("forward:telegram-bound");
  }
  return disabled;
}

function pruneWorkflowConfig(config: WorkflowConfig, disabledTypes: Set<NodeType>) {
  const normalized = normalizeTypedWorkflowConfigForPolicy(config, {
    disabledTypes,
  });
  return {
    config: normalized.config,
    removedTypes: normalized.removedTypes,
  };
}

export default function WorkflowEditorPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations("workflows");
  const tPolicy = useTranslations("policy") as unknown as Translator;
  const isNew = params.id === "new";
  const workflowId = isNew ? null : (params.id as string);
  const vercelMode = isVercelDeployment();

  const [loading, setLoading] = useState(!isNew);
  const [mailboxes, setMailboxes] = useState<{ id: string; address: string }[]>([]);
  const [showMetaDialog, setShowMetaDialog] = useState(isNew);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);

  // Extract stable function references from store
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const setWorkflowMeta = useWorkflowStore((s) => s.setWorkflowMeta);
  const setIsSaving = useWorkflowStore((s) => s.setIsSaving);
  const markClean = useWorkflowStore((s) => s.markClean);
  const getConfig = useWorkflowStore((s) => s.getConfig);

  // Extract state values separately
  const name = useWorkflowStore((s) => s.name);
  const description = useWorkflowStore((s) => s.description);
  const status = useWorkflowStore((s) => s.status);
  const mailboxId = useWorkflowStore((s) => s.mailboxId);
  const isSaving = useWorkflowStore((s) => s.isSaving);
  const isDirty = useWorkflowStore((s) => s.isDirty);

  useEffect(() => {
    const fetchMailboxes = async () => {
      try {
        const res = await fetch("/api/mailboxes");
        const data = await res.json();
        setMailboxes(res.ok ? data : []);
      } catch {
        setMailboxes([]);
      }
    };
    fetchMailboxes();
  }, []);

  useEffect(() => {
    if (!isNew && workflowId) {
      const fetchWorkflow = async () => {
        try {
          const [res, groupRes] = await Promise.all([
            fetch(`/api/workflows/${workflowId}`),
            fetch("/api/users/me/usergroup"),
          ]);
          if (!res.ok) {
            const error = await res.json().catch(() => null);
            toast.error(getApiErrorMessage(tPolicy, error, t("editor.toast.loadFailed")));
            router.push("/workflows");
            return;
          }
          const data = await res.json();
          const config = JSON.parse(data.config) as WorkflowConfig;

          const groupData = await groupRes.json().catch(() => null);
          const userGroup = groupRes.ok && groupData && typeof groupData === "object"
            ? ((groupData as UserGroupInfo).userGroup ?? null)
            : null;

          const disabledTypes = getDisabledWorkflowNodeTypes({ vercelMode, userGroup });
          const pruned = pruneWorkflowConfig(config, disabledTypes);
          if (pruned.removedTypes.length > 0) {
            toast.warning(tPolicy("nodesRemoved", { nodes: pruned.removedTypes.join(", ") }));
          }

          loadWorkflow(
            data.id,
            data.name,
            data.description || "",
            data.status,
            data.mailboxId,
            pruned.config
          );
        } catch (error) {
          toast.error(t("editor.toast.loadFailed"));
          router.push("/workflows");
        } finally {
          setLoading(false);
        }
      };
      fetchWorkflow();
    }
  }, [isNew, workflowId, router, loadWorkflow, t, tPolicy, vercelMode]);

  const handleSave = useCallback(async () => {
    const config = getConfig();
    const errors = validateWorkflow(config);
    const criticalErrors = errors.filter((e) => e.type === "error");

    if (criticalErrors.length > 0) {
      toast.error(t("editor.toast.cannotSave", { message: criticalErrors[0].message }));
      return;
    }

    setIsSaving(true);

    try {
      if (isNew) {
        if (!name) {
          setShowMetaDialog(true);
          setIsSaving(false);
          return;
        }

        const res = await fetch("/api/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            mailboxId: mailboxId || undefined,
            config,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(getApiErrorMessage(tPolicy, data, t("editor.toast.createFailed")));
          return;
        }

        const data = await res.json();
        toast.success(t("editor.toast.created"));
        router.push(`/workflows/${data.id}`);
      } else {
        const res = await fetch(`/api/workflows/${workflowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            mailboxId,
            config,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(getApiErrorMessage(tPolicy, data, t("editor.toast.saveFailed")));
          return;
        }

        toast.success(t("editor.toast.saved"));
        markClean();
      }
    } catch (error) {
      toast.error(t("editor.toast.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [isNew, workflowId, name, description, mailboxId, router, getConfig, setIsSaving, markClean, t, tPolicy]);

  const handleToggleStatus = useCallback(async () => {
    if (isNew) return;

    const newStatus = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const res = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        toast.error(t("editor.toast.updateStatusFailed"));
        return;
      }

      setWorkflowMeta({ status: newStatus });
      toast.success(newStatus === "ACTIVE" ? t("toast.activated") : t("toast.deactivated"));
    } catch {
      toast.error(t("editor.toast.updateStatusFailed"));
    }
  }, [isNew, status, workflowId, setWorkflowMeta, t]);

  const handleMetaSubmit = () => {
    if (!name) {
      toast.error(t("editor.toast.nameRequired"));
      return;
    }
    setShowMetaDialog(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="-m-4 md:-m-6 h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-background z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/workflows">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-semibold truncate">{name}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {description || t("editor.noDescription")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end">
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistoryDialog(true)}
              aria-label={t("editor.history.aria")}
            >
              <History className="h-3 w-3 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("editor.history.button")}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMetaDialog(true)}
            aria-label={t("editor.settings.aria")}
          >
            <Settings className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("editor.settings.button")}</span>
          </Button>
          {!isNew && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleStatus}
              aria-label={status === "ACTIVE" ? t("editor.status.ariaDeactivate") : t("editor.status.ariaActivate")}
            >
              {status === "ACTIVE" ? (
                <>
                  <PowerOff className="h-3 w-3 sm:mr-1.5" />
                  <span className="hidden sm:inline">{t("editor.status.deactivate")}</span>
                </>
              ) : (
                <>
                  <Power className="h-3 w-3 sm:mr-1.5" />
                  <span className="hidden sm:inline">{t("editor.status.activate")}</span>
                </>
              )}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || (!isNew && !isDirty)}
            size="sm"
            aria-label={t("editor.save.aria")}
            title={isSaving ? t("editor.save.saving") : t("editor.save.save")}
          >
            <Save className="h-3 w-3 sm:mr-1.5" />
            <span className="hidden sm:inline">{isSaving ? t("editor.save.saving") : t("editor.save.save")}</span>
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <WorkflowCanvas
          mailboxes={mailboxes}
          onTestClick={() => setShowTestDialog(true)}
          canTest={!isNew && !!workflowId}
        />
      </div>

      {/* Meta Dialog */}
      <Dialog open={showMetaDialog} onOpenChange={setShowMetaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editor.settings.dialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("editor.settings.nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setWorkflowMeta({ name: e.target.value })}
                placeholder={t("editor.settings.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("editor.settings.descriptionLabel")}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setWorkflowMeta({ description: e.target.value })}
                placeholder={t("editor.settings.descriptionPlaceholder")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mailbox">{t("editor.settings.defaultMailboxLabel")}</Label>
              <Select
                value={mailboxId || "all"}
                onValueChange={(v) =>
                  setWorkflowMeta({ mailboxId: v === "all" ? null : v })
                }
              >
                <SelectTrigger id="mailbox">
                  <SelectValue placeholder={t("editor.settings.selectMailbox")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("editor.settings.allMailboxes")}</SelectItem>
                  {mailboxes.map((mb) => (
                    <SelectItem key={mb.id} value={mb.id}>
                      {mb.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleMetaSubmit}>{t("editor.settings.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle>{t("editor.history.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto">
            {workflowId && <ExecutionLogsPanel workflowId={workflowId} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <WorkflowTestDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        workflowId={workflowId}
        workflowName={name}
        getConfig={getConfig}
      />
    </div>
  );
}
