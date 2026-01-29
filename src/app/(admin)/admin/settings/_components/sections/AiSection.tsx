"use client";

import { useTranslations } from "next-intl";
import { Settings, Info, X } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_AI_CLASSIFIER_PROMPT = `You are an email classification assistant. Analyze the email content and classify it into one of the following categories:

{{categories}}

Return your result in JSON.

Email Subject: {{email.subject}}
Email From: {{email.fromAddress}}
Email Body: {{email.textBody}}`;

const DEFAULT_AI_REWRITE_PROMPT = `You are an email rewriting and extraction assistant.

Return a JSON object with this schema:
{
  "subject": string | null,
  "textBody": string | null,
  "htmlBody": string | null,
  "variables": object | null,
  "reasoning": string | null
}

Rules:
- If you don't want to change a field, return null for that field.
- If extracting data, put it into "variables" as a flat object of string values.
- The workflow node write target is: {{writeTarget}}
- Allowed email fields for rewriting (JSON array): {{allowedEmailFieldsJson}}
- If writeTarget is "variables", you MUST set subject/textBody/htmlBody to null.
- If writeTarget is "email", you MUST set variables to null.
- You MUST NOT invent variable keys. Only use keys explicitly requested by the user.
- Allowed variable keys (JSON array): {{requestedVariableKeysJson}}
- If the allowed key list is empty, set "variables" to null.
- Do not output additional keys under "variables" (no synonyms, no extra keys).
- Variable values must be plain strings (do not JSON-encode objects).
- Do not return additional keys.

Email Subject:
{{email.subject}}

Email Text Body:
{{email.textBody}}

Email HTML Body:
{{email.htmlBody}}

Existing Variables (JSON):
{{variablesJson}}

Instruction:
{{instruction}}`;

type AiSectionProps = {
  values: Record<string, string>;
  maskedValues: Record<string, boolean>;
  setValue: (key: string, value: string) => void;
  aiProviderModels: string[];
  aiProviderModelDraft: string;
  setAiProviderModelDraft: (value: string) => void;
  addAiProviderModel: () => void;
  removeAiProviderModel: (model: string) => void;
  aiClassifierEnabled: boolean;
  setAiClassifierEnabled: (value: boolean) => void;
  aiRewriteEnabled: boolean;
  setAiRewriteEnabled: (value: boolean) => void;
  showAiProviderMigration: boolean;
  legacyAiRewriteConfigured: boolean;
  legacyAiClassifierConfigured: boolean;
  aiProviderMigrating: boolean;
  handleMigrateAiProvider: (source: "rewrite" | "classifier") => Promise<void>;
  saving: boolean;
};

