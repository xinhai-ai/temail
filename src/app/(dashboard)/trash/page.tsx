"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { Mail, RotateCcw, Search, Trash2, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLocale, useTranslations } from "next-intl";

type TrashEmail = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  status: string;
  deletedAt?: string | null;
  receivedAt: string;
  mailbox: { address: string };
};

type PendingTrashAction =
  | { scope: "bulk"; type: "restore" | "purge" }
  | { scope: "single"; id: string; type: "restore" | "purge" }
  | { scope: "trash"; type: "clear" };

export default function TrashPage() {
  const locale = useLocale();
  const t = useTranslations("trash");
  const tInbox = useTranslations("inbox");
  const distanceLocale = locale === "zh" ? zhCN : enUS;

  const formatRelativeTime = (value: string | null | undefined) => {
    if (!value) return "-";
    try {
      return formatDistanceToNow(new Date(value), { addSuffix: true, locale: distanceLocale });
    } catch {
      return "-";
    }
  };

  const [emails, setEmails] = useState<TrashEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingTrashAction | null>(null);
  const actionLockRef = useRef(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const beginAction = (nextAction: PendingTrashAction) => {
    if (actionLockRef.current) return false;
    actionLockRef.current = true;
    setPendingAction(nextAction);
    setActionInProgress(true);
    return true;
  };

  const endAction = () => {
    actionLockRef.current = false;
    setPendingAction(null);
    setActionInProgress(false);
  };

  const fetchEmails = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", "DELETED");
    params.set("page", String(page));
    params.set("limit", "20");
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/emails?${params.toString()}`);
    const data = await res.json().catch(() => null);
    const nextEmails = Array.isArray(data?.emails) ? data.emails : [];
    const nextPages = Math.max(1, Number(data?.pagination?.pages || 1));

    setPages(nextPages);
    if (page > nextPages) {
      setPage(nextPages);
      return;
    }

    setEmails(nextEmails);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails().catch(() => {
      toast.error(t("toast.loadFailed"));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const idsOnPage = emails.map((e) => e.id);
      if (checked) {
        const next = new Set(prev);
        for (const id of idsOnPage) next.add(id);
        return Array.from(next);
      }
      const idsSet = new Set(idsOnPage);
      return prev.filter((id) => !idsSet.has(id));
    });
  };

  const removeSelectedIds = (idsToRemove: string[]) => {
    if (idsToRemove.length === 0) return;
    const removeSet = new Set(idsToRemove);
    setSelectedIds((prev) => prev.filter((id) => !removeSet.has(id)));
  };

  const restoreOne = async (id: string) => {
    if (!beginAction({ scope: "single", id, type: "restore" })) return;
    try {
      const res = await fetch(`/api/emails/${id}/restore`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.restoreFailed"));
        return;
      }
      toast.success(t("toast.restored"));
      removeSelectedIds([id]);
      await fetchEmails().catch(() => {
        toast.error(t("toast.loadFailed"));
        setLoading(false);
      });
    } finally {
      endAction();
    }
  };

  const purgeOne = async (id: string) => {
    if (!confirm(t("confirm.purgeOne"))) return;
    if (!beginAction({ scope: "single", id, type: "purge" })) return;
    try {
      const res = await fetch(`/api/emails/${id}/purge`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.purgeFailed"));
        return;
      }
      toast.success(t("toast.purged"));
      removeSelectedIds([id]);
      await fetchEmails().catch(() => {
        toast.error(t("toast.loadFailed"));
        setLoading(false);
      });
    } finally {
      endAction();
    }
  };

  const bulkRestore = async () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    if (!beginAction({ scope: "bulk", type: "restore" })) return;
    try {
      const res = await fetch("/api/emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.restoreFailed"));
        return;
      }
      const processedIds = Array.isArray(data?.ids)
        ? data.ids.filter((value: unknown): value is string => typeof value === "string")
        : ids;
      toast.success(t("toast.restored"));
      removeSelectedIds(processedIds);
      await fetchEmails().catch(() => {
        toast.error(t("toast.loadFailed"));
        setLoading(false);
      });
    } finally {
      endAction();
    }
  };

  const bulkPurge = async () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    if (!confirm(t("confirm.purgeBulk", { count: ids.length }))) return;
    if (!beginAction({ scope: "bulk", type: "purge" })) return;
    try {
      const res = await fetch("/api/emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge", ids }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.purgeFailed"));
        return;
      }
      const processedIds = Array.isArray(data?.ids)
        ? data.ids.filter((value: unknown): value is string => typeof value === "string")
        : ids;
      toast.success(t("toast.purged"));
      removeSelectedIds(processedIds);
      await fetchEmails().catch(() => {
        toast.error(t("toast.loadFailed"));
        setLoading(false);
      });
    } finally {
      endAction();
    }
  };

  const clearTrash = async () => {
    if (!confirm(t("confirm.clearAll"))) return;
    if (!beginAction({ scope: "trash", type: "clear" })) return;
    try {
      const res = await fetch("/api/trash/clear", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.clearFailed"));
        return;
      }

      const count = Number(data?.count ?? 0);
      toast.success(t("toast.cleared", { count }));
      setSelectedIds([]);
      if (page !== 1) {
        setPage(1);
      } else {
        await fetchEmails().catch(() => {
          toast.error(t("toast.loadFailed"));
          setLoading(false);
        });
      }
    } finally {
      endAction();
    }
  };

  const allOnPageSelected = emails.length > 0 && emails.every((e) => selectedSet.has(e.id));
  const someOnPageSelected = emails.some((e) => selectedSet.has(e.id));
  const bulkRestoreLoading = pendingAction?.scope === "bulk" && pendingAction.type === "restore";
  const bulkPurgeLoading = pendingAction?.scope === "bulk" && pendingAction.type === "purge";
  const clearTrashLoading = pendingAction?.scope === "trash" && pendingAction.type === "clear";

  const isSingleLoading = (id: string, type: "restore" | "purge") => {
    return pendingAction?.scope === "single" && pendingAction.id === id && pendingAction.type === type;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("description")}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="destructive" disabled={loading || emails.length === 0 || actionInProgress} onClick={clearTrash}>
            {clearTrashLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            {t("bulk.clearAll")}
          </Button>
          <Button variant="outline" disabled={selectedIds.length === 0 || actionInProgress} onClick={bulkRestore}>
            {bulkRestoreLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
            {t("bulk.restore", { count: selectedIds.length })}
          </Button>
          <Button variant="destructive" disabled={selectedIds.length === 0 || actionInProgress} onClick={bulkPurge}>
            {bulkPurgeLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
            {t("bulk.purge")}
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/50">
          <CardContent className="flex justify-center items-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </CardContent>
        </Card>
      ) : emails.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t("empty.description")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected || (someOnPageSelected ? "indeterminate" : false)}
                    onCheckedChange={(v) => toggleSelectAllOnPage(Boolean(v))}
                    disabled={actionInProgress}
                    aria-label={t("table.selectAll")}
                  />
                </TableHead>
                <TableHead>{t("table.from")}</TableHead>
                <TableHead>{t("table.subject")}</TableHead>
                <TableHead>{t("table.to")}</TableHead>
                <TableHead>{t("table.deleted")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(email.id)}
                      onCheckedChange={(v) => toggleSelect(email.id, Boolean(v))}
                      disabled={actionInProgress}
                      aria-label={t("table.selectEmail")}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p>{email.fromName || email.fromAddress}</p>
                      {email.fromName && (
                        <p className="text-xs text-muted-foreground">
                          {email.fromAddress}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {email.subject || tInbox("email.noSubject")}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {email.mailbox.address}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelativeTime(email.deletedAt || email.receivedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/emails/${email.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionInProgress}
                        onClick={() => restoreOne(email.id)}
                        className="hover:bg-primary/10"
                      >
                        {isSingleLoading(email.id, "restore") ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionInProgress}
                        onClick={() => purgeOne(email.id)}
                        className="hover:bg-destructive/10"
                      >
                        {isSingleLoading(email.id, "purge") ? <Loader2 className="h-4 w-4 text-destructive animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("pagination.page", { page, pages })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t("pagination.prev")}
            </Button>
            <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
