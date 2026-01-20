"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type TelegramLink = {
  telegramUserId: string;
  telegramUsername: string | null;
  privateChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TelegramForumBinding = {
  id: string;
  enabled: boolean;
  mode: "MANAGE" | "NOTIFY";
  chatId: string;
  chatType: string | null;
  chatTitle: string | null;
  threadId: string | null;
  updatedAt: string;
};

type TelegramMailboxTopic = {
  id: string;
  enabled: boolean;
  mode: "MANAGE" | "NOTIFY";
  chatId: string;
  threadId: string | null;
  updatedAt: string;
  mailbox: { id: string; address: string } | null;
};

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
  const [forumBindings, setForumBindings] = useState<TelegramForumBinding[]>([]);
  const [mailboxTopics, setMailboxTopics] = useState<TelegramMailboxTopic[]>([]);

  const [creatingLinkCode, setCreatingLinkCode] = useState(false);
  const [linkCode, setLinkCode] = useState("");
  const [linkDeepLink, setLinkDeepLink] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);

  const [creatingBindCode, setCreatingBindCode] = useState(false);
  const [bindCode, setBindCode] = useState("");
  const [bindExpiresAt, setBindExpiresAt] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const bindingsRes = await fetch("/api/telegram/bindings");
      const bindingsData = await bindingsRes.json().catch(() => null);

      if (bindingsRes.ok) {
        setLink(bindingsData?.link || null);
        setForumBindings(Array.isArray(bindingsData?.forumBindings) ? (bindingsData.forumBindings as TelegramForumBinding[]) : []);
        setMailboxTopics(Array.isArray(bindingsData?.mailboxTopics) ? (bindingsData.mailboxTopics as TelegramMailboxTopic[]) : []);
      } else {
        toast.error(bindingsData?.error || "Failed to load Telegram bindings");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  const chatTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of forumBindings) {
      map.set(b.chatId, b.chatTitle || b.chatId);
    }
    return map;
  }, [forumBindings]);

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
      const res = await fetch("/api/telegram/bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
    const prev = forumBindings;
    setForumBindings((list) => list.map((b) => (b.id === id ? { ...b, enabled } : b)));
    try {
      const res = await fetch(`/api/telegram/bindings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setForumBindings(prev);
        toast.error(data?.error || "Failed to update binding");
        return;
      }
      toast.success("Binding updated");
    } catch {
      setForumBindings(prev);
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
      await fetchAll();
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
                  Set <span className="font-mono">telegram_bot_username</span> (admin setting) or{" "}
                  <span className="font-mono">TELEGRAM_BOT_USERNAME</span> to show a deep-link.
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
          <CardTitle>2) Bind a forum group (Topics)</CardTitle>
          <CardDescription>
            Generate a bind code, then in the target group run <span className="font-mono">/bind &lt;code&gt;</span>. The bot will create a{" "}
            <span className="font-mono">TEmail · General</span> topic for management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <CardTitle>Forum group bindings</CardTitle>
          <CardDescription>Bound groups. Emails forwarded by workflows will be routed into mailbox topics automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forumBindings.length === 0 ? (
            <div className="text-sm text-muted-foreground">No bindings yet.</div>
          ) : (
            forumBindings.map((b) => (
              <div key={b.id} className="rounded-lg border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">
                    {b.chatTitle || b.chatId}
                    <span className="text-xs text-muted-foreground ml-2">
                      {b.chatType ? `(${b.chatType})` : ""}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    chat_id={b.chatId}{b.threadId ? ` • general_thread_id=${b.threadId}` : ""}
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

      <Card>
        <CardHeader>
          <CardTitle>Mailbox topics</CardTitle>
          <CardDescription>Auto-created when workflows forward emails to Telegram.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mailboxTopics.length === 0 ? (
            <div className="text-sm text-muted-foreground">No mailbox topics yet.</div>
          ) : (
            mailboxTopics.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 space-y-1">
                <div className="text-sm font-medium">{t.mailbox?.address || t.id}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  group={chatTitles.get(t.chatId) || t.chatId} • chat_id={t.chatId}{t.threadId ? ` • thread_id=${t.threadId}` : ""}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
