"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { SettingSection } from "@/components/settings/SettingSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const VERIFY_EMAIL_TEXT_KEY = "email_template_verify_email_text";
const VERIFY_EMAIL_HTML_KEY = "email_template_verify_email_html";
const PASSWORD_RESET_TEXT_KEY = "email_template_password_reset_text";
const PASSWORD_RESET_HTML_KEY = "email_template_password_reset_html";

type EmailTemplatesSectionProps = {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
};

export function EmailTemplatesSection({ values, setValue }: EmailTemplatesSectionProps) {
  const t = useTranslations("admin");

  const placeholders = [
    { key: "{{siteName}}", description: t("settings.emailTemplates.placeholders.siteName") },
    { key: "{{actionUrl}}", description: t("settings.emailTemplates.placeholders.actionUrl") },
  ];

  return (
    <SettingSection
      icon={FileText}
      title={t("settings.emailTemplates.cardTitle")}
      description={t("settings.emailTemplates.cardDescription")}
    >
      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">{t("settings.emailTemplates.placeholders.title")}</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {placeholders.map((item) => (
            <li key={item.key}>
              <span className="font-mono text-xs">{item.key}</span> — {item.description}
            </li>
          ))}
        </ul>
        <div className="mt-2 text-xs text-muted-foreground">{t("settings.emailTemplates.placeholders.note")}</div>
      </div>

      <Tabs defaultValue="verifyEmail">
        <TabsList>
          <TabsTrigger value="verifyEmail">{t("settings.emailTemplates.tabs.verifyEmail")}</TabsTrigger>
          <TabsTrigger value="passwordReset">{t("settings.emailTemplates.tabs.passwordReset")}</TabsTrigger>
        </TabsList>

        <TabsContent value="verifyEmail" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("settings.emailTemplates.verifyEmail.title")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.emailTemplates.help.leaveBlank")}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(VERIFY_EMAIL_TEXT_KEY, "");
                setValue(VERIFY_EMAIL_HTML_KEY, "");
              }}
            >
              {t("settings.emailTemplates.actions.useDefault")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.emailTemplates.fields.text")}</Label>
            <Textarea
              value={values[VERIFY_EMAIL_TEXT_KEY] || ""}
              onChange={(e) => setValue(VERIFY_EMAIL_TEXT_KEY, e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settings.emailTemplates.fields.html")}</Label>
            <Textarea
              value={values[VERIFY_EMAIL_HTML_KEY] || ""}
              onChange={(e) => setValue(VERIFY_EMAIL_HTML_KEY, e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>
        </TabsContent>

        <TabsContent value="passwordReset" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t("settings.emailTemplates.passwordReset.title")}</div>
              <div className="text-xs text-muted-foreground">{t("settings.emailTemplates.help.leaveBlank")}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setValue(PASSWORD_RESET_TEXT_KEY, "");
                setValue(PASSWORD_RESET_HTML_KEY, "");
              }}
            >
              {t("settings.emailTemplates.actions.useDefault")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.emailTemplates.fields.text")}</Label>
            <Textarea
              value={values[PASSWORD_RESET_TEXT_KEY] || ""}
              onChange={(e) => setValue(PASSWORD_RESET_TEXT_KEY, e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("settings.emailTemplates.fields.html")}</Label>
            <Textarea
              value={values[PASSWORD_RESET_HTML_KEY] || ""}
              onChange={(e) => setValue(PASSWORD_RESET_HTML_KEY, e.target.value)}
              rows={12}
              className="font-mono text-xs"
            />
          </div>
        </TabsContent>
      </Tabs>
    </SettingSection>
  );
}

