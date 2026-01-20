"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type TelegramLink = {
  telegramUserId: string;
  telegramUsername: string | null;
  privateChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TelegramBinding = {
  id: string;
  enabled: boolean;
  mode: "MANAGE" | "NOTIFY";
  chatId: string;
  chatType: string | null;
  chatTitle: string | null;
  threadId: string | null;
  updatedAt: string;
  mailbox: { id: string; address: string } | null;
};

type MailboxItem = { id: string; address: string };

function copyToClipboard(text: string) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed")
  );
}

export default function TelegramPage() {
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [bindings, setBindings] = useState<TelegramBinding[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxItem[]>([]);

  const [creatingLinkCode, setCreatingLinkCode] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linkDeepLink, setLinkDeepLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);

  const [creatingBindCode, setCreatingBindCode] = useState(false);
  const [bindMailboxId, setBindMailboxId] = useState<string>("all");
  const [bindMode, setBindMode] = useState<"NOTIFY" | "MANAGE">("NOTIFY");
  const [bindCode, setBindCode] = useState("");
  const [bindExpiresAt, setBindExpiresAt] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bindingsRes, mailboxesRes] = await Promise.all([fetch("/api/telegram/bindings"), fetch("/api/mailboxes")]);
      const bindingsData = await bindingsRes.json().catch(() => null);
      const mailboxesData = await mailboxesRes.json().catch(() => null);

      if (bindingsRes.ok) {
        setLink(bindingsData?.link || null);
        setBindings(Array.isArray(bindingsData?.bindings) ? (bindingsData.bindings as TelegramBinding[]) : []);
      } else {
        toast.error(bindingsData?.error || "Failed to load Telegram bindings");
      }

      if (mailboxesRes.ok) {
        const list = Array.isArray(mailboxesData) ? (mailboxesData as Array<{ id: string; address: string }>) : [];
        setMailboxes(list.map((m) => ({ id: m.id, address: m.address })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  const mailboxOptions = useMemo(() => {
    const sorted = [...mailboxes].sort((a, b) => a.address.localeCompare(b.address));
    return [{ id: "all", address: "All mailboxes" }, ...sorted.map((m) => ({ id: m.id, address: m.address }))];
  }, [mailboxes]);

  const createLinkCode = async () => {
    setCreatingLinkCode(true);
    try {
      const res = await fetch("/api/telegram/link-code", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to generate code");
        return;
      }
      setLinkCode(String(data?.code || ""));
      setLinkDeepLink(typeof data?.deepLink === "string" ? data.deepLink : null);
      setLinkExpiresAt(typeof data?.expiresAt === "string" ? data.expiresAt : null);
      toast.success("Link code generated");
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setCreatingLinkCode(false);
    }
  };

  const createChatBindCode = async () => {
    setCreatingBindCode(true);
    try {
      const body = {
        mailboxId: bindMailboxId === "all" ? null : bindMailboxId,
        mode: bindMode,
      };
      const res = await fetch("/api/telegram/bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to generate code");
        return;
      }
      setBindCode(String(data?.code || ""));
      setBindExpiresAt(typeof data?.expiresAt === "string" ? data.expiresAt : null);
      toast.success("Bind code generated");
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setCreatingBindCode(false);
    }
  };

  const updateBindingEnabled = async (id: string, enabled: boolean) => {
    const prev = bindings;
    setBindings((list) => list.map((b) => (b.id === id ? { ...b, enabled } : b)));
    try {
      const res = await fetch(`/api/telegram/bindings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setBindings(prev);
        toast.error(data?.error || "Failed to update binding");
        return;
      }
      toast.success("Binding updated");
    } catch {
      setBindings(prev);
      toast.error("Failed to update binding");
    }
  };

  const deleteBinding = async (id: string) => {
    try {
      const res = await fetch(`/api/telegram/bindings/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Failed to delete binding");
        return;
      }
      setBindings((list) => list.filter((b) => b.id !== id));
      toast.success("Binding removed");
    } catch {
      toast.error("Failed to delete binding");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Telegram</h1>
          <p className="text-sm text-muted-foreground">
            Link your account and bind group Topics for notifications.
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchAll()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1) Link your account</CardTitle>
          <CardDescription>
            Generate a one-time code, then DM the bot: <span className="font-mono">/start &lt;code&gt;</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {link ? (
            <div className="text-sm">
              Linked as{" "}
              <span className="font-mono">
                {link.telegramUsername ? `@${link.telegramUsername}` : link.telegramUserId}
              </span>
              . Unlink via <span className="font-mono">/unlink</span> in the bot DM.
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Not linked yet.</div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Link code</Label>
              <div className="flex gap-2">
                <Input value={linkCode} readOnly placeholder="Click Generate" className="font-mono" />
                <Button variant="outline" onClick={() => copyToClipboard(linkCode)} disabled={!linkCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {linkDeepLink ? (
                <div className="text-xs text-muted-foreground break-all">
                  Deep-link: <span className="font-mono">{linkDeepLink}</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Set <span className="font-mono">TELEGRAM_BOT_USERNAME</span> to show a deep-link.
                </div>
              )}
              {linkExpiresAt ? (
                <div className="text-xs text-muted-foreground">
                  Expires at: <span className="font-mono">{linkExpiresAt}</span>
                </div>
              ) : null}
            </div>
            <Button onClick={createLinkCode} disabled={creatingLinkCode}>
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Bind a group Topic</CardTitle>
          <CardDescription>
            Generate a bind code, then in the target group Topic run <span className="font-mono">/bind &lt;code&gt;</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mailbox scope</Label>
              <Select value={bindMailboxId} onValueChange={setBindMailboxId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mailboxOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={bindMode} onValueChange={(v) => setBindMode(v as "NOTIFY" | "MANAGE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOTIFY">NOTIFY</SelectItem>
                  <SelectItem value="MANAGE">MANAGE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bind code</Label>
            <div className="flex gap-2">
              <Input value={bindCode} readOnly placeholder="Click Generate" className="font-mono" />
              <Button variant="outline" onClick={() => copyToClipboard(bindCode)} disabled={!bindCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {bindExpiresAt ? (
              <div className="text-xs text-muted-foreground">
                Expires at: <span className="font-mono">{bindExpiresAt}</span>
              </div>
            ) : null}
          </div>

          <Button onClick={createChatBindCode} disabled={creatingBindCode}>
            Generate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bindings</CardTitle>
          <CardDescription>Topics bound to your account for Telegram notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {bindings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bindings yet.</div>
          ) : (
            bindings.map((b) => (
              <div key={b.id} className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {b.chatTitle || b.chatId}
                    <span className="text-xs text-muted-foreground ml-2">
                      {b.chatType ? `(${b.chatType})` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    chat_id={b.chatId}{b.threadId ? ` • thread_id=${b.threadId}` : ""}{b.mailbox ? ` • ${b.mailbox.address}` : " • all"}
                  </div>
                </div>
                <div className="flex items-center gap-3 justify-end">
                  <div className="flex items-center gap-2">
                    <Switch checked={b.enabled} onCheckedChange={(v) => updateBindingEnabled(b.id, v)} />
                    <span className="text-xs text-muted-foreground">{b.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => deleteBinding(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

