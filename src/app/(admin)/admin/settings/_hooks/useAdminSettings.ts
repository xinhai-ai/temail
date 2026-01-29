"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UseAdminSettingsReturn = {
  loading: boolean;
  saving: boolean;
  saved: boolean;
  values: Record<string, string>;
  maskedValues: Record<string, boolean>;
  getValue: (key: string) => string;
  setValue: (key: string, value: string) => void;
  getBool: (key: string, defaultValue?: boolean) => boolean;
  setBool: (key: string, value: boolean) => void;
  fetchSettings: () => Promise<void>;
  saveNow: () => Promise<void>;
};

export function useAdminSettings(): UseAdminSettingsReturn {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [maskedValues, setMaskedValues] = useState<Record<string, boolean>>({});
  const pendingRef = useRef<Record<string, string>>({});
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json().catch(() => []);

      if (!res.ok) {
        toast.error(data?.error || t("settings.toasts.loadFailed"));
        setLoading(false);
        return;
      }

      const map: Record<string, string> = {};
      const masked: Record<string, boolean> = {};
      for (const row of data as { key: string; value: string; masked?: boolean }[]) {
        map[row.key] = row.value;
        masked[row.key] = Boolean(row.masked);
      }

      setValues(map);
      setMaskedValues(masked);
      pendingRef.current = {};
    } catch {
      toast.error(t("settings.toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const saveSettings = useCallback(async () => {
    const pending = { ...pendingRef.current };
    if (Object.keys(pending).length === 0) return;

    setSaving(true);
    setSaved(false);
    try {
      const payload = Object.entries(pending).map(([key, value]) => ({ key, value }));

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Clear pending for saved keys
        for (const key of Object.keys(pending)) {
          delete pendingRef.current[key];
        }
        setSaved(true);
        // Hide saved indicator after 2 seconds
        setTimeout(() => setSaved(false), 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("settings.toasts.saveFailed"));
      }
    } catch {
      toast.error(t("settings.toasts.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [t]);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings();
    }, 500);
  }, [saveSettings]);

  const getValue = useCallback(
    (key: string): string => {
      return values[key] || "";
    },
    [values]
  );

  const setValue = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      pendingRef.current[key] = value;
      scheduleSave();
    },
    [scheduleSave]
  );

  const getBool = useCallback(
    (key: string, defaultValue = false): boolean => {
      const v = values[key];
      if (v === undefined || v === "") return defaultValue;
      return v === "true";
    },
    [values]
  );

  const setBool = useCallback(
    (key: string, value: boolean) => {
      const strValue = value ? "true" : "false";
      setValues((prev) => ({ ...prev, [key]: strValue }));
      pendingRef.current[key] = strValue;
      scheduleSave();
    },
    [scheduleSave]
  );

  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    await saveSettings();
  }, [saveSettings]);

  useEffect(() => {
    fetchSettings();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [fetchSettings]);

  return {
    loading,
    saving,
    saved,
    values,
    maskedValues,
    getValue,
    setValue,
    getBool,
    setBool,
    fetchSettings,
    saveNow,
  };
}
