"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";

type PasskeyInfo = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  deviceType: string | null;
  backedUp: boolean | null;
};

type UsePasskeysReturn = {
  passkeysAvailable: boolean;
  passkeysLoading: boolean;
  passkeysWorking: boolean;
  passkeys: PasskeyInfo[];
  handleAddPasskey: () => Promise<void>;
  handleRemovePasskey: (id: string) => Promise<void>;
};

export function usePasskeys(): UsePasskeysReturn {
  const t = useTranslations("settings");
  const tAuthErrors = useTranslations("auth.errors");
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeysWorking, setPasskeysWorking] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);

  const fetchPasskeys = useCallback(async () => {
    setPasskeysLoading(true);
    const res = await fetch("/api/users/me/passkeys");
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setPasskeysAvailable(Boolean(data?.available));
      setPasskeys(Array.isArray(data?.passkeys) ? (data.passkeys as PasskeyInfo[]) : []);
    }
    setPasskeysLoading(false);
  }, []);

  useEffect(() => {
    fetchPasskeys().catch(() => setPasskeysLoading(false));
  }, [fetchPasskeys]);

  const handleAddPasskey = useCallback(async () => {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      toast.error(tAuthErrors("passkeyNotSupported"));
      return;
    }
    if (!passkeysAvailable) {
      toast.error(t("passkeys.disabledByAdmin"));
      return;
    }

    setPasskeysWorking(true);
    try {
      const beginRes = await fetch("/api/users/me/passkeys/registration/begin", { method: "POST" });
      const beginData = (await beginRes.json().catch(() => null)) as
        | { options?: unknown; challengeId?: string; error?: string }
        | null;
      if (!beginRes.ok) {
        toast.error(beginData?.error || t("toast.passkeyBeginFailed"));
        return;
      }

      const options = beginData?.options;
      const challengeId = beginData?.challengeId;
      if (!options || !challengeId) {
        toast.error(t("toast.passkeyBeginFailed"));
        return;
      }

      const response = await startRegistration(options as PublicKeyCredentialCreationOptionsJSON);

      const finishRes = await fetch("/api/users/me/passkeys/registration/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response }),
      });
      const finishData = (await finishRes.json().catch(() => null)) as { error?: string } | null;
      if (!finishRes.ok) {
        toast.error(finishData?.error || t("toast.passkeyRegisterFailed"));
        return;
      }

      toast.success(t("toast.passkeyAdded"));
      await fetchPasskeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("cancel")) {
        return;
      }
      toast.error(t("toast.passkeyRegisterFailed"));
    } finally {
      setPasskeysWorking(false);
    }
  }, [passkeysAvailable, fetchPasskeys, t, tAuthErrors]);

  const handleRemovePasskey = useCallback(
    async (id: string) => {
      setPasskeysWorking(true);
      try {
        const res = await fetch(`/api/users/me/passkeys/${id}`, { method: "DELETE" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(data?.error || t("toast.passkeyRemoveFailed"));
          return;
        }
        toast.success(t("toast.passkeyRemoved"));
        await fetchPasskeys();
      } catch {
        toast.error(t("toast.passkeyRemoveFailed"));
      } finally {
        setPasskeysWorking(false);
      }
    },
    [fetchPasskeys, t]
  );

  return {
    passkeysAvailable,
    passkeysLoading,
    passkeysWorking,
    passkeys,
    handleAddPasskey,
    handleRemovePasskey,
  };
}
