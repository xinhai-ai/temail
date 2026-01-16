"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Globe, Server, Webhook, Copy, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Domain {
  id: string;
  name: string;
  sourceType: "IMAP" | "WEBHOOK";
  status: string;
  description?: string;
  isPublic?: boolean;
  imapConfig?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    syncInterval: number;
  };
  webhookConfig?: {
    secretKey: string;
    endpoint: string;
    isActive: boolean;
  };
}

export default function DomainConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [domain, setDomain] = useState<Domain | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);

  // IMAP config state
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUsername, setImapUsername] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapInterval, setImapInterval] = useState("60");

  // Webhook config state
  const [webhookActive, setWebhookActive] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [description, setDescription] = useState("");

  const fetchDomain = async () => {
    const res = await fetch(`/api/domains/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDomain(data);
      setIsPublic(Boolean(data.isPublic));
      setDescription(data.description || "");

      if (data.imapConfig) {
        setImapHost(data.imapConfig.host);
        setImapPort(String(data.imapConfig.port));
        setImapSecure(data.imapConfig.secure);
        setImapUsername(data.imapConfig.username);
        setImapPassword("");
        setImapInterval(String(data.imapConfig.syncInterval));
      }

      if (data.webhookConfig) {
        setWebhookActive(data.webhookConfig.isActive);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      await fetchDomain();
    };
    run();
  }, [id]);

  const saveDomainSettings = async () => {
    setSavingDomain(true);
    const res = await fetch(`/api/domains/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic, description: description.trim() ? description.trim() : undefined }),
    });

    if (res.ok) {
      toast.success("Domain settings saved");
      fetchDomain();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Failed to save");
    }
    setSavingDomain(false);
  };

  const saveImapConfig = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {
      host: imapHost,
      port: parseInt(imapPort),
      secure: imapSecure,
      username: imapUsername,
      syncInterval: parseInt(imapInterval),
      ...(imapPassword.trim() ? { password: imapPassword } : {}),
    };
    const res = await fetch(`/api/domains/${id}/imap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success("IMAP configuration saved");
      setImapPassword("");
      fetchDomain();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to save");
    }
    setSaving(false);
  };

  const generateWebhook = async () => {
    const res = await fetch(`/api/domains/${id}/webhook`, {
      method: "POST",
    });

    if (res.ok) {
      toast.success("Webhook generated");
      fetchDomain();
    } else {
      toast.error("Failed to generate webhook");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!domain) {
    return <div className="p-8 text-center">Domain not found</div>;
  }

  const webhookUrl = domain.webhookConfig
    ? `${window.location.origin}/api/webhooks/incoming`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/domains">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
            <p className="text-muted-foreground">Configure domain settings</p>
          </div>
        </div>
        <Badge
          className={
            domain.status === "ACTIVE"
              ? "bg-green-500/10 text-green-600"
              : domain.status === "PENDING"
              ? "bg-yellow-500/10 text-yellow-600"
              : "bg-muted text-muted-foreground"
          }
        >
          {domain.status}
        </Badge>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Visibility and metadata</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Input
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Label>Visible to users</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, normal users can use this domain once it becomes ACTIVE.
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveDomainSettings} disabled={savingDomain}>
              <Save className="h-4 w-4 mr-2" />
              {savingDomain ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={domain.sourceType.toLowerCase()} className="space-y-6">
        <TabsList>
          <TabsTrigger value="webhook" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhook
          </TabsTrigger>
          <TabsTrigger value="imap" className="gap-2">
            <Server className="h-4 w-4" />
            IMAP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhook" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Receive emails via HTTP webhook from your email provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {domain.webhookConfig ? (
                <>
                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl || ""} readOnly className="font-mono text-sm" />
                      <Button variant="outline" onClick={() => copyToClipboard(webhookUrl || "")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Secret Key</Label>
                    <div className="flex gap-2">
                      <Input
                        value={domain.webhookConfig.secretKey}
                        readOnly
                        className="font-mono text-sm"
                        type="password"
                      />
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(domain.webhookConfig!.secretKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Include this as &quot;secret&quot; in your webhook payload
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Active</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable or disable webhook receiving
                      </p>
                    </div>
                    <Switch checked={webhookActive} onCheckedChange={setWebhookActive} />
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Payload Format</h4>
                    <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "secret": "${domain.webhookConfig.secretKey}",
  "to": "user@${domain.name}",
  "from": "sender@example.com",
  "subject": "Email Subject",
  "text": "Plain text body",
  "html": "<p>HTML body</p>"
}`}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">No webhook configured</p>
                  <Button onClick={generateWebhook}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Webhook
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imap" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>IMAP Configuration</CardTitle>
              <CardDescription>
                Connect to an IMAP server to fetch emails automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IMAP Host</Label>
                  <Input
                    placeholder="imap.example.com"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    placeholder="993"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="username@example.com"
                    value={imapUsername}
                    onChange={(e) => setImapUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank to keep the current password
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sync Interval (seconds)</Label>
                  <Input
                    placeholder="60"
                    value={imapInterval}
                    onChange={(e) => setImapInterval(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={imapSecure} onCheckedChange={setImapSecure} />
                  <Label>Use SSL/TLS</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveImapConfig} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
