"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [trashRetentionDays, setTrashRetentionDays] = useState("30");
  const [loadingTrash, setLoadingTrash] = useState(true);
  const [savingTrash, setSavingTrash] = useState(false);

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
      </div>
    </div>
  );
}
