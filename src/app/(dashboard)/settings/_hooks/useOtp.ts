"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";

type OtpSetup = { secret: string; otpauthUrl: string; qrDataUrl: string | null };

type UseOtpReturn = {
  otpAvailable: boolean;
  otpEnabled: boolean;
  otpLoading: boolean;
  otpWorking: boolean;
  otpSetup: OtpSetup | null;
  otpConfirmCode: string;
  setOtpConfirmCode: (code: string) => void;
  otpBackupCodes: string[] | null;
  otpDisablePassword: string;
  setOtpDisablePassword: (password: string) => void;
  handleOtpSetup: () => Promise<void>;
  handleOtpConfirm: () => Promise<void>;
  handleOtpDisable: () => Promise<void>;
  cancelOtpSetup: () => void;
};

export function useOtp(): UseOtpReturn {
  const t = useTranslations("settings");
  const [otpAvailable, setOtpAvailable] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpLoading, setOtpLoading] = useState(true);
  const [otpWorking, setOtpWorking] = useState(false);
  const [otpSetup, setOtpSetup] = useState<OtpSetup | null>(null);
  const [otpConfirmCode, setOtpConfirmCode] = useState("");
  const [otpBackupCodes, setOtpBackupCodes] = useState<string[] | null>(null);
  const [otpDisablePassword, setOtpDisablePassword] = useState("");

  useEffect(() => {
    const load = async () => {
      setOtpLoading(true);
      const res = await fetch("/api/users/me/otp");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setOtpAvailable(Boolean(data?.available));
        setOtpEnabled(Boolean(data?.enabled));
      }
      setOtpLoading(false);
    };
    load().catch(() => setOtpLoading(false));
  }, []);

  const handleOtpSetup = useCallback(async () => {
    setOtpWorking(true);
    setOtpBackupCodes(null);
    try {
      const res = await fetch("/api/users/me/otp/setup", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.otpSetupFailed"));
        return;
      }

      const secret = String(data?.secret || "");
      const otpauthUrl = String(data?.otpauthUrl || "");
      if (!secret || !otpauthUrl) {
        toast.error(t("toast.otpSetupFailed"));
        return;
      }

      let qrDataUrl: string | null = null;
      try {
        qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 200 });
      } catch {
        qrDataUrl = null;
      }

      setOtpSetup({ secret, otpauthUrl, qrDataUrl });
      setOtpConfirmCode("");
      toast.success(t("toast.otpSetupCreated"));
    } catch {
      toast.error(t("toast.otpSetupFailed"));
    } finally {
      setOtpWorking(false);
    }
  }, [t]);

  const handleOtpConfirm = useCallback(async () => {
    if (!otpConfirmCode.trim()) {
      toast.error(t("toast.otpCodeRequired"));
      return;
    }

    setOtpWorking(true);
    try {
      const res = await fetch("/api/users/me/otp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpConfirmCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.otpEnableFailed"));
        return;
      }

      const codes = Array.isArray(data?.backupCodes) ? (data.backupCodes as string[]) : [];
      setOtpBackupCodes(codes.length ? codes : null);
      setOtpEnabled(true);
      setOtpSetup(null);
      setOtpConfirmCode("");
      toast.success(t("toast.otpEnabled"));
    } catch {
      toast.error(t("toast.otpEnableFailed"));
    } finally {
      setOtpWorking(false);
    }
  }, [otpConfirmCode, t]);

  const handleOtpDisable = useCallback(async () => {
    if (!otpDisablePassword.trim()) {
      toast.error(t("toast.otpPasswordRequired"));
      return;
    }

    setOtpWorking(true);
    try {
      const res = await fetch("/api/users/me/otp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: otpDisablePassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.otpDisableFailed"));
        return;
      }

      setOtpEnabled(false);
      setOtpSetup(null);
      setOtpBackupCodes(null);
      setOtpDisablePassword("");
      toast.success(t("toast.otpDisabled"));
    } catch {
      toast.error(t("toast.otpDisableFailed"));
    } finally {
      setOtpWorking(false);
    }
  }, [otpDisablePassword, t]);

  const cancelOtpSetup = useCallback(() => {
    setOtpSetup(null);
    setOtpConfirmCode("");
  }, []);

  return {
    otpAvailable,
    otpEnabled,
    otpLoading,
    otpWorking,
    otpSetup,
    otpConfirmCode,
    setOtpConfirmCode,
    otpBackupCodes,
    otpDisablePassword,
    setOtpDisablePassword,
    handleOtpSetup,
    handleOtpConfirm,
    handleOtpDisable,
    cancelOtpSetup,
  };
}