export function AiSection({
  values,
  maskedValues,
  setValue,
  aiProviderModels,
  aiProviderModelDraft,
  setAiProviderModelDraft,
  addAiProviderModel,
  removeAiProviderModel,
  aiClassifierEnabled,
  setAiClassifierEnabled,
  aiRewriteEnabled,
  setAiRewriteEnabled,
  showAiProviderMigration,
  legacyAiRewriteConfigured,
  legacyAiClassifierConfigured,
  aiProviderMigrating,
  handleMigrateAiProvider,
  saving,
}: AiSectionProps) {
  const t = useTranslations("admin");

  const aiProviderItems = [
    {
      key: "ai_provider_base_url",
      labelKey: "settings.fields.ai_provider_base_url.label",
      placeholder: "https://api.openai.com/v1",
      descriptionKey: "settings.fields.ai_provider_base_url.description",
    },
    {
      key: "ai_provider_api_key",
      labelKey: "settings.fields.ai_provider_api_key.label",
      placeholder: "sk-...",
      secret: true,
      descriptionKey: "settings.fields.ai_provider_api_key.description",
    },
  ];

  const aiClassifierItems = [
    {
      key: "ai_classifier_model",
      labelKey: "settings.fields.ai_classifier_model.label",
      placeholder: "gpt-4o-mini",
      descriptionKey: "settings.fields.ai_classifier_model.description",
    },
    {
      key: "ai_classifier_default_prompt",
      labelKey: "settings.fields.ai_classifier_default_prompt.label",
      type: "textarea" as const,
      placeholder: DEFAULT_AI_CLASSIFIER_PROMPT,
      descriptionKey: "settings.fields.ai_classifier_default_prompt.description",
    },
  ];

  const aiRewriteItems = [
    {
      key: "ai_rewrite_model",
      labelKey: "settings.fields.ai_rewrite_model.label",
      placeholder: "gpt-4o-mini",
      descriptionKey: "settings.fields.ai_rewrite_model.description",
    },
    {
      key: "ai_rewrite_default_prompt",
      labelKey: "settings.fields.ai_rewrite_default_prompt.label",
      type: "textarea" as const,
      placeholder: DEFAULT_AI_REWRITE_PROMPT,
      descriptionKey: "settings.fields.ai_rewrite_default_prompt.description",
    },
  ];

  return (
    <div className="space-y-6">
      {/* AI Provider */}
      <SettingSection
        icon={Settings}
        title={t("settings.ai.provider.cardTitle")}
        description={t("settings.ai.provider.subtitle")}
      >
        {showAiProviderMigration && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-xs text-blue-900 space-y-2">
                <p className="font-medium">{t("settings.ai.provider.migrate.title")}</p>
                <p>{t("settings.ai.provider.migrate.help")}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {legacyAiRewriteConfigured && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleMigrateAiProvider("rewrite")}
                      disabled={aiProviderMigrating || saving}
                    >
                      {t("settings.ai.provider.migrate.fromRewrite")}
                    </Button>
                  )}
                  {legacyAiClassifierConfigured && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleMigrateAiProvider("classifier")}
                      disabled={aiProviderMigrating || saving}
                    >
                      {t("settings.ai.provider.migrate.fromClassifier")}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {aiProviderItems.map((item) => (
          <div key={item.key} className="space-y-2">
            <Label>{t(item.labelKey)}</Label>
            {item.descriptionKey && (
              <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
            )}
            <Input
              placeholder={
                item.secret && maskedValues[item.key] && !values[item.key]
                  ? t("settings.common.secretConfigured")
                  : item.placeholder
              }
              value={values[item.key] || ""}
              type={item.secret ? "password" : "text"}
              onChange={(e) => setValue(item.key, e.target.value)}
            />
          </div>
        ))}

        <Separator />

        <div className="space-y-2">
          <div>
            <Label>{t("settings.fields.ai_provider_models.label")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.fields.ai_provider_models.description")}</p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("settings.ai.provider.models.placeholder")}
              value={aiProviderModelDraft}
              onChange={(e) => setAiProviderModelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAiProviderModel();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addAiProviderModel}
              disabled={!aiProviderModelDraft.trim()}
            >
              {t("settings.ai.provider.models.add")}
            </Button>
          </div>

          {aiProviderModels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {aiProviderModels.map((model) => (
                <span
                  key={model}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                >
                  <code className="font-mono">{model}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => removeAiProviderModel(model)}
                    title={t("settings.ai.provider.models.remove")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("settings.ai.provider.models.empty")}</p>
          )}
        </div>
      </SettingSection>

      {/* AI Classifier */}
      <SettingSection
        icon={Settings}
        title={t("settings.ai.classifier.cardTitle")}
        description={t("settings.ai.classifier.subtitle")}
      >
        <SettingRow
          type="switch"
          label={t("settings.ai.classifier.enable.label")}
          description={t("settings.ai.classifier.enable.help")}
          checked={aiClassifierEnabled}
          onCheckedChange={setAiClassifierEnabled}
        />

        <Separator />

        {aiClassifierItems.map((item) => {
          const rawValue = values[item.key] || "";
          const trimmedValue = rawValue.trim();
          const isModel = item.key === "ai_classifier_model";
          const canUseSelect =
            isModel && aiProviderModels.length > 0 && (!trimmedValue || aiProviderModels.includes(trimmedValue));

          return (
            <div key={item.key} className="space-y-2">
              <Label>{t(item.labelKey)}</Label>
              {item.descriptionKey && <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>}
              {item.type === "textarea" ? (
                <Textarea
                  placeholder={item.placeholder}
                  value={rawValue}
                  onChange={(e) => setValue(item.key, e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              ) : canUseSelect ? (
                <Select value={trimmedValue || undefined} onValueChange={(v) => setValue(item.key, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={item.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {aiProviderModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={item.placeholder}
                  value={rawValue}
                  type="text"
                  onChange={(e) => setValue(item.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-medium">{t("settings.ai.templateVariables.title")}</p>
              <p>{t("settings.ai.templateVariables.help")}</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>
                  <code>{"{{categories}}"}</code> - {t("settings.ai.classifier.templateVariables.categories")}
                </li>
                <li>
                  <code>{"{{email.subject}}"}</code> - {t("settings.ai.classifier.templateVariables.emailSubject")}
                </li>
                <li>
                  <code>{"{{email.fromAddress}}"}</code> - {t("settings.ai.classifier.templateVariables.fromAddress")}
                </li>
                <li>
                  <code>{"{{email.fromName}}"}</code> - {t("settings.ai.classifier.templateVariables.fromName")}
                </li>
                <li>
                  <code>{"{{email.textBody}}"}</code> - {t("settings.ai.classifier.templateVariables.textBody")}
                </li>
                <li>
                  <code>{"{{email.htmlBody}}"}</code> - {t("settings.ai.classifier.templateVariables.htmlBody")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SettingSection>

      {/* AI Rewrite */}
      <SettingSection
        icon={Settings}
        title={t("settings.ai.rewrite.cardTitle")}
        description={t("settings.ai.rewrite.subtitle")}
      >
        <SettingRow
          type="switch"
          label={t("settings.ai.rewrite.enable.label")}
          description={t("settings.ai.rewrite.enable.help")}
          checked={aiRewriteEnabled}
          onCheckedChange={setAiRewriteEnabled}
        />

        <Separator />

        {aiRewriteItems.map((item) => {
          const rawValue = values[item.key] || "";
          const trimmedValue = rawValue.trim();
          const isModel = item.key === "ai_rewrite_model";
          const canUseSelect =
            isModel && aiProviderModels.length > 0 && (!trimmedValue || aiProviderModels.includes(trimmedValue));

          return (
            <div key={item.key} className="space-y-2">
              <Label>{t(item.labelKey)}</Label>
              {item.descriptionKey && <p className="text-xs text-muted-foreground">{t(item.descriptionKey)}</p>}
              {item.type === "textarea" ? (
                <Textarea
                  placeholder={item.placeholder}
                  value={rawValue}
                  onChange={(e) => setValue(item.key, e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              ) : canUseSelect ? (
                <Select value={trimmedValue || undefined} onValueChange={(v) => setValue(item.key, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={item.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {aiProviderModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={item.placeholder}
                  value={rawValue}
                  type="text"
                  onChange={(e) => setValue(item.key, e.target.value)}
                />
              )}
            </div>
          );
        })}

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <p className="font-medium">{t("settings.ai.templateVariables.title")}</p>
              <p>{t("settings.ai.templateVariables.help")}</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>
                  <code>{"{{email.subject}}"}</code> - {t("settings.ai.rewrite.templateVariables.emailSubject")}
                </li>
                <li>
                  <code>{"{{email.textBody}}"}</code> - {t("settings.ai.rewrite.templateVariables.textBody")}
                </li>
                <li>
                  <code>{"{{email.htmlBody}}"}</code> - {t("settings.ai.rewrite.templateVariables.htmlBody")}
                </li>
                <li>
                  <code>{"{{variablesJson}}"}</code> - {t("settings.ai.rewrite.templateVariables.variablesJson")}
                </li>
                <li>
                  <code>{"{{instruction}}"}</code> - {t("settings.ai.rewrite.templateVariables.instruction")}
                </li>
                <li>
                  <code>{"{{variables.anyKey}}"}</code> - {t("settings.ai.rewrite.templateVariables.variablesAnyKey")}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
