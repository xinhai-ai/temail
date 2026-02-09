"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, use } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserGroupDetail = {
  id: string;
  name: string;
  description: string | null;
  domainPolicy: "ALL_PUBLIC" | "ALLOWLIST";
  maxMailboxes: number | null;
  maxWorkflows: number | null;
  telegramEnabled: boolean;
  workflowEnabled: boolean;
  workflowForwardEmailEnabled: boolean;
  workflowForwardWebhookEnabled: boolean;
  openApiEnabled: boolean;
  domainIds: string[];
  _count: { users: number; domains: number };
};

type DomainRow = {
  id: string;
  name: string;
  status: string;
  isPublic: boolean;
};

function parseNullableInt(input: string): number | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return null;
  return value;
}

export default function AdminUserGroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("admin");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [group, setGroup] = useState<UserGroupDetail | null>(null);
  const [domains, setDomains] = useState<DomainRow[]>([]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [domainPolicy, setDomainPolicy] = useState<UserGroupDetail["domainPolicy"]>("ALL_PUBLIC");
  const [maxMailboxes, setMaxMailboxes] = useState<string>("");
  const [maxWorkflows, setMaxWorkflows] = useState<string>("");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [workflowEnabled, setWorkflowEnabled] = useState(true);
  const [workflowForwardEmailEnabled, setWorkflowForwardEmailEnabled] = useState(false);
  const [workflowForwardWebhookEnabled, setWorkflowForwardWebhookEnabled] = useState(true);
  const [openApiEnabled, setOpenApiEnabled] = useState(true);
  const [domainIds, setDomainIds] = useState<string[]>([]);

  const selected = useMemo(() => new Set(domainIds), [domainIds]);

  const load = async () => {
    setLoading(true);
    try {
      const [groupRes, domainsRes] = await Promise.all([
        fetch(`/api/admin/usergroups/${id}`),
        fetch("/api/domains"),
      ]);
      const groupData = await groupRes.json().catch(() => null);
      const domainsData = await domainsRes.json().catch(() => null);

      if (!groupRes.ok) {
        toast.error(groupData?.error || t("common.unknownError"));
        return;
      }
      const g = groupData?.group as UserGroupDetail;
      setGroup(g);
      setName(g.name || "");
      setDescription(g.description || "");
      setDomainPolicy(g.domainPolicy);
      setMaxMailboxes(g.maxMailboxes === null ? "" : String(g.maxMailboxes));
      setMaxWorkflows(g.maxWorkflows === null ? "" : String(g.maxWorkflows));
      setTelegramEnabled(Boolean(g.telegramEnabled));
      setWorkflowEnabled(Boolean(g.workflowEnabled));
      setWorkflowForwardEmailEnabled(Boolean(g.workflowForwardEmailEnabled));
      setWorkflowForwardWebhookEnabled(Boolean(g.workflowForwardWebhookEnabled));
      setOpenApiEnabled(Boolean(g.openApiEnabled));
      setDomainIds(Array.isArray(g.domainIds) ? g.domainIds : []);

      if (domainsRes.ok && Array.isArray(domainsData)) {
        const mapped = (domainsData as Array<{ id: string; name: string; status: string; isPublic: boolean }>).map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          isPublic: d.isPublic,
        }));
        setDomains(mapped);
      } else {
        setDomains([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const toggleDomain = (domainId: string) => {
    setDomainIds((prev) => {
      const next = new Set(prev);
      if (next.has(domainId)) next.delete(domainId);
      else next.add(domainId);
      return Array.from(next).sort();
    });
  };

  const handleSave = async () => {
    if (!group) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(t("usergroups.errors.nameRequired"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
        domainPolicy,
        maxMailboxes: parseNullableInt(maxMailboxes),
        maxWorkflows: parseNullableInt(maxWorkflows),
        telegramEnabled,
        workflowEnabled,
        workflowForwardEmailEnabled,
        workflowForwardWebhookEnabled,
        openApiEnabled,
        domainIds,
      };

      const res = await fetch(`/api/admin/usergroups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("common.unknownError"));
        return;
      }
      toast.success(t("usergroups.toasts.saved"));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t("usergroups.confirmDelete"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/usergroups/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("common.unknownError"));
        return;
      }
      toast.success(t("usergroups.toasts.deleted"));
      window.location.href = "/admin/usergroups";
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">{t("common.loading")}</div>;
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/admin/usergroups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("common.back")}
          </Link>
        </Button>
        <Card className="p-8">{t("usergroups.notFound")}</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/usergroups">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.back")}
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{group.name}</h1>
            <p className="text-muted-foreground">
              {t("usergroups.detail.subtitle", { users: group._count.users })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {t("common.delete")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("usergroups.detail.settings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.table.name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("usergroups.fields.domainPolicy")}</Label>
              <Select value={domainPolicy} onValueChange={(value) => setDomainPolicy(value as UserGroupDetail["domainPolicy"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_PUBLIC">{t("usergroups.domainPolicy.allPublic")}</SelectItem>
                  <SelectItem value="ALLOWLIST">{t("usergroups.domainPolicy.allowlist")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("common.table.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("usergroups.detail.descriptionPlaceholder")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="maxMailboxes">{t("usergroups.fields.maxMailboxes")}</Label>
              <Input
                id="maxMailboxes"
                value={maxMailboxes}
                onChange={(e) => setMaxMailboxes(e.target.value)}
                placeholder={t("usergroups.placeholders.unlimited")}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxWorkflows">{t("usergroups.fields.maxWorkflows")}</Label>
              <Input
                id="maxWorkflows"
                value={maxWorkflows}
                onChange={(e) => setMaxWorkflows(e.target.value)}
                placeholder={t("usergroups.placeholders.unlimited")}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">{t("usergroups.features.telegram")}</div>
                <div className="text-xs text-muted-foreground">{t("usergroups.features.telegramDesc")}</div>
              </div>
              <Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">{t("usergroups.features.workflow")}</div>
                <div className="text-xs text-muted-foreground">{t("usergroups.features.workflowDesc")}</div>
              </div>
              <Switch checked={workflowEnabled} onCheckedChange={setWorkflowEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">{t("usergroups.features.workflowForwardEmail")}</div>
                <div className="text-xs text-muted-foreground">{t("usergroups.features.workflowForwardEmailDesc")}</div>
              </div>
              <Switch checked={workflowForwardEmailEnabled} onCheckedChange={setWorkflowForwardEmailEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">{t("usergroups.features.workflowForwardWebhook")}</div>
                <div className="text-xs text-muted-foreground">{t("usergroups.features.workflowForwardWebhookDesc")}</div>
              </div>
              <Switch checked={workflowForwardWebhookEnabled} onCheckedChange={setWorkflowForwardWebhookEnabled} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="font-medium">{t("usergroups.features.openapi")}</div>
                <div className="text-xs text-muted-foreground">{t("usergroups.features.openapiDesc")}</div>
              </div>
              <Switch checked={openApiEnabled} onCheckedChange={setOpenApiEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("usergroups.detail.domains")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {domainPolicy !== "ALLOWLIST" ? (
            <div className="text-sm text-muted-foreground">{t("usergroups.detail.domainsHintAll")}</div>
          ) : domains.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("usergroups.detail.domainsEmpty")}</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {domains.map((d) => {
                const checked = selected.has(d.id);
                const label = `${d.name}${d.isPublic ? "" : " (private)"}${d.status !== "ACTIVE" ? ` [${d.status}]` : ""}`;
                return (
                  <label key={d.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDomain(d.id)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
