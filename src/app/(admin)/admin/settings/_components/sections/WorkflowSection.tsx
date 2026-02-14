"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WorkflowSectionProps = {
  workflowForwardEmailEnabled: boolean;
  setWorkflowForwardEmailEnabled: (value: boolean) => void;
  workflowMaxExecutionLogs: string;
  setWorkflowMaxExecutionLogs: (value: string) => void;
  workflowEgressMode: string;
  setWorkflowEgressMode: (value: string) => void;
  workflowEgressHttpProxyUrl: string;
  setWorkflowEgressHttpProxyUrl: (value: string) => void;
  workflowEgressSocksProxyUrl: string;
  setWorkflowEgressSocksProxyUrl: (value: string) => void;
  workflowEgressWorkerUrl: string;
  setWorkflowEgressWorkerUrl: (value: string) => void;
  workflowEgressWorkerToken: string;
  setWorkflowEgressWorkerToken: (value: string) => void;
  workflowEgressWorkerTokenMasked: boolean;
};

export function WorkflowSection({
  workflowForwardEmailEnabled,
  setWorkflowForwardEmailEnabled,
  workflowMaxExecutionLogs,
  setWorkflowMaxExecutionLogs,
  workflowEgressMode,
  setWorkflowEgressMode,
  workflowEgressHttpProxyUrl,
  setWorkflowEgressHttpProxyUrl,
  workflowEgressSocksProxyUrl,
  setWorkflowEgressSocksProxyUrl,
  workflowEgressWorkerUrl,
  setWorkflowEgressWorkerUrl,
  workflowEgressWorkerToken,
  setWorkflowEgressWorkerToken,
  workflowEgressWorkerTokenMasked,
}: WorkflowSectionProps) {
  const t = useTranslations("admin");

  const rawMode = (workflowEgressMode || "direct").trim();
  const normalizedMode =
    rawMode === "http_proxy" || rawMode === "socks_proxy" || rawMode === "cloudflare_worker"
      ? rawMode
      : "direct";

  return (
    <SettingSection
      icon={Settings}
      title={t("settings.workflow.cardTitle")}
      description={t("settings.workflow.subtitle")}
    >
      <SettingRow
        type="switch"
        label={t("settings.workflow.forwardEmail.label")}
        description={t("settings.workflow.forwardEmail.help")}
        checked={workflowForwardEmailEnabled}
        onCheckedChange={setWorkflowForwardEmailEnabled}
      />

      <Separator />

      <SettingRow
        type="custom"
        label={t("settings.workflow.egress.mode.label")}
        description={t("settings.workflow.egress.mode.help")}
      >
        <Select
          value={normalizedMode}
          onValueChange={setWorkflowEgressMode}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="direct">{t("settings.workflow.egress.mode.options.direct")}</SelectItem>
            <SelectItem value="http_proxy">{t("settings.workflow.egress.mode.options.httpProxy")}</SelectItem>
            <SelectItem value="socks_proxy">{t("settings.workflow.egress.mode.options.socksProxy")}</SelectItem>
            <SelectItem value="cloudflare_worker">{t("settings.workflow.egress.mode.options.cloudflareWorker")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      {normalizedMode === "http_proxy" && (
        <div className="space-y-2">
          <Label>{t("settings.workflow.egress.httpProxyUrl.label")}</Label>
          <Input
            placeholder={t("settings.workflow.egress.httpProxyUrl.placeholder")}
            value={workflowEgressHttpProxyUrl}
            onChange={(e) => setWorkflowEgressHttpProxyUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.workflow.egress.httpProxyUrl.help")}</p>
        </div>
      )}

      {normalizedMode === "socks_proxy" && (
        <div className="space-y-2">
          <Label>{t("settings.workflow.egress.socksProxyUrl.label")}</Label>
          <Input
            placeholder={t("settings.workflow.egress.socksProxyUrl.placeholder")}
            value={workflowEgressSocksProxyUrl}
            onChange={(e) => setWorkflowEgressSocksProxyUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.workflow.egress.socksProxyUrl.help")}</p>
        </div>
      )}

      {normalizedMode === "cloudflare_worker" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label>{t("settings.workflow.egress.workerUrl.label")}</Label>
            <Input
              placeholder={t("settings.workflow.egress.workerUrl.placeholder")}
              value={workflowEgressWorkerUrl}
              onChange={(e) => setWorkflowEgressWorkerUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("settings.workflow.egress.workerUrl.help")}</p>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.workflow.egress.workerToken.label")}</Label>
            <Input
              type="password"
              placeholder={
                workflowEgressWorkerTokenMasked && !workflowEgressWorkerToken
                  ? t("settings.common.secretConfigured")
                  : t("settings.workflow.egress.workerToken.placeholder")
              }
              value={workflowEgressWorkerToken}
              onChange={(e) => setWorkflowEgressWorkerToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("settings.workflow.egress.workerToken.help")}</p>
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <Label>{t("settings.workflow.maxExecutionLogs.label")}</Label>
        <p className="text-xs text-muted-foreground">{t("settings.workflow.maxExecutionLogs.help")}</p>
        <Input
          type="number"
          min="10"
          max="10000"
          placeholder="100"
          value={workflowMaxExecutionLogs}
          onChange={(e) => setWorkflowMaxExecutionLogs(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("settings.workflow.maxExecutionLogs.recommended")}</p>
      </div>
    </SettingSection>
  );
}
