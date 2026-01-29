"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type WorkflowSectionProps = {
  workflowForwardEmailEnabled: boolean;
  setWorkflowForwardEmailEnabled: (value: boolean) => void;
  workflowMaxExecutionLogs: string;
  setWorkflowMaxExecutionLogs: (value: string) => void;
};

export function WorkflowSection({
  workflowForwardEmailEnabled,
  setWorkflowForwardEmailEnabled,
  workflowMaxExecutionLogs,
  setWorkflowMaxExecutionLogs,
}: WorkflowSectionProps) {
  const t = useTranslations("admin");

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
