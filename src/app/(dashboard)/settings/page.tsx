"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { User, Lock, Key, Trash2, Info, Smartphone, Palette } from "lucide-react";
import { SettingsLayout, type SettingsNavItem } from "@/components/settings/SettingsLayout";
import { useProfile } from "./_hooks/useProfile";
import { usePassword } from "./_hooks/usePassword";
import { useOtp } from "./_hooks/useOtp";
import { usePasskeys } from "./_hooks/usePasskeys";
import { useApiKeys } from "./_hooks/useApiKeys";
import { useTrash } from "./_hooks/useTrash";
import { useRetention } from "./_hooks/useRetention";
import { useStorageUsage } from "./_hooks/useStorageUsage";
import { AccountSection } from "./_components/sections/AccountSection";
import { SecuritySection } from "./_components/sections/SecuritySection";
import { ApiSection } from "./_components/sections/ApiSection";
import { DataSection } from "./_components/sections/DataSection";
import { AboutSection } from "./_components/sections/AboutSection";
import { PwaSection } from "./_components/sections/PwaSection";
import { AppearanceSection } from "./_components/sections/AppearanceSection";

export default function SettingsPage() {
  const t = useTranslations("settings");

  // Navigation state
  const [activeSection, setActiveSection] = useState("account");

  // Hooks
  const profile = useProfile();
  const password = usePassword();
  const otp = useOtp();
  const passkeys = usePasskeys();
  const apiKeys = useApiKeys();
  const trash = useTrash();
  const retention = useRetention();
  const storageUsage = useStorageUsage();

  // Navigation items
  const navItems = useMemo<SettingsNavItem[]>(
    () => [
      { id: "account", label: t("tabs.account"), icon: User },
      { id: "security", label: t("tabs.security"), icon: Lock },
      { id: "api", label: t("tabs.api"), icon: Key },
      { id: "data", label: t("tabs.data"), icon: Trash2 },
      { id: "appearance", label: t("tabs.appearance"), icon: Palette },
      { id: "pwa", label: t("tabs.pwa"), icon: Smartphone },
      { id: "about", label: t("tabs.about"), icon: Info },
    ],
    [t]
  );

  return (
    <SettingsLayout
      title={t("title")}
      subtitle={t("description")}
      navItems={navItems}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      <div className="max-w-2xl">
        {activeSection === "account" && <AccountSection profile={profile} />}

        {activeSection === "security" && <SecuritySection password={password} otp={otp} passkeys={passkeys} />}

        {activeSection === "api" && <ApiSection apiKeys={apiKeys} />}

        {activeSection === "data" && <DataSection trash={trash} retention={retention} storageUsage={storageUsage} />}

        {activeSection === "appearance" && <AppearanceSection />}

        {activeSection === "pwa" && <PwaSection />}

        {activeSection === "about" && <AboutSection />}
      </div>
    </SettingsLayout>
  );
}
