"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Settings,
  UserPlus,
  KeyRound,
  Shield,
  Mail,
  Bot,
  Workflow,
  Send,
} from "lucide-react";
import { isVercelDeployment } from "@/lib/deployment/public";
import { SettingsLayout, type SettingsNavItem } from "@/components/settings/SettingsLayout";
import { useAdminSettings } from "./_hooks/useAdminSettings";
import { useSmtpTest } from "./_hooks/useSmtpTest";
import { useAppInfo } from "./_hooks/useAppInfo";
import { GeneralSection } from "./_components/sections/GeneralSection";
import { RegistrationSection } from "./_components/sections/RegistrationSection";
import { ProvidersSection } from "./_components/sections/ProvidersSection";
import { SecuritySection } from "./_components/sections/SecuritySection";
import { SmtpSection } from "./_components/sections/SmtpSection";
import { AiSection } from "./_components/sections/AiSection";
import { WorkflowSection } from "./_components/sections/WorkflowSection";
import { TelegramSection } from "./_components/sections/TelegramSection";

function parseAiProviderModels(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  } catch {
    return [];
  }
}

export default function AdminSettingsPage() {
  const t = useTranslations("admin");
  const vercelMode = isVercelDeployment();

  // Core settings hook
  const settings = useAdminSettings();
  const { loading, saving, saved, values, maskedValues, setValue, fetchSettings } = settings;

  // Derived state from values
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [aiClassifierEnabled, setAiClassifierEnabled] = useState(false);
  const [aiRewriteEnabled, setAiRewriteEnabled] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [emailVerificationEnabled, setEmailVerificationEnabled] = useState(false);
  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false);
  const [emailRegistrationEnabled, setEmailRegistrationEnabled] = useState(true);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubRegistrationEnabled, setGithubRegistrationEnabled] = useState(true);
  const [telegramBotEnabled, setTelegramBotEnabled] = useState(true);
  const [registrationMode, setRegistrationMode] = useState<"open" | "invite" | "closed">("open");
  const [registrationInviteCodes, setRegistrationInviteCodes] = useState("");
  const [workflowMaxExecutionLogs, setWorkflowMaxExecutionLogs] = useState("100");
  const [workflowForwardEmailEnabled, setWorkflowForwardEmailEnabled] = useState(true);
  const [aiProviderModels, setAiProviderModels] = useState<string[]>([]);
  const [aiProviderModelDraft, setAiProviderModelDraft] = useState("");
  const [aiProviderMigrating, setAiProviderMigrating] = useState(false);

  // Navigation state
  const [activeSection, setActiveSection] = useState("general");

  // Hooks
  const smtpTest = useSmtpTest();
  const appInfo = useAppInfo();

  // Sync derived state from values when they change
  useEffect(() => {
    if (loading) return;
    setSmtpSecure(values.smtp_secure === "true");
    setAiClassifierEnabled(values.ai_classifier_enabled === "true");
    setAiRewriteEnabled(values.ai_rewrite_enabled === "true");
    setTurnstileEnabled(values.turnstile_enabled === "true");
    setPasskeyEnabled(values.auth_passkey_enabled === "true");
    setOtpEnabled(values.auth_otp_enabled === "true");
    setEmailVerificationEnabled(values.auth_email_verification_enabled === "true");
    setPasswordResetEnabled(values.auth_password_reset_enabled === "true");
    setEmailRegistrationEnabled(values.auth_provider_email_registration_enabled !== "false");
    setGithubEnabled(values.auth_provider_github_enabled === "true");
    setGithubRegistrationEnabled(values.auth_provider_github_registration_enabled !== "false");
    setTelegramBotEnabled(values.telegram_bot_enabled !== "false");
    const mode = values.registration_mode;
    setRegistrationMode(mode === "invite" || mode === "closed" ? mode : "open");
    setRegistrationInviteCodes(values.registration_invite_codes || "");
    setWorkflowMaxExecutionLogs(values.workflow_max_execution_logs || "100");
    setWorkflowForwardEmailEnabled(values.workflow_forward_email_enabled !== "false");
    setAiProviderModels(parseAiProviderModels(values.ai_provider_models));
    setAiProviderModelDraft("");
  }, [loading, values]);

  // Handlers that sync back to settings
  const handleSetSmtpSecure = useCallback(
    (v: boolean) => {
      setSmtpSecure(v);
      setValue("smtp_secure", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetAiClassifierEnabled = useCallback(
    (v: boolean) => {
      setAiClassifierEnabled(v);
      setValue("ai_classifier_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetAiRewriteEnabled = useCallback(
    (v: boolean) => {
      setAiRewriteEnabled(v);
      setValue("ai_rewrite_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetTurnstileEnabled = useCallback(
    (v: boolean) => {
      setTurnstileEnabled(v);
      setValue("turnstile_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetPasskeyEnabled = useCallback(
    (v: boolean) => {
      setPasskeyEnabled(v);
      setValue("auth_passkey_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetOtpEnabled = useCallback(
    (v: boolean) => {
      setOtpEnabled(v);
      setValue("auth_otp_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetEmailVerificationEnabled = useCallback(
    (v: boolean) => {
      setEmailVerificationEnabled(v);
      setValue("auth_email_verification_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetPasswordResetEnabled = useCallback(
    (v: boolean) => {
      setPasswordResetEnabled(v);
      setValue("auth_password_reset_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetEmailRegistrationEnabled = useCallback(
    (v: boolean) => {
      setEmailRegistrationEnabled(v);
      setValue("auth_provider_email_registration_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetGithubEnabled = useCallback(
    (v: boolean) => {
      setGithubEnabled(v);
      setValue("auth_provider_github_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetGithubRegistrationEnabled = useCallback(
    (v: boolean) => {
      setGithubRegistrationEnabled(v);
      setValue("auth_provider_github_registration_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetTelegramBotEnabled = useCallback(
    (v: boolean) => {
      setTelegramBotEnabled(v);
      setValue("telegram_bot_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const handleSetRegistrationMode = useCallback(
    (v: "open" | "invite" | "closed") => {
      setRegistrationMode(v);
      setValue("registration_mode", v);
    },
    [setValue]
  );

  const handleSetRegistrationInviteCodes = useCallback(
    (v: string) => {
      setRegistrationInviteCodes(v);
      setValue("registration_invite_codes", v);
    },
    [setValue]
  );

  const handleSetWorkflowMaxExecutionLogs = useCallback(
    (v: string) => {
      setWorkflowMaxExecutionLogs(v);
      setValue("workflow_max_execution_logs", v);
    },
    [setValue]
  );

  const handleSetWorkflowForwardEmailEnabled = useCallback(
    (v: boolean) => {
      setWorkflowForwardEmailEnabled(v);
      setValue("workflow_forward_email_enabled", v ? "true" : "false");
    },
    [setValue]
  );

  const addAiProviderModel = useCallback(() => {
    const model = aiProviderModelDraft.trim();
    if (!model) return;
    setAiProviderModels((prev) => {
      if (prev.includes(model)) return prev;
      const next = [...prev, model];
      setValue("ai_provider_models", JSON.stringify(next));
      return next;
    });
    setAiProviderModelDraft("");
  }, [aiProviderModelDraft, setValue]);

  const removeAiProviderModel = useCallback(
    (model: string) => {
      setAiProviderModels((prev) => {
        const next = prev.filter((m) => m !== model);
        setValue("ai_provider_models", JSON.stringify(next));
        return next;
      });
    },
    [setValue]
  );

  const handleMigrateAiProvider = useCallback(
    async (source: "rewrite" | "classifier") => {
      setAiProviderMigrating(true);
      try {
        const res = await fetch(`/api/admin/ai/provider/migrate?source=${source}`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok) {
          toast.error(data?.error || t("settings.ai.provider.migrate.failed"));
          return;
        }

        toast.success(t("settings.ai.provider.migrate.success"));
        await fetchSettings();
      } catch {
        toast.error(t("settings.ai.provider.migrate.failed"));
      } finally {
        setAiProviderMigrating(false);
      }
    },
    [fetchSettings, t]
  );

  // AI provider migration detection
  const aiProviderBaseUrlConfigured = Boolean((values.ai_provider_base_url || "").trim());
  const aiProviderApiKeyConfigured =
    Boolean(maskedValues.ai_provider_api_key) || Boolean((values.ai_provider_api_key || "").trim());
  const legacyAiRewriteConfigured =
    Boolean((values.ai_rewrite_base_url || "").trim()) ||
    Boolean(maskedValues.ai_rewrite_api_key) ||
    Boolean((values.ai_rewrite_api_key || "").trim());
  const legacyAiClassifierConfigured =
    Boolean((values.ai_classifier_base_url || "").trim()) ||
    Boolean(maskedValues.ai_classifier_api_key) ||
    Boolean((values.ai_classifier_api_key || "").trim());
  const showAiProviderMigration =
    (!aiProviderBaseUrlConfigured || !aiProviderApiKeyConfigured) &&
    (legacyAiRewriteConfigured || legacyAiClassifierConfigured);

  // Navigation items
  const navItems = useMemo<SettingsNavItem[]>(() => {
    const items: SettingsNavItem[] = [
      { id: "general", label: t("settings.tabs.general"), icon: Settings },
      { id: "registration", label: t("settings.tabs.registration"), icon: UserPlus },
      { id: "providers", label: t("settings.tabs.providers"), icon: KeyRound },
      { id: "security", label: t("settings.tabs.security"), icon: Shield },
    ];

    if (!vercelMode) {
      items.push({ id: "smtp", label: t("settings.tabs.smtp"), icon: Mail });
    }

    items.push(
      { id: "ai", label: t("settings.tabs.ai"), icon: Bot },
      { id: "workflow", label: t("settings.tabs.workflow"), icon: Workflow },
      { id: "telegram", label: t("settings.tabs.telegram"), icon: Send }
    );

    return items;
  }, [t, vercelMode]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <SettingsLayout
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      navItems={navItems}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      saving={saving}
      saved={saved}
    >
      {activeSection === "general" && (
        <GeneralSection values={values} setValue={setValue} appInfo={appInfo} />
      )}

      {activeSection === "registration" && (
        <RegistrationSection
          registrationMode={registrationMode}
          setRegistrationMode={handleSetRegistrationMode}
          registrationInviteCodes={registrationInviteCodes}
          setRegistrationInviteCodes={handleSetRegistrationInviteCodes}
        />
      )}

      {activeSection === "providers" && (
        <ProvidersSection
          values={values}
          maskedValues={maskedValues}
          setValue={setValue}
          emailRegistrationEnabled={emailRegistrationEnabled}
          setEmailRegistrationEnabled={handleSetEmailRegistrationEnabled}
          githubEnabled={githubEnabled}
          setGithubEnabled={handleSetGithubEnabled}
          githubRegistrationEnabled={githubRegistrationEnabled}
          setGithubRegistrationEnabled={handleSetGithubRegistrationEnabled}
        />
      )}

      {activeSection === "security" && (
        <SecuritySection
          values={values}
          maskedValues={maskedValues}
          setValue={setValue}
          turnstileEnabled={turnstileEnabled}
          setTurnstileEnabled={handleSetTurnstileEnabled}
          passkeyEnabled={passkeyEnabled}
          setPasskeyEnabled={handleSetPasskeyEnabled}
          otpEnabled={otpEnabled}
          setOtpEnabled={handleSetOtpEnabled}
          emailVerificationEnabled={emailVerificationEnabled}
          setEmailVerificationEnabled={handleSetEmailVerificationEnabled}
          passwordResetEnabled={passwordResetEnabled}
          setPasswordResetEnabled={handleSetPasswordResetEnabled}
        />
      )}

      {activeSection === "smtp" && !vercelMode && (
        <SmtpSection
          values={values}
          setValue={setValue}
          smtpSecure={smtpSecure}
          setSmtpSecure={handleSetSmtpSecure}
          smtpTestTo={smtpTest.smtpTestTo}
          setSmtpTestTo={smtpTest.setSmtpTestTo}
          smtpTestSubject={smtpTest.smtpTestSubject}
          setSmtpTestSubject={smtpTest.setSmtpTestSubject}
          smtpTesting={smtpTest.testing}
          handleSmtpTest={smtpTest.handleSmtpTest}
        />
      )}

      {activeSection === "ai" && (
        <AiSection
          values={values}
          maskedValues={maskedValues}
          setValue={setValue}
          aiProviderModels={aiProviderModels}
          aiProviderModelDraft={aiProviderModelDraft}
          setAiProviderModelDraft={setAiProviderModelDraft}
          addAiProviderModel={addAiProviderModel}
          removeAiProviderModel={removeAiProviderModel}
          aiClassifierEnabled={aiClassifierEnabled}
          setAiClassifierEnabled={handleSetAiClassifierEnabled}
          aiRewriteEnabled={aiRewriteEnabled}
          setAiRewriteEnabled={handleSetAiRewriteEnabled}
          showAiProviderMigration={showAiProviderMigration}
          legacyAiRewriteConfigured={legacyAiRewriteConfigured}
          legacyAiClassifierConfigured={legacyAiClassifierConfigured}
          aiProviderMigrating={aiProviderMigrating}
          handleMigrateAiProvider={handleMigrateAiProvider}
          saving={saving}
        />
      )}

      {activeSection === "workflow" && (
        <WorkflowSection
          workflowForwardEmailEnabled={workflowForwardEmailEnabled}
          setWorkflowForwardEmailEnabled={handleSetWorkflowForwardEmailEnabled}
          workflowMaxExecutionLogs={workflowMaxExecutionLogs}
          setWorkflowMaxExecutionLogs={handleSetWorkflowMaxExecutionLogs}
        />
      )}

      {activeSection === "telegram" && (
        <TelegramSection
          telegramBotEnabled={telegramBotEnabled}
          setTelegramBotEnabled={handleSetTelegramBotEnabled}
        />
      )}
    </SettingsLayout>
  );
}
