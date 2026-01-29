"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type UseProfileReturn = {
  name: string;
  setName: (name: string) => void;
  profileEmail: string;
  profileOriginalName: string;
  profileLoading: boolean;
  profileSaving: boolean;
  profileDirty: boolean;
  emailChangeOpen: boolean;
  setEmailChangeOpen: (open: boolean) => void;
  emailChangeNewEmail: string;
  setEmailChangeNewEmail: (email: string) => void;
  emailChangeLoading: boolean;
  handleUpdateProfile: () => Promise<void>;
  handleResetProfile: () => void;
  handleRequestEmailChange: () => Promise<void>;
};

export function useProfile(): UseProfileReturn {
  const { data: session } = useSession();
  const t = useTranslations("settings");
  const [name, setName] = useState(session?.user?.name || "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [profileOriginalName, setProfileOriginalName] = useState(session?.user?.name || "");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setProfileLoading(true);
      const res = await fetch("/api/users/me");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const email = typeof data?.email === "string" ? data.email : "";
        const loadedName = typeof data?.name === "string" ? data.name : "";
        setProfileEmail(email);
        setName(loadedName);
        setProfileOriginalName(loadedName);
      } else {
        setProfileEmail(session?.user?.email || "");
        setName(session?.user?.name || "");
        setProfileOriginalName(session?.user?.name || "");
      }
      setProfileLoading(false);
    };
    load().catch(() => setProfileLoading(false));
  }, [session?.user?.email, session?.user?.name]);

  const handleUpdateProfile = useCallback(async () => {
    const nextName = name.trim();
    if (nextName.length > 80) {
      toast.error(t("toast.nameTooLong"));
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName ? nextName : null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.profileSaveFailed"));
        return;
      }

      const savedName = typeof data?.name === "string" ? data.name : "";
      setName(savedName);
      setProfileOriginalName(savedName);
      toast.success(t("toast.profileSaved"));
    } catch {
      toast.error(t("toast.profileSaveFailed"));
    } finally {
      setProfileSaving(false);
    }
  }, [name, t]);

  const handleResetProfile = useCallback(() => {
    setName(profileOriginalName);
  }, [profileOriginalName]);

  const handleRequestEmailChange = useCallback(async () => {
    const newEmail = emailChangeNewEmail.trim();
    if (!newEmail) {
      toast.error(t("toast.emailChangeEmailRequired"));
      return;
    }

    const currentEmail = (profileEmail || session?.user?.email || "").trim();
    if (currentEmail && newEmail === currentEmail) {
      toast.error(t("toast.emailChangeSameEmail"));
      return;
    }

    setEmailChangeLoading(true);
    try {
      const res = await fetch("/api/users/me/email-change/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newEmail }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfterHeader = res.headers.get("Retry-After") || "";
          const retryAfterSeconds = Number(retryAfterHeader);
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            toast.error(t("toast.rateLimitedRetry", { seconds: retryAfterSeconds }));
            return;
          }
        }
        toast.error(data?.error || t("toast.emailChangeFailed"));
        return;
      }

      toast.success(t("toast.emailChangeSent"));
      setEmailChangeNewEmail("");
      setEmailChangeOpen(false);
    } catch {
      toast.error(t("toast.emailChangeFailed"));
    } finally {
      setEmailChangeLoading(false);
    }
  }, [emailChangeNewEmail, profileEmail, session?.user?.email, t]);

  const profileDirty = name.trim() !== profileOriginalName;

  return {
    name,
    setName,
    profileEmail,
    profileOriginalName,
    profileLoading,
    profileSaving,
    profileDirty,
    emailChangeOpen,
    setEmailChangeOpen,
    emailChangeNewEmail,
    setEmailChangeNewEmail,
    emailChangeLoading,
    handleUpdateProfile,
    handleResetProfile,
    handleRequestEmailChange,
  };
}
