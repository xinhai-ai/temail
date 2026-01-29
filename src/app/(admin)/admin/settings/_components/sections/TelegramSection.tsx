"use client";

import { useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import { SettingSection } from "@/components/settings/SettingSection";
import { SettingRow } from "@/components/settings/SettingRow";

type TelegramSectionProps = {
  telegramBotEnabled: boolean;
  setTelegramBotEnabled: (value: boolean) => void;
};

export function TelegramSection({ telegramBotEnabled, setTelegramBotEnabled }: TelegramSectionProps) {
  const t = useTranslations("admin");

  return (
    <SettingSection
      icon={Settings}
      title={t("settings.telegramBot.cardTitle")}
      description={t("settings.telegramBot.subtitle")}
    >
      <SettingRow
        type="switch"
        label={t("settings.telegramBot.enable.label")}
        description={t("settings.telegramBot.enable.help")}
        checked={telegramBotEnabled}
        onCheckedChange={setTelegramBotEnabled}
      />
    </SettingSection>
  );
}
