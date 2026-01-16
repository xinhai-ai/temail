"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [smtpSecure, setSmtpSecure] = useState(false);

  const setValue = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const items = useMemo(
    () => [
      { key: "site_name", label: "Site Name", placeholder: "TEmail" },
      { key: "site_url", label: "Site URL", placeholder: "http://localhost:3000" },
      { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.example.com" },
      { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
      { key: "smtp_user", label: "SMTP User", placeholder: "user@example.com" },
      { key: "smtp_pass", label: "SMTP Password", placeholder: "••••••••", secret: true },
      { key: "smtp_from", label: "SMTP From", placeholder: "TEmail <no-reply@example.com>" },
    ],
    []
  );

  const fetchSettings = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      toast.error(data?.error || "Failed to load settings");
      setLoading(false);
      return;
    }

    const map: Record<string, string> = {};
    for (const row of data as { key: string; value: string }[]) {
      map[row.key] = row.value;
    }

    setValues(map);
    setSmtpSecure(map.smtp_secure === "true");
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = [
        ...items.map((item) => ({
          key: item.key,
          value: values[item.key] || "",
        })),
        { key: "smtp_secure", value: smtpSecure ? "true" : "false" },
      ].filter((x) => x.value !== "");

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Settings saved");
        await fetchSettings();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save settings");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">Configure system settings</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.slice(0, 2).map((item) => (
              <div key={item.key} className="space-y-2">
                <Label>{item.label}</Label>
                <Input
                  placeholder={item.placeholder}
                  value={values[item.key] || ""}
                  onChange={(e) => setValue(item.key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              SMTP Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>SMTP Secure</Label>
                <p className="text-sm text-muted-foreground">
                  Use SSL/TLS (or set port 465)
                </p>
              </div>
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
            </div>

            {items.slice(2).map((item) => (
              <div key={item.key} className="space-y-2">
                <Label>{item.label}</Label>
                <Input
                  placeholder={item.placeholder}
                  value={values[item.key] || ""}
                  type={item.secret ? "password" : "text"}
                  onChange={(e) => setValue(item.key, e.target.value)}
                />
              </div>
            ))}

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Note: these settings are stored in the database.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
