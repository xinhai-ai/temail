"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Mail, RotateCcw, Search, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "-";
  }
}

export default function TrashPage() {
  const [emails, setEmails] = useState<TrashEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const fetchEmails = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", "DELETED");
    params.set("page", String(page));
    params.set("limit", "20");
    if (search.trim()) params.set("search", search.trim());

    const res = await fetch(`/api/emails?${params.toString()}`);
    const data = await res.json().catch(() => null);
    setEmails(Array.isArray(data?.emails) ? data.emails : []);
    setPages(Math.max(1, Number(data?.pagination?.pages || 1)));
    setLoading(false);
  };

  useEffect(() => {
    fetchEmails().catch(() => {
      toast.error("Failed to load trash");
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

  const restoreOne = async (id: string) => {
    const res = await fetch(`/api/emails/${id}/restore`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to restore");
      return;
    }
    toast.success("Restored");
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const purgeOne = async (id: string) => {
    if (!confirm("Delete this email permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/emails/${id}/purge`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete permanently");
      return;
    }
    toast.success("Deleted permanently");
    setEmails((prev) => prev.filter((e) => e.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  };

  const bulkRestore = async () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", ids }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to restore");
      return;
    }
    toast.success("Restored");
    setSelectedIds([]);
    setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
  };

  const bulkPurge = async () => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} email(s) permanently? This cannot be undone.`)) return;
    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge", ids }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete permanently");
      return;
    }
    toast.success("Deleted permanently");
    setSelectedIds([]);
    setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
  };

  const allOnPageSelected = emails.length > 0 && emails.every((e) => selectedSet.has(e.id));
  const someOnPageSelected = emails.some((e) => selectedSet.has(e.id));

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trash</h1>
        <p className="text-muted-foreground mt-1">Deleted emails stay here until permanently removed</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trash..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={selectedIds.length === 0} onClick={bulkRestore}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore ({selectedIds.length})
          </Button>
          <Button variant="destructive" disabled={selectedIds.length === 0} onClick={bulkPurge}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Permanently
          </Button>
        </div>
      </div>

      {emails.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">Trash is empty</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Deleted emails will appear here</p>
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
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(email.id)}
                      onCheckedChange={(v) => toggleSelect(email.id, Boolean(v))}
                      aria-label="Select email"
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
                      {email.subject || "(No subject)"}
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
                        onClick={() => restoreOne(email.id)}
                        className="hover:bg-primary/10"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => purgeOne(email.id)}
                        className="hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
            Page {page} / {pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <Button variant="outline" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

