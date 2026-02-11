"use client";

import { useCallback, useEffect, useState } from "react";

type StorageUsagePayload = {
  usage: { bytes: number; files: number; emails: number };
  quota: { maxStorageMb: number | null; maxStorageFiles: number | null; maxStorageBytes: number | null };
  percent: { bytes: number | null; files: number | null };
};

type UseStorageUsageReturn = {
  loading: boolean;
  data: StorageUsagePayload | null;
  refresh: () => Promise<void>;
};

export function useStorageUsage(): UseStorageUsageReturn {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorageUsagePayload | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me/storage/usage");
      const payload = (await res.json().catch(() => null)) as StorageUsagePayload | null;
      if (!res.ok) {
        setData(null);
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  return { loading, data, refresh };
}

