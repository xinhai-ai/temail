"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UsePasswordReturn = {
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  changingPassword: boolean;
  passwordMismatch: boolean;
  passwordTooShort: boolean;
  canChangePassword: boolean;
  handleChangePassword: () => Promise<void>;
};

export function usePassword(): UsePasswordReturn {
  const t = useTranslations("settings");
  const tAuthErrors = useTranslations("auth.errors");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const passwordMismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);
  const passwordTooShort = Boolean(newPassword && newPassword.length > 0 && newPassword.length < 6);
  const canChangePassword =
    Boolean(currentPassword.trim() && newPassword && confirmPassword) &&
    !passwordMismatch &&
    !passwordTooShort &&
    !changingPassword;

  const handleChangePassword = useCallback(async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t("toast.fillAllFields"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(tAuthErrors("passwordsDoNotMatch"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(tAuthErrors("passwordTooShort"));
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.passwordChangeFailed"));
        return;
      }

      toast.success(t("toast.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error(t("toast.passwordChangeFailed"));
    } finally {
      setChangingPassword(false);
    }
  }, [currentPassword, newPassword, confirmPassword, t, tAuthErrors]);

  return {
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changingPassword,
    passwordMismatch,
    passwordTooShort,
    canChangePassword,
    handleChangePassword,
  };
}
