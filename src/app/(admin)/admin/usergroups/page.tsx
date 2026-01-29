"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Layers, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserGroupRow = {
  id: string;
  name: string;
  description: string | null;
  domainPolicy: "ALL_PUBLIC" | "ALLOWLIST";
  maxMailboxes: number | null;
  maxWorkflows: number | null;
  telegramEnabled: boolean;
  workflowEnabled: boolean;
  openApiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { users: number; domains: number };
};

function formatQuota(value: number | null) {
  if (value === null) return "∞";
  return String(value);
}

export default function AdminUserGroupsPage() {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<UserGroupRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/usergroups");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("common.unknownError"));
        setGroups([]);
        return;
      }
      setGroups(Array.isArray(data) ? (data as UserGroupRow[]) : []);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGroups().catch(() => setLoading(false));
  }, [fetchGroups]);

  const openCreateDialog = () => {
    setNewName("");
    setShowCreate(true);
  };

  const closeCreateDialog = () => {
    setShowCreate(false);
    setNewName("");
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error(t("usergroups.errors.nameRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/usergroups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("common.unknownError"));
        return;
      }
      toast.success(t("usergroups.toasts.created"));
      closeCreateDialog();
      await fetchGroups();
    } finally {
      setCreating(false);
    }
  };

  const handleAssignDefault = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/usergroups/actions/assign-default", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("common.unknownError"));
        return;
      }
      const updated = Number(data?.updatedCount || 0);
      toast.success(t("usergroups.toasts.assignedDefault", { count: updated }));
      await fetchGroups();
    } finally {
      setRefreshing(false);
    }
  };

  const sorted = useMemo(() => groups, [groups]);

  if (loading) {
    return <div className="flex justify-center p-8">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("usergroups.title")}</h1>
          <p className="text-muted-foreground">{t("usergroups.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleAssignDefault} disabled={refreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("usergroups.actions.assignDefault")}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            {t("usergroups.actions.newGroup")}
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("usergroups.empty")}</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.table.name")}</TableHead>
                <TableHead>{t("usergroups.table.policy")}</TableHead>
                <TableHead>{t("usergroups.table.mailboxes")}</TableHead>
                <TableHead>{t("usergroups.table.workflows")}</TableHead>
                <TableHead>{t("usergroups.table.features")}</TableHead>
                <TableHead>{t("usergroups.table.users")}</TableHead>
                <TableHead>{t("usergroups.table.domains")}</TableHead>
                <TableHead className="text-right">{t("common.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{g.name}</span>
                      {g.description ? (
                        <span className="text-xs text-muted-foreground">{g.description}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{g.domainPolicy}</TableCell>
                  <TableCell>{formatQuota(g.maxMailboxes)}</TableCell>
                  <TableCell>{formatQuota(g.maxWorkflows)}</TableCell>
                  <TableCell>
                    {[
                      g.telegramEnabled ? "TG" : null,
                      g.workflowEnabled ? "WF" : null,
                      g.openApiEnabled ? "API" : null,
                    ].filter(Boolean).join(" / ") || "-"}
                  </TableCell>
                  <TableCell>{g._count.users}</TableCell>
                  <TableCell>{g._count.domains}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/usergroups/${g.id}`}>{t("common.manage")}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("usergroups.create.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("common.table.name")}</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("usergroups.create.namePlaceholder")}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCreateDialog} disabled={creating}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
