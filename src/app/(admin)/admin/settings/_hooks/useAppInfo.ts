"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type AppInfoResponse = {
  version: string;
  commitSha: string | null;
  commitShortSha: string | null;
  repository: { owner: string; name: string; url: string };
};

type UpdateCheckResponse = {
  ok: boolean;
  checkedAt: string;
  current: AppInfoResponse;
  latest: { tag: string; version: string | null; url: string; publishedAt: string | null } | null;
  hasUpdate: boolean | null;
  error?: string;
};

type UseAppInfoReturn = {
  appInfo: AppInfoResponse | null;
  appInfoLoading: boolean;
  updateCheck: UpdateCheckResponse | null;
  checkingUpdate: boolean;
  handleCheckUpdates: () => Promise<void>;
};

export function useAppInfo(): UseAppInfoReturn {
  const t = useTranslations("admin");
  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResponse | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    const load = async () => {
      setAppInfoLoading(true);
      try {
        const res = await fetch("/api/app-info");
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setAppInfo(data as AppInfoResponse);
        }
      } catch {
        // Ignore
      } finally {
        setAppInfoLoading(false);
      }
    };
    load();
  }, []);

  const handleCheckUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch("/api/admin/app-update");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("settings.toasts.checkUpdatesFailed"));
        return;
      }

      const payload = data as UpdateCheckResponse;
      setUpdateCheck(payload);

      if (!payload.ok) {
        toast.error(payload.error || t("settings.toasts.checkUpdatesFailed"));
        return;
      }

      if (payload.hasUpdate === true) {
        toast.info(t("settings.toasts.updateAvailable"));
        return;
      }

      if (payload.hasUpdate === false) {
        toast.success(t("settings.toasts.upToDate"));
        return;
      }

      toast.message(t("settings.toasts.checkCompleted"));
    } catch {
      toast.error(t("settings.toasts.checkUpdatesFailed"));
    } finally {
      setCheckingUpdate(false);
    }
  }, [t]);

  return {
    appInfo,
    appInfoLoading,
    updateCheck,
    checkingUpdate,
    handleCheckUpdates,
  };
}
