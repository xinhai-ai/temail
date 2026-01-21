"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [trashRetentionDays, setTrashRetentionDays] = useState("30");
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
      const res = await fetch("/api/users/me/trash");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTrashRetentionDays(String(data?.trashRetentionDays ?? 30));
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
    toast.success("Profile updated");
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
      setTrashRetentionDays(String(data?.trashRetentionDays ?? parsed));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Trash
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Automatically delete trash after (days)</Label>
              <Input
                type="number"
                min={0}
                max={3650}
                value={trashRetentionDays}
                onChange={(e) => setTrashRetentionDays(e.target.value)}
                disabled={loadingTrash || savingTrash}
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to never automatically delete.
              </p>
            </div>
            <Button onClick={handleSaveTrash} disabled={loadingTrash || savingTrash}>
              {savingTrash ? "Saving..." : "Save Trash Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={session?.user?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button onClick={handleUpdateProfile}>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? "Changing..." : "Change Password"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Two-Factor Authentication (OTP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {otpLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !otpAvailable ? (
              <p className="text-sm text-muted-foreground">
                OTP is disabled by the administrator.
              </p>
            ) : otpEnabled ? (
              <>
                <p className="text-sm text-muted-foreground">
                  OTP is enabled for your account.
                </p>
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
                  <p className="text-xs text-muted-foreground">
                    QR code generation failed. Use the secret below.
                  </p>
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
                  <div className="flex gap-2">
                    <Button onClick={handleOtpConfirm} disabled={otpWorking}>
                      {otpWorking ? "Enabling..." : "Enable OTP"}
                    </Button>
                    <Button
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
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Backup codes</p>
                <p className="text-xs text-muted-foreground">
                  Save these codes in a safe place. They will only be shown once.
                </p>
                <pre className="text-xs bg-muted/50 p-2 rounded font-mono whitespace-pre-wrap">
                  {otpBackupCodes.join("\n")}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Passkeys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {passkeysLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                {!passkeysAvailable && (
                  <p className="text-sm text-muted-foreground">
                    Passkeys are disabled by the administrator.
                  </p>
                )}
                <Button onClick={handleAddPasskey} disabled={passkeysWorking || !passkeysAvailable}>
                  {passkeysWorking ? "Working..." : "Add passkey"}
                </Button>
                {passkeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No passkeys added yet.
                  </p>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              About
            </CardTitle>
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
              <Badge variant="outline" className="font-mono">
                {appInfoLoading ? "…" : appInfo?.commitShortSha || "unknown"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
