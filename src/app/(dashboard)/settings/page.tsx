"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types";

export default function SettingsPage() {
  type PasskeyInfo = {
    id: string;
    createdAt: string;
    lastUsedAt: string | null;
    deviceType: string | null;
    backedUp: boolean | null;
  };

  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [profileEmail, setProfileEmail] = useState(session?.user?.email || "");
  const [profileOriginalName, setProfileOriginalName] = useState(session?.user?.name || "");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);

  const [tab, setTab] = useState<"account" | "security" | "data" | "about">("account");
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

  const handleUpdateProfile = async () => {
    const nextName = name.trim();
    if (nextName.length > 80) {
      toast.error("Name is too long");
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
        toast.error(data?.error || "Failed to save profile");
        return;
      }

      const savedName = typeof data?.name === "string" ? data.name : "";
      setName(savedName);
      setProfileOriginalName(savedName);
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleResetProfile = () => {
    setName(profileOriginalName);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
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
        toast.error(data?.error || "Failed to change password");
        return;
      }

      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveTrash = async () => {
    const parsed = Number.parseInt(trashRetentionDays, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Trash retention days must be 0 or a positive number");
      return;
    }
    if (parsed > 3650) {
      toast.error("Trash retention days is too large");
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
        toast.error(data?.error || "Failed to save");
        return;
      }
      toast.success("Trash settings saved");
      const value = String(data?.trashRetentionDays ?? parsed);
      setTrashRetentionDays(value);
      setTrashOriginalDays(value);
    } catch {
      toast.error("Failed to save");
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
        toast.error(data?.error || "Failed to set up OTP");
        return;
      }

      const secret = String(data?.secret || "");
      const otpauthUrl = String(data?.otpauthUrl || "");
      if (!secret || !otpauthUrl) {
        toast.error("Failed to set up OTP");
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
      toast.success("OTP setup created. Please confirm with a code.");
    } catch {
      toast.error("Failed to set up OTP");
    } finally {
      setOtpWorking(false);
    }
  };

  const handleOtpConfirm = async () => {
    if (!otpConfirmCode.trim()) {
      toast.error("Please enter a code");
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
        toast.error(data?.error || "Failed to enable OTP");
        return;
      }

      const codes = Array.isArray(data?.backupCodes) ? (data.backupCodes as string[]) : [];
      setOtpBackupCodes(codes.length ? codes : null);
      setOtpEnabled(true);
      setOtpSetup(null);
      setOtpConfirmCode("");
      toast.success("OTP enabled");
    } catch {
      toast.error("Failed to enable OTP");
    } finally {
      setOtpWorking(false);
    }
  };

  const handleOtpDisable = async () => {
    if (!otpDisablePassword.trim()) {
      toast.error("Please enter your current password");
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
        toast.error(data?.error || "Failed to disable OTP");
        return;
      }

      setOtpEnabled(false);
      setOtpSetup(null);
      setOtpBackupCodes(null);
      setOtpDisablePassword("");
      toast.success("OTP disabled");
    } catch {
      toast.error("Failed to disable OTP");
    } finally {
      setOtpWorking(false);
    }
  };

  const handleAddPasskey = async () => {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      toast.error("Passkeys are not supported in this browser.");
      return;
    }
    if (!passkeysAvailable) {
      toast.error("Passkeys are disabled by the administrator.");
      return;
    }

    setPasskeysWorking(true);
    try {
      const beginRes = await fetch("/api/users/me/passkeys/registration/begin", { method: "POST" });
      const beginData = (await beginRes.json().catch(() => null)) as
        | { options?: unknown; challengeId?: string; error?: string }
        | null;
      if (!beginRes.ok) {
        toast.error(beginData?.error || "Failed to start passkey registration");
        return;
      }

      const options = beginData?.options;
      const challengeId = beginData?.challengeId;
      if (!options || !challengeId) {
        toast.error("Failed to start passkey registration");
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
        toast.error(finishData?.error || "Failed to register passkey");
        return;
      }

      toast.success("Passkey added");
      await fetchPasskeys();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("abort") || message.toLowerCase().includes("cancel")) {
        return;
      }
      toast.error("Failed to register passkey");
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
        toast.error(data?.error || "Failed to remove passkey");
        return;
      }
      toast.success("Passkey removed");
      await fetchPasskeys();
    } catch {
      toast.error("Failed to remove passkey");
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
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account, security, and data.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {appInfoLoading ? "v…" : `v${appInfo?.version || "unknown"}`}
          </Badge>
          {otpLoading ? (
            <Badge variant="outline">OTP: …</Badge>
          ) : !otpAvailable ? (
            <Badge variant="secondary">OTP: Unavailable</Badge>
          ) : otpEnabled ? (
            <Badge>OTP: Enabled</Badge>
          ) : (
            <Badge variant="outline">OTP: Disabled</Badge>
          )}
          {passkeysLoading ? (
            <Badge variant="outline">Passkeys: …</Badge>
          ) : !passkeysAvailable ? (
            <Badge variant="secondary">Passkeys: Disabled</Badge>
          ) : (
            <Badge variant="outline">{`Passkeys: ${passkeys.length}`}</Badge>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
                <CardDescription>Update your display name.</CardDescription>
                {profileDirty && (
                  <CardAction>
                    <Badge variant="outline">Unsaved</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profileEmail || session?.user?.email || ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email is used for login and can&apos;t be changed here.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    disabled={profileLoading || profileSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Shown in the UI and activity logs.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleUpdateProfile} disabled={!profileDirty || profileLoading || profileSaving}>
                    {profileSaving ? "Saving..." : "Save profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetProfile}
                    disabled={!profileDirty || profileLoading || profileSaving}
                  >
                    Reset
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
                  Password
                </CardTitle>
                <CardDescription>Change the password used for login.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Current password</Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={changingPassword}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>New password</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={changingPassword}
                    />
                    {passwordTooShort && (
                      <p className="text-xs text-destructive">Password must be at least 6 characters.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm new password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={changingPassword}
                    />
                    {passwordMismatch && (
                      <p className="text-xs text-destructive">Passwords do not match.</p>
                    )}
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={!canChangePassword}>
                  {changingPassword ? "Changing..." : "Change password"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Two-Factor Authentication (OTP)
                </CardTitle>
                <CardDescription>Use one-time codes from an authenticator app.</CardDescription>
                {otpLoading ? (
                  <CardAction>
                    <Badge variant="outline">Loading</Badge>
                  </CardAction>
                ) : !otpAvailable ? (
                  <CardAction>
                    <Badge variant="secondary">Disabled by admin</Badge>
                  </CardAction>
                ) : otpEnabled ? (
                  <CardAction>
                    <Badge>Enabled</Badge>
                  </CardAction>
                ) : (
                  <CardAction>
                    <Badge variant="outline">Not enabled</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {otpLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : !otpAvailable ? (
                  <p className="text-sm text-muted-foreground">OTP is disabled by the administrator.</p>
                ) : otpEnabled ? (
                  <>
                    <p className="text-sm text-muted-foreground">OTP is enabled for your account.</p>
                    <div className="space-y-2">
                      <Label>Disable OTP</Label>
                      <Input
                        type="password"
                        placeholder="Enter your current password"
                        value={otpDisablePassword}
                        onChange={(e) => setOtpDisablePassword(e.target.value)}
                        disabled={otpWorking}
                      />
                      <Button variant="destructive" onClick={handleOtpDisable} disabled={otpWorking}>
                        {otpWorking ? "Disabling..." : "Disable OTP"}
                      </Button>
                    </div>
                  </>
                ) : otpSetup ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Scan the QR code with an authenticator app, or enter the secret manually, then confirm with a code.
                    </p>
                    {otpSetup.qrDataUrl ? (
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={otpSetup.qrDataUrl} alt="OTP QR Code" className="rounded-md border" />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">QR code generation failed. Use the secret below.</p>
                    )}
                    <div className="space-y-2">
                      <Label>Secret</Label>
                      <Input value={otpSetup.secret} readOnly className="font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm code</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="123456"
                        value={otpConfirmCode}
                        onChange={(e) => setOtpConfirmCode(e.target.value)}
                        disabled={otpWorking}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={handleOtpConfirm} disabled={otpWorking}>
                          {otpWorking ? "Enabling..." : "Enable OTP"}
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
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account with one-time codes.
                    </p>
                    <Button onClick={handleOtpSetup} disabled={otpWorking}>
                      {otpWorking ? "Setting up..." : "Set up OTP"}
                    </Button>
                  </>
                )}

                {otpBackupCodes && otpBackupCodes.length > 0 && (
                  <>
                    <Separator />
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">Backup codes</p>
                      <p className="text-xs text-muted-foreground">
                        Save these codes in a safe place. They will only be shown once.
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
                  Passkeys
                </CardTitle>
                <CardDescription>Use passkeys for faster, phishing-resistant sign-in.</CardDescription>
                {passkeysLoading ? (
                  <CardAction>
                    <Badge variant="outline">Loading</Badge>
                  </CardAction>
                ) : !passkeysAvailable ? (
                  <CardAction>
                    <Badge variant="secondary">Disabled</Badge>
                  </CardAction>
                ) : (
                  <CardAction>
                    <Badge variant="outline">{passkeys.length}</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {passkeysLoading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <>
                    {!passkeysAvailable && (
                      <p className="text-sm text-muted-foreground">Passkeys are disabled by the administrator.</p>
                    )}
                    <Button onClick={handleAddPasskey} disabled={passkeysWorking || !passkeysAvailable}>
                      {passkeysWorking ? "Working..." : "Add passkey"}
                    </Button>
                    {passkeys.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No passkeys added yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {passkeys.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-4 rounded-md border p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {p.deviceType ? `Device: ${p.deviceType}` : "Passkey"}
                                {p.backedUp ? " · Synced" : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Added: {new Date(p.createdAt).toLocaleString()}
                                {p.lastUsedAt ? ` · Last used: ${new Date(p.lastUsedAt).toLocaleString()}` : ""}
                              </p>
                            </div>
                            <Button
                              variant="destructive"
                              onClick={() => handleRemovePasskey(p.id)}
                              disabled={passkeysWorking}
                            >
                              Remove
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

        <TabsContent value="data">
          <div className="grid gap-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Trash
                </CardTitle>
                <CardDescription>Automatically purge trash after a set number of days.</CardDescription>
                <CardAction>
                  <Badge variant="outline" className="font-mono">
                    {loadingTrash ? "…" : `${trashRetentionDays || "0"}d`}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Trash retention (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={3650}
                    value={trashRetentionDays}
                    onChange={(e) => setTrashRetentionDays(e.target.value)}
                    disabled={loadingTrash || savingTrash}
                  />
                  <p className="text-xs text-muted-foreground">Set to 0 to never automatically delete.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("0")}
                    disabled={loadingTrash || savingTrash}
                  >
                    Never
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("30")}
                    disabled={loadingTrash || savingTrash}
                  >
                    30 days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTrashRetentionDays("90")}
                    disabled={loadingTrash || savingTrash}
                  >
                    90 days
                  </Button>
                </div>
                <Button onClick={handleSaveTrash} disabled={loadingTrash || savingTrash || !trashDirty}>
                  {savingTrash ? "Saving..." : "Save trash settings"}
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
                  About
                </CardTitle>
                <CardDescription>Version information and project links.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Version</span>
                  <Badge variant="secondary" className="font-mono">
                    {appInfoLoading ? "…" : appInfo?.version || "unknown"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Commit</span>
                  <Badge variant="outline" className="font-mono" title={appInfo?.commitSha || ""}>
                    {appInfoLoading ? "…" : appInfo?.commitShortSha || appInfo?.commitSha || "unknown"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">GitHub</span>
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
                    Releases
                  </a>
                  <a
                    className="underline underline-offset-4 hover:text-foreground"
                    href={`${appInfo?.repository.url || "https://github.com/xinhai-ai/temail"}/issues`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Issues
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
