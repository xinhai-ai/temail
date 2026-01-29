"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegistrationSectionProps = {
  registrationMode: "open" | "invite" | "closed";
  setRegistrationMode: (mode: "open" | "invite" | "closed") => void;
  registrationInviteCodes: string;
  setRegistrationInviteCodes: (codes: string) => void;
};

export function RegistrationSection({
  registrationMode,
  setRegistrationMode,
  registrationInviteCodes,
  setRegistrationInviteCodes,
}: RegistrationSectionProps) {
  const t = useTranslations("admin");

  return (
    <SettingSection icon={Settings} title={t("settings.registration.cardTitle")}>
      <div className="space-y-2">
        <Label>{t("settings.registration.mode.label")}</Label>
        <p className="text-sm text-muted-foreground">{t("settings.registration.mode.help")}</p>
        <Select
          value={registrationMode}
          onValueChange={(v) => setRegistrationMode(v as "open" | "invite" | "closed")}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("settings.registration.mode.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">{t("settings.registration.mode.options.open")}</SelectItem>
            <SelectItem value="invite">{t("settings.registration.mode.options.invite")}</SelectItem>
            <SelectItem value="closed">{t("settings.registration.mode.options.closed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("settings.registration.inviteCodes.label")}</Label>
        <p className="text-sm text-muted-foreground">{t("settings.registration.inviteCodes.help")}</p>
        <Textarea
          placeholder={t("settings.registration.inviteCodes.placeholder")}
          value={registrationInviteCodes}
          onChange={(e) => setRegistrationInviteCodes(e.target.value)}
          rows={4}
          className="font-mono text-sm"
          disabled={registrationMode !== "invite"}
        />
        {registrationMode === "invite" && !registrationInviteCodes.trim() && (
          <p className="text-xs text-destructive">{t("settings.registration.inviteCodes.warning")}</p>
        )}
      </div>
    </SettingSection>
  );
}
