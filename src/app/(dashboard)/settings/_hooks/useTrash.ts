"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UseTrashReturn = {
  trashRetentionDays: string;
  setTrashRetentionDays: (days: string) => void;
  trashDirty: boolean;
  loadingTrash: boolean;
  savingTrash: boolean;
  handleSaveTrash: () => Promise<void>;
};

export function useTrash(): UseTrashReturn {
  const t = useTranslations("settings");
  const [trashRetentionDays, setTrashRetentionDays] = useState("30");
  const [trashOriginalDays, setTrashOriginalDays] = useState("30");
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [savingTrash, setSavingTrash] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/users/me/trash");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const value = String(data?.trashRetentionDays ?? 30);
        setTrashRetentionDays(value);
        setTrashOriginalDays(value);
      }
      setLoadingTrash(false);
    };
    load().catch(() => setLoadingTrash(false));
  }, []);

  const handleSaveTrash = useCallback(async () => {
    const parsed = Number.parseInt(trashRetentionDays, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error(t("toast.trashRetentionInvalid"));
      return;
    }
    if (parsed > 3650) {
      toast.error(t("toast.trashRetentionTooLarge"));
      return;
    }

    setSavingTrash(true);
    try {
      const res = await fetch("/api/users/me/trash", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trashRetentionDays: parsed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.saveFailed"));
        return;
      }
      toast.success(t("toast.trashSaved"));
      const value = String(data?.trashRetentionDays ?? parsed);
      setTrashRetentionDays(value);
      setTrashOriginalDays(value);
    } catch {
      toast.error(t("toast.saveFailed"));
    } finally {
      setSavingTrash(false);
    }
  }, [trashRetentionDays, t]);

  const trashDirty = trashRetentionDays.trim() !== trashOriginalDays.trim();

  return {
    trashRetentionDays,
    setTrashRetentionDays,
    trashDirty,
    loadingTrash,
    savingTrash,
    handleSaveTrash,
  };
}
