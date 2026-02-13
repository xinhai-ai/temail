"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UseMailContentStorageReturn = {
  storeRawAndAttachments: boolean;
  setStoreRawAndAttachments: (value: boolean) => void;
  loadingMailContentStorage: boolean;
  savingMailContentStorage: boolean;
  mailContentStorageDirty: boolean;
  handleSaveMailContentStorage: () => Promise<void>;
};

export function useMailContentStorage(): UseMailContentStorageReturn {
  const t = useTranslations("settings");
  const [storeRawAndAttachments, setStoreRawAndAttachments] = useState(true);
  const [originalStoreRawAndAttachments, setOriginalStoreRawAndAttachments] = useState(true);
  const [loadingMailContentStorage, setLoadingMailContentStorage] = useState(true);
  const [savingMailContentStorage, setSavingMailContentStorage] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/users/me");
      const data = await res.json().catch(() => null);
      const enabled = typeof data?.storeRawAndAttachments === "boolean" ? data.storeRawAndAttachments : true;
      setStoreRawAndAttachments(enabled);
      setOriginalStoreRawAndAttachments(enabled);
      setLoadingMailContentStorage(false);
    };

    load().catch(() => setLoadingMailContentStorage(false));
  }, []);

  const handleSaveMailContentStorage = useCallback(async () => {
    setSavingMailContentStorage(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeRawAndAttachments }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.saveFailed"));
        return;
      }

      const enabled = typeof data?.storeRawAndAttachments === "boolean" ? data.storeRawAndAttachments : storeRawAndAttachments;
      setStoreRawAndAttachments(enabled);
      setOriginalStoreRawAndAttachments(enabled);
      toast.success(t("toast.mailContentStorageSaved"));
    } catch {
      toast.error(t("toast.saveFailed"));
    } finally {
      setSavingMailContentStorage(false);
    }
  }, [storeRawAndAttachments, t]);

  const mailContentStorageDirty = useMemo(
    () => storeRawAndAttachments !== originalStoreRawAndAttachments,
    [originalStoreRawAndAttachments, storeRawAndAttachments]
  );

  return {
    storeRawAndAttachments,
    setStoreRawAndAttachments,
    loadingMailContentStorage,
    savingMailContentStorage,
    mailContentStorageDirty,
    handleSaveMailContentStorage,
  };
}
