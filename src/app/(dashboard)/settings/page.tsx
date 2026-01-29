"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { User, Lock, Trash2, Info, Key, Plus } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";
import { useTranslations } from "next-intl";
import { DEFAULT_OPEN_API_KEY_SCOPES, OPEN_API_SCOPES } from "@/lib/open-api/scopes";

export default function SettingsPage() {
  type PasskeyInfo = {
    id: string;
    createdAt: string;
    lastUsedAt: string | null;
    deviceType: string | null;
    backedUp: boolean | null;
  };

  const { data: session } = useSession();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tAuthErrors = useTranslations("auth.errors");
  const [name, setName] = useState(session?.user?.name || "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [profileOriginalName, setProfileOriginalName] = useState(session?.user?.name || "");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [emailChangeNewEmail, setEmailChangeNewEmail] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);

  const [tab, setTab] = useState<"account" | "security" | "api" | "data" | "about">("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [trashRetentionDays, setTrashRetentionDays] = useState("30");
  const [trashOriginalDays, setTrashOriginalDays] = useState("30");
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [savingTrash, setSavingTrash] = useState(false);

  const [otpAvailable, setOtpAvailable] = useState(false);
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpLoading, setOtpLoading] = useState(true);
  const [otpWorking, setOtpWorking] = useState(false);
  const [otpSetup, setOtpSetup] = useState<{ secret: string; otpauthUrl: string; qrDataUrl: string | null } | null>(
    null
  );
  const [otpConfirmCode, setOtpConfirmCode] = useState("");
  const [otpBackupCodes, setOtpBackupCodes] = useState<string[] | null>(null);
  const [otpDisablePassword, setOtpDisablePassword] = useState("");

  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [passkeysWorking, setPasskeysWorking] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);

  type ApiKeyInfo = {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    usageCount: number;
    lastUsedAt: string | null;
    disabledAt: string | null;
    createdAt: string;
    updatedAt: string;
  };

  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [apiKeysWorkingId, setApiKeysWorkingId] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [showCreateApiKeyDialog, setShowCreateApiKeyDialog] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [apiKeyScopes, setApiKeyScopes] = useState<string[]>(DEFAULT_OPEN_API_KEY_SCOPES);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
  const [editingApiKey, setEditingApiKey] = useState<ApiKeyInfo | null>(null);
  const [editingApiKeyScopes, setEditingApiKeyScopes] = useState<string[]>([]);

  type AppInfoResponse = {
    version: string;
    commitSha: string | null;
    commitShortSha: string | null;
    repository: { owner: string; name: string; url: string };
  };

  const [appInfo, setAppInfo] = useState<AppInfoResponse | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setAppInfoLoading(true);
      const res = await fetch("/api/app-info");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setAppInfo(data as AppInfoResponse);
      }
      setAppInfoLoading(false);
    };
    load().catch(() => setAppInfoLoading(false));
  }, []);

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

  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    const res = await fetch("/api/open-api/keys");
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setApiKeys(Array.isArray(data?.keys) ? (data.keys as ApiKeyInfo[]) : []);
    } else {
      toast.error(data?.error || t("toast.saveFailed"));
    }
    setApiKeysLoading(false);
  }, [t]);

  useEffect(() => {
    fetchApiKeys().catch(() => setApiKeysLoading(false));
  }, [fetchApiKeys]);

  const setApiKeyScopeChecked = useCallback((scope: string, checked: boolean) => {
    setApiKeyScopes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return Array.from(next).sort();
    });
  }, []);

  const handleCreateApiKey = async () => {
    if (apiKeyScopes.length === 0) {
      toast.error(t("toast.selectAtLeastOneScope"));
      return;
    }

    setCreatingApiKey(true);
    try {
      const body: { name?: string; scopes: string[] } = { scopes: apiKeyScopes };
      const trimmedName = apiKeyName.trim();
      if (trimmedName) body.name = trimmedName;

      const res = await fetch("/api/open-api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.apiKeyCreateFailed"));
        return;
      }

      setCreatedApiToken(typeof data?.token === "string" ? data.token : null);
      toast.success(t("toast.apiKeyCreated"));
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyCreateFailed"));
    } finally {
      setCreatingApiKey(false);
    }
  };

  const handleCopyApiToken = async () => {
    if (!createdApiToken) return;
    try {
      await navigator.clipboard.writeText(createdApiToken);
      toast.success(t("toast.apiKeyCopied"));
    } catch {
      toast.error(t("toast.saveFailed"));
    }
  };

  const handleSetApiKeyDisabled = async (keyId: string, disabled: boolean) => {
    setApiKeysWorkingId(keyId);
    try {
      const res = await fetch(`/api/open-api/keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.apiKeyUpdateFailed"));
        return;
      }
      toast.success(t("toast.apiKeyUpdated"));
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyUpdateFailed"));
    } finally {
      setApiKeysWorkingId(null);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm(t("apiKeys.confirmDelete"))) return;

    setApiKeysWorkingId(keyId);
    try {
      const res = await fetch(`/api/open-api/keys/${keyId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.apiKeyDeleteFailed"));
        return;
      }
      toast.success(t("toast.apiKeyDeleted"));
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyDeleteFailed"));
    } finally {
      setApiKeysWorkingId(null);
    }
  };

  const handleStartEditApiKeyScopes = (key: ApiKeyInfo) => {
    setEditingApiKey(key);
    setEditingApiKeyScopes([...key.scopes]);
  };

  const handleCancelEditApiKeyScopes = () => {
    setEditingApiKey(null);
    setEditingApiKeyScopes([]);
  };

  const setEditingApiKeyScopeChecked = useCallback((scope: string, checked: boolean) => {
    setEditingApiKeyScopes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(scope);
      else next.delete(scope);
      return Array.from(next).sort();
    });
  }, []);

  const handleSaveApiKeyScopes = async () => {
    if (!editingApiKey) return;
    if (editingApiKeyScopes.length === 0) {
      toast.error(t("toast.selectAtLeastOneScope"));
      return;
    }

    setApiKeysWorkingId(editingApiKey.id);
    try {
      const res = await fetch(`/api/open-api/keys/${editingApiKey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes: editingApiKeyScopes }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.apiKeyUpdateFailed"));
        return;
      }
      toast.success(t("toast.apiKeyUpdated"));
      setEditingApiKey(null);
      setEditingApiKeyScopes([]);
      fetchApiKeys().catch(() => null);
    } catch {
      toast.error(t("toast.apiKeyUpdateFailed"));
    } finally {
      setApiKeysWorkingId(null);
    }
  };

  const handleOpenCreateDialog = () => {
    setApiKeyName("");
    setApiKeyScopes([...DEFAULT_OPEN_API_KEY_SCOPES]);
    setCreatedApiToken(null);
    setShowCreateApiKeyDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setShowCreateApiKeyDialog(false);
    setCreatedApiToken(null);
    setApiKeyName("");
    setApiKeyScopes([...DEFAULT_OPEN_API_KEY_SCOPES]);
  };

  const handleUpdateProfile = async () => {
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
  };

  const handleResetProfile = () => {
    setName(profileOriginalName);
  };

  const handleRequestEmailChange = async () => {
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
  };

  const handleChangePassword = async () => {
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
  };

  const handleSaveTrash = async () => {
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
  };

  const handleOtpSetup = async () => {
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
  };

  const handleOtpConfirm = async () => {
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
  };

  const handleOtpDisable = async () => {
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
  };

  const handleAddPasskey = async () => {
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
  };

  const handleRemovePasskey = async (id: string) => {
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
  };

  const profileDirty = name.trim() !== profileOriginalName;
  const trashDirty = trashRetentionDays.trim() !== trashOriginalDays.trim();
  const passwordMismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);
  const passwordTooShort = Boolean(newPassword && newPassword.length > 0 && newPassword.length < 6);
  const canChangePassword =
    Boolean(currentPassword.trim() && newPassword && confirmPassword) && !passwordMismatch && !passwordTooShort && !changingPassword;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {appInfoLoading ? "v…" : `v${appInfo?.version || t("unknown")}`}
          </Badge>
          {otpLoading ? (
            <Badge variant="outline">{t("badges.otp.loading")}</Badge>
          ) : !otpAvailable ? (
            <Badge variant="secondary">{t("badges.otp.unavailable")}</Badge>
          ) : otpEnabled ? (
            <Badge>{t("badges.otp.enabled")}</Badge>
          ) : (
            <Badge variant="outline">{t("badges.otp.disabled")}</Badge>
          )}
          {passkeysLoading ? (
            <Badge variant="outline">{t("badges.passkeys.loading")}</Badge>
          ) : !passkeysAvailable ? (
            <Badge variant="secondary">{t("badges.passkeys.disabled")}</Badge>
          ) : (
            <Badge variant="outline">{t("badges.passkeys.count", { count: passkeys.length })}</Badge>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="account">{t("tabs.account")}</TabsTrigger>
          <TabsTrigger value="security">{t("tabs.security")}</TabsTrigger>
          <TabsTrigger value="api">{t("tabs.api")}</TabsTrigger>
          <TabsTrigger value="data">{t("tabs.data")}</TabsTrigger>
          <TabsTrigger value="about">{t("tabs.about")}</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("profile.title")}
                </CardTitle>
                <CardDescription>{t("profile.description")}</CardDescription>
                {profileDirty && (
                  <CardAction>
                    <Badge variant="outline">{t("profile.unsaved")}</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("profile.email.label")}</Label>
                  <Input value={profileEmail || session?.user?.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    {t("profile.email.help")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEmailChangeOpen(true)}
                      disabled={profileLoading || profileSaving}
                    >
                      {t("profile.email.change")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("profile.name.label")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("profile.name.placeholder")}
                    disabled={profileLoading || profileSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("profile.name.help")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUpdateProfile} disabled={!profileDirty || profileLoading || profileSaving}>
                    {profileSaving ? t("profile.actions.saving") : t("profile.actions.save")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetProfile}
                    disabled={!profileDirty || profileLoading || profileSaving}
                  >
                    {t("profile.actions.reset")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t("password.title")}
                </CardTitle>
                <CardDescription>{t("password.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("password.current")}</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={changingPassword}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("password.new")}</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={changingPassword}
                    />
                    {passwordTooShort && (
                      <p className="text-xs text-destructive">{tAuthErrors("passwordTooShort")}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("password.confirm")}</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={changingPassword}
                    />
                    {passwordMismatch && (
                      <p className="text-xs text-destructive">{tAuthErrors("passwordsDoNotMatch")}</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={!canChangePassword}>
                  {changingPassword ? t("password.actions.changing") : t("password.actions.change")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t("otp.title")}
                </CardTitle>
                <CardDescription>{t("otp.description")}</CardDescription>
                {otpLoading ? (
                  <CardAction>
                    <Badge variant="outline">{t("otp.status.loading")}</Badge>
                  </CardAction>
                ) : !otpAvailable ? (
                  <CardAction>
                    <Badge variant="secondary">{t("otp.status.disabledByAdmin")}</Badge>
                  </CardAction>
                ) : otpEnabled ? (
                  <CardAction>
                    <Badge>{t("otp.status.enabled")}</Badge>
                  </CardAction>
                ) : (
                  <CardAction>
                    <Badge variant="outline">{t("otp.status.notEnabled")}</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {otpLoading ? (
                  <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
                ) : !otpAvailable ? (
                  <p className="text-sm text-muted-foreground">{t("otp.content.disabledByAdmin")}</p>
                ) : otpEnabled ? (
                  <>
                    <p className="text-sm text-muted-foreground">{t("otp.content.enabled")}</p>
                    <div className="space-y-2">
                      <Label>{t("otp.content.disableLabel")}</Label>
                      <Input
                        type="password"
                        placeholder={t("otp.content.disablePlaceholder")}
                        value={otpDisablePassword}
                        onChange={(e) => setOtpDisablePassword(e.target.value)}
                        disabled={otpWorking}
                      />
                      <Button variant="destructive" onClick={handleOtpDisable} disabled={otpWorking}>
                        {otpWorking ? t("otp.content.disabling") : t("otp.content.disable")}
                      </Button>
                    </div>
                  </>
                ) : otpSetup ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("otp.content.setupHelp")}
                    </p>
                    {otpSetup.qrDataUrl ? (
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={otpSetup.qrDataUrl} alt={t("otp.content.qrAlt")} className="rounded-md border" />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("otp.content.qrFailed")}</p>
                    )}
                    <div className="space-y-2">
                      <Label>{t("otp.content.secret")}</Label>
                      <Input value={otpSetup.secret} readOnly className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("otp.content.confirmCode")}</Label>
                      <Input
                        inputMode="numeric"
                        placeholder={t("otp.content.codePlaceholder")}
                        value={otpConfirmCode}
                        onChange={(e) => setOtpConfirmCode(e.target.value)}
                        disabled={otpWorking}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleOtpConfirm} disabled={otpWorking}>
                          {otpWorking ? t("otp.content.enabling") : t("otp.content.enable")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setOtpSetup(null);
                            setOtpConfirmCode("");
                          }}
                          disabled={otpWorking}
                        >
                          {tCommon("cancel")}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("otp.content.setupDescription")}
                    </p>
                    <Button onClick={handleOtpSetup} disabled={otpWorking}>
                      {otpWorking ? t("otp.content.settingUp") : t("otp.content.setup")}
                    </Button>
                  </>
                )}

                {otpBackupCodes && otpBackupCodes.length > 0 && (
                  <>
                    <Separator />
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">{t("otp.backupCodes.title")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("otp.backupCodes.help")}
                      </p>
                      <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap">
                        {otpBackupCodes.join("\n")}
                      </pre>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t("passkeys.title")}
                </CardTitle>
                <CardDescription>{t("passkeys.description")}</CardDescription>
                {passkeysLoading ? (
                  <CardAction>
                    <Badge variant="outline">{t("passkeys.status.loading")}</Badge>
                  </CardAction>
                ) : !passkeysAvailable ? (
                  <CardAction>
                    <Badge variant="secondary">{t("passkeys.status.disabled")}</Badge>
                  </CardAction>
                ) : (
                  <CardAction>
                    <Badge variant="outline">{passkeys.length}</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {passkeysLoading ? (
                  <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
                ) : (
                  <>
                    {!passkeysAvailable && (
                      <p className="text-sm text-muted-foreground">{t("passkeys.disabledByAdmin")}</p>
                    )}
                    <Button onClick={handleAddPasskey} disabled={passkeysWorking || !passkeysAvailable}>
                      {passkeysWorking ? t("passkeys.actions.working") : t("passkeys.actions.add")}
                    </Button>
                    {passkeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("passkeys.empty")}</p>
                    ) : (
                      <div className="space-y-2">
                        {passkeys.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {p.deviceType
                                  ? t("passkeys.device", { deviceType: p.deviceType })
                                  : t("passkeys.passkey")}
                                {p.backedUp ? ` · ${t("passkeys.synced")}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t("passkeys.meta.added", { date: new Date(p.createdAt).toLocaleString() })}
                                {p.lastUsedAt
                                  ? ` · ${t("passkeys.meta.lastUsed", { date: new Date(p.lastUsedAt).toLocaleString() })}`
                                  : ""}
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              onClick={() => handleRemovePasskey(p.id)}
                              disabled={passkeysWorking}
                            >
                              {t("passkeys.actions.remove")}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  {t("apiKeys.title")}
                </CardTitle>
                <CardDescription>{t("apiKeys.description")}</CardDescription>
                <CardAction>
                  <Button size="sm" onClick={handleOpenCreateDialog}>
                    <Plus className="h-4 w-4 mr-1" />
                    {t("apiKeys.create.create")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiKeysLoading ? (
                  <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
                ) : apiKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("apiKeys.list.empty")}</p>
                ) : (
                  <div className="space-y-4">
                    {apiKeys.map((key, idx) => (
                      <div key={key.id} className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{key.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t("apiKeys.list.prefix")}: <span className="font-mono">{key.keyPrefix}</span>
                            </p>
                          </div>
                          {key.disabledAt ? (
                            <Badge variant="secondary">{t("apiKeys.list.status.disabled")}</Badge>
                          ) : (
                            <Badge>{t("apiKeys.list.status.active")}</Badge>
                          )}
                        </div>

                        {key.scopes.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {key.scopes.map((scope) => (
                              <Badge key={scope} variant="outline" className="font-mono text-xs">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                          {t("apiKeys.list.usage")}: {key.usageCount} · {t("apiKeys.list.lastUsed")}:{" "}
                          {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "—"}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleStartEditApiKeyScopes(key)}
                            disabled={apiKeysWorkingId === key.id}
                          >
                            {t("apiKeys.list.actions.editScopes")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetApiKeyDisabled(key.id, !key.disabledAt)}
                            disabled={apiKeysWorkingId === key.id}
                          >
                            {key.disabledAt ? t("apiKeys.list.actions.enable") : t("apiKeys.list.actions.disable")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteApiKey(key.id)}
                            disabled={apiKeysWorkingId === key.id}
                          >
                            {t("apiKeys.list.actions.delete")}
                          </Button>
                        </div>

                        {idx < apiKeys.length - 1 && <Separator />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={showCreateApiKeyDialog} onOpenChange={setShowCreateApiKeyDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("apiKeys.create.title")}</DialogTitle>
                <DialogDescription>{t("apiKeys.description")}</DialogDescription>
              </DialogHeader>
              {createdApiToken ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("apiKeys.token.title")}</Label>
                    <Input value={createdApiToken} readOnly className="font-mono text-sm" />
                    <p className="text-xs text-muted-foreground">{t("apiKeys.token.help")}</p>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCopyApiToken}>
                      {t("apiKeys.token.copy")}
                    </Button>
                    <Button type="button" onClick={handleCloseCreateDialog}>
                      {tCommon("done")}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("apiKeys.create.name")}</Label>
                    <Input
                      value={apiKeyName}
                      onChange={(e) => setApiKeyName(e.target.value)}
                      placeholder="My integration key"
                      disabled={creatingApiKey}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("apiKeys.create.scopes")}</Label>
                    <div className="grid gap-2 max-h-64 overflow-y-auto">
                      {OPEN_API_SCOPES.map((scope) => (
                        <label key={scope} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={apiKeyScopes.includes(scope)}
                            onCheckedChange={(checked) => setApiKeyScopeChecked(scope, checked === true)}
                            disabled={creatingApiKey}
                          />
                          <span className="font-mono text-xs">{scope}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleCloseCreateDialog} disabled={creatingApiKey}>
                      {tCommon("cancel")}
                    </Button>
                    <Button onClick={handleCreateApiKey} disabled={creatingApiKey || apiKeyScopes.length === 0}>
                      {creatingApiKey ? t("apiKeys.create.creating") : t("apiKeys.create.create")}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={editingApiKey !== null} onOpenChange={(open) => !open && handleCancelEditApiKeyScopes()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("apiKeys.edit.title")}</DialogTitle>
                <DialogDescription>
                  {editingApiKey?.name} ({editingApiKey?.keyPrefix})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("apiKeys.edit.scopes")}</Label>
                  <div className="grid gap-2 max-h-64 overflow-y-auto">
                    {OPEN_API_SCOPES.map((scope) => (
                      <label key={scope} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={editingApiKeyScopes.includes(scope)}
                          onCheckedChange={(checked) => setEditingApiKeyScopeChecked(scope, checked === true)}
                          disabled={apiKeysWorkingId === editingApiKey?.id}
                        />
                        <span className="font-mono text-xs">{scope}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelEditApiKeyScopes}
                    disabled={apiKeysWorkingId === editingApiKey?.id}
                  >
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    onClick={handleSaveApiKeyScopes}
                    disabled={apiKeysWorkingId === editingApiKey?.id || editingApiKeyScopes.length === 0}
                  >
                    {apiKeysWorkingId === editingApiKey?.id ? t("apiKeys.edit.saving") : t("apiKeys.edit.save")}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="data">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  {t("trash.title")}
                </CardTitle>
                <CardDescription>{t("trash.description")}</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-mono">
                    {loadingTrash ? "…" : `${trashRetentionDays || "0"}d`}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("trash.retentionLabel")}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={trashRetentionDays}
                    onChange={(e) => setTrashRetentionDays(e.target.value)}
                    disabled={loadingTrash || savingTrash}
                  />
                  <p className="text-xs text-muted-foreground">{t("trash.retentionHelp")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("0")}
                    disabled={loadingTrash || savingTrash}
                  >
                    {t("trash.presets.never")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("30")}
                    disabled={loadingTrash || savingTrash}
                  >
                    {t("trash.presets.days30")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("90")}
                    disabled={loadingTrash || savingTrash}
                  >
                    {t("trash.presets.days90")}
                  </Button>
                </div>
                <Button onClick={handleSaveTrash} disabled={loadingTrash || savingTrash || !trashDirty}>
                  {savingTrash ? t("trash.actions.saving") : t("trash.actions.save")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="about">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  {t("about.title")}
                </CardTitle>
                <CardDescription>{t("about.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("about.labels.version")}</span>
                  <Badge variant="secondary" className="font-mono">
                    {appInfoLoading ? "…" : appInfo?.version || t("unknown")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("about.labels.commit")}</span>
                  <Badge variant="outline" className="font-mono" title={appInfo?.commitSha || ""}>
                    {appInfoLoading ? "…" : appInfo?.commitShortSha || appInfo?.commitSha || t("unknown")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("about.labels.github")}</span>
                  <a
                    className="underline underline-offset-4 hover:text-foreground"
                    href={appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {appInfo?.repository.owner && appInfo?.repository.name
                      ? `${appInfo.repository.owner}/${appInfo.repository.name}`
                      : "xinhai-ai/temail"}
                  </a>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-3">
                  <a
                    className="underline underline-offset-4 hover:text-foreground"
                    href={`${appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}/releases`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("about.links.releases")}
                  </a>
                  <a
                    className="underline underline-offset-4 hover:text-foreground"
                    href={`${appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}/issues`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("about.links.issues")}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={emailChangeOpen} onOpenChange={setEmailChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.email.dialog.title")}</DialogTitle>
            <DialogDescription>{t("profile.email.dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="email-change-new-email">{t("profile.email.dialog.newEmail.label")}</Label>
            <Input
              id="email-change-new-email"
              type="email"
              placeholder={t("profile.email.dialog.newEmail.placeholder")}
              value={emailChangeNewEmail}
              onChange={(e) => setEmailChangeNewEmail(e.target.value)}
              disabled={emailChangeLoading}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmailChangeOpen(false)}
              disabled={emailChangeLoading}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="button" onClick={handleRequestEmailChange} disabled={emailChangeLoading}>
              {emailChangeLoading ? t("profile.email.dialog.sending") : t("profile.email.dialog.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
