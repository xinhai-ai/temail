"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type SmtpSectionProps = {
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  smtpSecure: boolean;
  setSmtpSecure: (value: boolean) => void;
  smtpTestTo: string;
  setSmtpTestTo: (value: string) => void;
  smtpTestSubject: string;
  setSmtpTestSubject: (value: string) => void;
  smtpTesting: boolean;
  handleSmtpTest: () => Promise<void>;
};

export function SmtpSection({
  values,
  setValue,
  smtpSecure,
  setSmtpSecure,
  smtpTestTo,
  setSmtpTestTo,
  smtpTestSubject,
  setSmtpTestSubject,
  smtpTesting,
  handleSmtpTest,
}: SmtpSectionProps) {
  const t = useTranslations("admin");

  const smtpItems = [
    { key: "smtp_host", labelKey: "settings.fields.smtp_host.label", placeholder: "smtp.example.com" },
    { key: "smtp_port", labelKey: "settings.fields.smtp_port.label", placeholder: "587" },
    { key: "smtp_user", labelKey: "settings.fields.smtp_user.label", placeholder: "user@example.com" },
    { key: "smtp_pass", labelKey: "settings.fields.smtp_pass.label", placeholder: "••••••••", secret: true },
    { key: "smtp_from", labelKey: "settings.fields.smtp_from.label", placeholder: "TEmail <no-reply@example.com>" },
  ];

  return (
    <SettingSection icon={Settings} title={t("settings.smtp.cardTitle")}>
      <SettingRow
        type="switch"
        label={t("settings.smtp.secure.label")}
        description={t("settings.smtp.secure.help")}
        checked={smtpSecure}
        onCheckedChange={setSmtpSecure}
      />

      {smtpItems.map((item) => (
        <div key={item.key} className="space-y-2">
          <Label>{t(item.labelKey)}</Label>
          <Input
            placeholder={item.placeholder}
            value={values[item.key] || ""}
            type={item.secret ? "password" : "text"}
            onChange={(e) => setValue(item.key, e.target.value)}
          />
        </div>
      ))}

      <Separator />

      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">{t("settings.smtp.test.title")}</Label>
          <p className="text-xs text-muted-foreground mt-1">{t("settings.smtp.test.help")}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("settings.smtp.test.toLabel")}</Label>
            <Input
              placeholder="recipient@example.com"
              value={smtpTestTo}
              onChange={(e) => setSmtpTestTo(e.target.value)}
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.smtp.test.subjectLabel")}</Label>
            <Input
              placeholder="TEmail SMTP Test"
              value={smtpTestSubject}
              onChange={(e) => setSmtpTestSubject(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={handleSmtpTest} disabled={smtpTesting}>
          {smtpTesting ? t("settings.smtp.test.sending") : t("settings.smtp.test.send")}
        </Button>
      </div>
    </SettingSection>
  );
}
