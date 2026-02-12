"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type ConnectPersonalImapDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => Promise<void> | void;
};

const DEFAULT_PORT = "993";

export function ConnectPersonalImapDialog({
  open,
  onOpenChange,
  onConnected,
}: ConnectPersonalImapDialogProps) {
  const t = useTranslations("inbox");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [username, setUsername] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(DEFAULT_PORT);
  const [secure, setSecure] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0 && !submitting;
  }, [email, password, submitting]);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setLabel("");
    setShowAdvanced(false);
    setUsername("");
    setHost("");
    setPort(DEFAULT_PORT);
    setSecure(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error(t("toast.personalImap.required"));
      return;
    }

    const parsedPort = Number.parseInt(port.trim(), 10);
    if (showAdvanced && host.trim() && (!Number.isFinite(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
      toast.error(t("toast.personalImap.invalidPort"));
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email: email.trim(),
        password,
        label: label.trim() || undefined,
      };

      if (showAdvanced) {
        payload.username = username.trim() || undefined;
        payload.host = host.trim() || undefined;
        payload.port = Number.isFinite(parsedPort) ? parsedPort : undefined;
        payload.secure = secure;
      }

      const res = await fetch("/api/personal-imap/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.personalImap.connectFailed"));
        return;
      }

      toast.success(t("toast.personalImap.connected"));
      onOpenChange(false);
      resetForm();
      await onConnected();
    } catch {
      toast.error(t("toast.personalImap.connectFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submitting) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("mailboxes.connectDialog.title")}</DialogTitle>
          <DialogDescription>{t("mailboxes.connectDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="personal-imap-email">{t("mailboxes.connectDialog.email")}</Label>
            <Input
              id="personal-imap-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal-imap-password">{t("mailboxes.connectDialog.password")}</Label>
            <Input
              id="personal-imap-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("mailboxes.connectDialog.passwordPlaceholder")}
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="personal-imap-label">{t("mailboxes.connectDialog.label")}</Label>
            <Input
              id="personal-imap-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("mailboxes.connectDialog.labelPlaceholder")}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">{t("mailboxes.connectDialog.advanced")}</div>
              <div className="text-xs text-muted-foreground">{t("mailboxes.connectDialog.advancedHelp")}</div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
              {showAdvanced ? t("mailboxes.connectDialog.hideAdvanced") : t("mailboxes.connectDialog.showAdvanced")}
            </Button>
          </div>

          {showAdvanced ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-2">
                <Label htmlFor="personal-imap-username">{t("mailboxes.connectDialog.username")}</Label>
                <Input
                  id="personal-imap-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t("mailboxes.connectDialog.usernamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personal-imap-host">{t("mailboxes.connectDialog.host")}</Label>
                <Input
                  id="personal-imap-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="imap.example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="personal-imap-port">{t("mailboxes.connectDialog.port")}</Label>
                  <Input
                    id="personal-imap-port"
                    inputMode="numeric"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <Checkbox checked={secure} onCheckedChange={(checked) => setSecure(Boolean(checked))} />
                    {t("mailboxes.connectDialog.secure")}
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("cancel")}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? t("mailboxes.connectDialog.connecting") : t("mailboxes.connectDialog.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
