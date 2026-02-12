"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type RetentionAction = "ARCHIVE" | "DELETE";

type UseRetentionReturn = {
  mailboxExpireDays: string;
  setMailboxExpireDays: (value: string) => void;
  mailboxExpireAction: RetentionAction;
  setMailboxExpireAction: (value: RetentionAction) => void;
  emailExpireDays: string;
  setEmailExpireDays: (value: string) => void;
  emailExpireAction: RetentionAction;
  setEmailExpireAction: (value: RetentionAction) => void;
  retentionDirty: boolean;
  loadingRetention: boolean;
  savingRetention: boolean;
  handleSaveRetention: () => Promise<void>;
};

function parseDays(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0)) {
    return Number.NaN;
  }
  if (parsed > 3650) {
    return Number.NaN;
  }
  return parsed;
}

export function useRetention(): UseRetentionReturn {
  const t = useTranslations("settings");
  const [mailboxExpireDays, setMailboxExpireDays] = useState("-1");
  const [mailboxExpireAction, setMailboxExpireAction] = useState<RetentionAction>("ARCHIVE");
  const [emailExpireDays, setEmailExpireDays] = useState("-1");
  const [emailExpireAction, setEmailExpireAction] = useState<RetentionAction>("ARCHIVE");

  const [original, setOriginal] = useState({
    mailboxExpireDays: "-1",
    mailboxExpireAction: "ARCHIVE" as RetentionAction,
    emailExpireDays: "-1",
    emailExpireAction: "ARCHIVE" as RetentionAction,
  });

  const [loadingRetention, setLoadingRetention] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/users/me/retention");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const next = {
          mailboxExpireDays: String(data?.mailboxExpireDays ?? -1),
          mailboxExpireAction: data?.mailboxExpireAction === "DELETE" ? "DELETE" : "ARCHIVE",
          emailExpireDays: String(data?.emailExpireDays ?? -1),
          emailExpireAction: data?.emailExpireAction === "DELETE" ? "DELETE" : "ARCHIVE",
        } as const;

        setMailboxExpireDays(next.mailboxExpireDays);
        setMailboxExpireAction(next.mailboxExpireAction);
        setEmailExpireDays(next.emailExpireDays);
        setEmailExpireAction(next.emailExpireAction);
        setOriginal(next);
      }
      setLoadingRetention(false);
    };

    load().catch(() => setLoadingRetention(false));
  }, []);

  const retentionDirty = useMemo(
    () =>
      mailboxExpireDays.trim() !== original.mailboxExpireDays.trim() ||
      mailboxExpireAction !== original.mailboxExpireAction ||
      emailExpireDays.trim() !== original.emailExpireDays.trim() ||
      emailExpireAction !== original.emailExpireAction,
    [
      emailExpireAction,
      emailExpireDays,
      mailboxExpireAction,
      mailboxExpireDays,
      original.emailExpireAction,
      original.emailExpireDays,
      original.mailboxExpireAction,
      original.mailboxExpireDays,
    ]
  );

  const handleSaveRetention = useCallback(async () => {
    const parsedMailboxDays = parseDays(mailboxExpireDays);
    const parsedEmailDays = parseDays(emailExpireDays);

    if (!Number.isFinite(parsedMailboxDays) || !Number.isFinite(parsedEmailDays)) {
      toast.error(t("toast.retentionInvalid"));
      return;
    }

    setSavingRetention(true);
    try {
      const res = await fetch("/api/users/me/retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxExpireDays: parsedMailboxDays,
          mailboxExpireAction,
          emailExpireDays: parsedEmailDays,
          emailExpireAction,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.saveFailed"));
        return;
      }

      const next = {
        mailboxExpireDays: String(data?.mailboxExpireDays ?? parsedMailboxDays),
        mailboxExpireAction: data?.mailboxExpireAction === "DELETE" ? "DELETE" : mailboxExpireAction,
        emailExpireDays: String(data?.emailExpireDays ?? parsedEmailDays),
        emailExpireAction: data?.emailExpireAction === "DELETE" ? "DELETE" : emailExpireAction,
      } as const;

      setMailboxExpireDays(next.mailboxExpireDays);
      setMailboxExpireAction(next.mailboxExpireAction);
      setEmailExpireDays(next.emailExpireDays);
      setEmailExpireAction(next.emailExpireAction);
      setOriginal(next);
      toast.success(t("toast.retentionSaved"));
    } catch {
      toast.error(t("toast.saveFailed"));
    } finally {
      setSavingRetention(false);
    }
  }, [emailExpireAction, emailExpireDays, mailboxExpireAction, mailboxExpireDays, t]);

  return {
    mailboxExpireDays,
    setMailboxExpireDays,
    mailboxExpireAction,
    setMailboxExpireAction,
    emailExpireDays,
    setEmailExpireDays,
    emailExpireAction,
    setEmailExpireAction,
    retentionDirty,
    loadingRetention,
    savingRetention,
    handleSaveRetention,
  };
}
