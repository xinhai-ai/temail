"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UseSmtpTestReturn = {
  smtpTestTo: string;
  setSmtpTestTo: (value: string) => void;
  smtpTestSubject: string;
  setSmtpTestSubject: (value: string) => void;
  testing: boolean;
  handleSmtpTest: () => Promise<void>;
};

export function useSmtpTest(): UseSmtpTestReturn {
  const t = useTranslations("admin");
  const [smtpTestTo, setSmtpTestTo] = useState("");
  const [smtpTestSubject, setSmtpTestSubject] = useState("TEmail SMTP Test");
  const [testing, setTesting] = useState(false);

  const handleSmtpTest = useCallback(async () => {
    const to = smtpTestTo.trim();
    if (!to) {
      toast.error(t("settings.smtp.test.toRequired"));
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: smtpTestSubject.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        messageId?: string;
        error?: string;
      } | null;

      if (!res.ok) {
        toast.error(data?.error || t("settings.smtp.test.failed"));
        return;
      }

      toast.success(t("settings.smtp.test.success"));
    } catch {
      toast.error(t("settings.smtp.test.failed"));
    } finally {
      setTesting(false);
    }
  }, [smtpTestTo, smtpTestSubject, t]);

  return {
    smtpTestTo,
    setSmtpTestTo,
    smtpTestSubject,
    setSmtpTestSubject,
    testing,
    handleSmtpTest,
  };
}
