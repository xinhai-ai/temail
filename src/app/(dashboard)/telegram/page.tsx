"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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

export default function TelegramPage() {
  const t = useTranslations("telegram");
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

  const copyToClipboard = useCallback(
    (text: string) => {
      if (!text) return;
      navigator.clipboard.writeText(text).then(
        () => toast.success(t("toasts.copied")),
        () => toast.error(t("toasts.copyFailed"))
      );
    },
    [t]
  );

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
        toast.error(bindingsData?.error || t("toasts.loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        toast.error(data?.error || t("toasts.generateFailed"));
        return;
      }
      setLinkCode(String(data?.code || ""));
      setLinkDeepLink(typeof data?.deepLink === "string" ? data.deepLink : null);
      setLinkExpiresAt(typeof data?.expiresAt === "string" ? data.expiresAt : null);
      toast.success(t("toasts.linkCodeGenerated"));
    } catch {
      toast.error(t("toasts.generateFailed"));
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
        toast.error(data?.error || t("toasts.generateFailed"));
        return;
      }
      setBindCode(String(data?.code || ""));
      setBindExpiresAt(typeof data?.expiresAt === "string" ? data.expiresAt : null);
      toast.success(t("toasts.bindCodeGenerated"));
    } catch {
      toast.error(t("toasts.generateFailed"));
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
        toast.error(data?.error || t("toasts.bindingUpdateFailed"));
        return;
      }
      toast.success(t("toasts.bindingUpdated"));
    } catch {
      setForumBindings(prev);
      toast.error(t("toasts.bindingUpdateFailed"));
    }
  };

  const deleteBinding = async (id: string) => {
    try {
      const res = await fetch(`/api/telegram/bindings/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toasts.bindingDeleteFailed"));
        return;
      }
      await fetchAll();
      toast.success(t("toasts.bindingRemoved"));
    } catch {
      toast.error(t("toasts.bindingDeleteFailed"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="outline" onClick={() => fetchAll()} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t("actions.refresh")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("link.title")}</CardTitle>
          <CardDescription>{t.rich("link.description", { mono: (chunks) => <span className="font-mono">{chunks}</span> })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {link ? (
            <div className="text-sm">
              {t("link.linkedAs")}{" "}
              <span className="font-mono">{link.telegramUsername ? `@${link.telegramUsername}` : link.telegramUserId}</span>.{" "}
              {t.rich("link.unlinkHint", { mono: (chunks) => <span className="font-mono">{chunks}</span> })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t("link.notLinked")}</div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>{t("link.codeLabel")}</Label>
              <div className="flex gap-2">
                <Input value={linkCode} readOnly placeholder={t("link.codePlaceholder")} className="font-mono" />
                <Button variant="outline" onClick={() => copyToClipboard(linkCode)} disabled={!linkCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {linkDeepLink ? (
                <div className="text-xs text-muted-foreground break-all">
                  {t("link.deepLinkLabel")} <span className="font-mono">{linkDeepLink}</span>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {t.rich("link.deepLinkHelp", { mono: (chunks) => <span className="font-mono">{chunks}</span> })}
                </div>
              )}
              {linkExpiresAt ? (
                <div className="text-xs text-muted-foreground">
                  {t("link.expiresAt")} <span className="font-mono">{linkExpiresAt}</span>
                </div>
              ) : null}
            </div>
            <Button onClick={createLinkCode} disabled={creatingLinkCode}>
              {t("actions.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("bind.title")}</CardTitle>
          <CardDescription>{t.rich("bind.description", { mono: (chunks) => <span className="font-mono">{chunks}</span> })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("bind.codeLabel")}</Label>
            <div className="flex gap-2">
              <Input value={bindCode} readOnly placeholder={t("bind.codePlaceholder")} className="font-mono" />
              <Button variant="outline" onClick={() => copyToClipboard(bindCode)} disabled={!bindCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {bindExpiresAt ? (
              <div className="text-xs text-muted-foreground">
                {t("bind.expiresAt")} <span className="font-mono">{bindExpiresAt}</span>
              </div>
            ) : null}
          </div>

          <Button onClick={createChatBindCode} disabled={creatingBindCode}>
            {t("actions.generate")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("bindings.title")}</CardTitle>
          <CardDescription>{t.rich("bindings.description", { mono: (chunks) => <span className="font-mono">{chunks}</span> })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {forumBindings.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("bindings.empty")}</div>
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
                    <span className="text-xs text-muted-foreground">{b.enabled ? t("bindings.status.enabled") : t("bindings.status.disabled")}</span>
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
          <CardTitle>{t("topics.title")}</CardTitle>
          <CardDescription>{t("topics.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mailboxTopics.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("topics.empty")}</div>
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
