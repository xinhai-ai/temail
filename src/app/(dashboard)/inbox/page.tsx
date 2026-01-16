"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { connectRealtime } from "@/lib/realtime/client";
import {
  Inbox,
  Mail,
  Search,
  Star,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  MoreHorizontal,
  Bell,
  BellOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";

interface Domain {
  id: string;
  name: string;
}

interface MailboxGroup {
  id: string;
  name: string;
  color?: string | null;
}

interface Mailbox {
  id: string;
  address: string;
  note?: string | null;
  isStarred: boolean;
  status: string;
  group?: MailboxGroup | null;
  _count: { emails: number };
}

interface EmailListItem {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  status: string;
  isStarred: boolean;
  receivedAt: string;
  mailboxId: string;
  mailbox: { address: string };
}

interface EmailDetail extends EmailListItem {
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: string | null;
}

function HtmlPreview({ html }: { html: string }) {
  const srcDoc = useMemo(() => {
    const safeHtml = html || "";
    return `<!doctype html><html><head><meta charset=\"utf-8\" /><base target=\"_blank\" /></head><body style=\"margin:0;padding:12px;font-family:ui-sans-serif,system-ui;\">${safeHtml}</body></html>`;
  }, [html]);

  return (
    <iframe
      title="Email HTML preview"
      sandbox=""
      srcDoc={srcDoc}
      className="w-full h-[480px] rounded-md border bg-white"
    />
  );
}

export default function InboxPage() {
  const UNGROUPED_SELECT_VALUE = "__ungrouped__";
  const NOTIFICATIONS_ENABLED_KEY = "temail.notificationsEnabled";
  const [mailboxSearch, setMailboxSearch] = useState("");
  const [emailSearch, setEmailSearch] = useState("");

  const [domains, setDomains] = useState<Domain[]>([]);
  const [groups, setGroups] = useState<MailboxGroup[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);

  const [loadingDomains, setLoadingDomains] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [realtimeTick, setRealtimeTick] = useState(0);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    if (typeof Notification === "undefined") return "default";
    return Notification.permission;
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false);
  const [creatingMailbox, setCreatingMailbox] = useState(false);
  const [newMailboxPrefix, setNewMailboxPrefix] = useState("");
  const [newMailboxDomainId, setNewMailboxDomainId] = useState("");
  const [newMailboxGroupId, setNewMailboxGroupId] = useState<string>("");
  const [newMailboxNote, setNewMailboxNote] = useState("");

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState("");

  // Delete confirmation dialog states
  const [deleteEmailId, setDeleteEmailId] = useState<string | null>(null);
  const [deleteMailboxId, setDeleteMailboxId] = useState<string | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<MailboxGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const selectedEmailIdSet = useMemo(() => new Set(selectedEmailIds), [selectedEmailIds]);

  const groupedMailboxes = useMemo(() => {
    const grouped: Record<string, { group: MailboxGroup | null; mailboxes: Mailbox[] }> = {};

    for (const group of groups) {
      grouped[group.id] = { group, mailboxes: [] };
    }

    for (const mailbox of mailboxes) {
      const key = mailbox.group?.id || "__ungrouped__";
      if (!grouped[key]) {
        grouped[key] = { group: mailbox.group || null, mailboxes: [] };
      }
      grouped[key].mailboxes.push(mailbox);
    }

    if (!grouped["__ungrouped__"]) {
      grouped["__ungrouped__"] = { group: null, mailboxes: [] };
    }

    const items = Object.entries(grouped).map(([key, value]) => ({
      key,
      group: value.group,
      mailboxes: value.mailboxes.sort((a, b) => a.address.localeCompare(b.address)),
    }));

    items.sort((a, b) => {
      if (a.key === "__ungrouped__") return 1;
      if (b.key === "__ungrouped__") return -1;
      return (a.group?.name || "").localeCompare(b.group?.name || "");
    });

    return items;
  }, [groups, mailboxes]);

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true);
    const res = await fetch("/api/domains");
    const data = await res.json();
    setDomains(Array.isArray(data) ? data : []);
    setLoadingDomains(false);
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    const res = await fetch("/api/mailbox-groups");
    const data = await res.json();
    setGroups(Array.isArray(data) ? data : []);
    setLoadingGroups(false);
  }, []);

  const loadMailboxes = useCallback(async (search: string) => {
    setLoadingMailboxes(true);
    const res = await fetch(`/api/mailboxes?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setMailboxes(Array.isArray(data) ? data : []);
    setLoadingMailboxes(false);
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadMailboxes(mailboxSearch);
  }, [mailboxSearch, loadMailboxes]);

  useEffect(() => {
    const fetchEmails = async () => {
      setLoadingEmails(true);
      const params = new URLSearchParams();
      if (emailSearch) params.set("search", emailSearch);
      if (selectedMailboxId) params.set("mailboxId", selectedMailboxId);

      const res = await fetch(`/api/emails?${params.toString()}`);
      const data = await res.json();
      setEmails(Array.isArray(data?.emails) ? data.emails : []);
      setLoadingEmails(false);
    };

    fetchEmails();
  }, [selectedMailboxId, emailSearch, realtimeTick]);

  const toggleNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Desktop notifications are not supported in this browser");
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try {
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "0");
      } catch {
        // ignore
      }
      toast.message("Desktop notifications disabled");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      toast.error("Notification permission not granted");
      return;
    }

    setNotificationsEnabled(true);
    try {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "1");
    } catch {
      // ignore
    }
    toast.success("Desktop notifications enabled");
  };

  useEffect(() => {
    const disconnect = connectRealtime({
      onEvent: (event) => {
        if (event.type === "email.created") {
          if (notificationsEnabled && notificationPermission === "granted") {
            try {
              const n = new Notification(event.data.email.subject || "(No subject)", {
                body: event.data.email.fromName || event.data.email.fromAddress,
                tag: event.data.email.id,
              });
              n.onclick = () => {
                try {
                  window.focus();
                  window.location.href = `/emails/${event.data.email.id}`;
                } catch {
                  // ignore
                }
              };
            } catch {
              // ignore
            }
          }
          setRealtimeTick((t) => t + 1);
          return;
        }

        if (event.type === "email.updated") {
          setSelectedEmail((prev) => {
            if (!prev || prev.id !== event.data.id) return prev;
            return {
              ...prev,
              ...(event.data.status ? { status: event.data.status } : {}),
              ...(typeof event.data.isStarred === "boolean" ? { isStarred: event.data.isStarred } : {}),
            };
          });
          setRealtimeTick((t) => t + 1);
          return;
        }

        if (event.type === "email.deleted") {
          setSelectedEmailIds((prev) => prev.filter((id) => id !== event.data.id));
          setSelectedEmailId((current) => (current === event.data.id ? null : current));
          setSelectedEmail((prev) => (prev?.id === event.data.id ? null : prev));
          setRealtimeTick((t) => t + 1);
          return;
        }

        if (event.type === "emails.bulk_updated") {
          setSelectedEmailIds((prev) => prev.filter((id) => !event.data.ids.includes(id)));
          if (event.data.action === "delete") {
            setSelectedEmailId((current) => (current && event.data.ids.includes(current) ? null : current));
            setSelectedEmail((prev) => (prev && event.data.ids.includes(prev.id) ? null : prev));
          }
          setRealtimeTick((t) => t + 1);
        }
      },
    });

    return disconnect;
  }, [notificationsEnabled, notificationPermission]);

  useEffect(() => {
    setSelectedEmailIds([]);
  }, [selectedMailboxId, emailSearch]);

  useEffect(() => {
    if (!selectedEmailId) {
      setSelectedEmail(null);
      return;
    }

    const fetchPreview = async () => {
      setLoadingPreview(true);
      const res = await fetch(`/api/emails/${selectedEmailId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail(data);
      } else {
        setSelectedEmail(null);
      }
      setLoadingPreview(false);
    };

    fetchPreview();
  }, [selectedEmailId]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStarEmail = async (id: string, isStarred: boolean) => {
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !isStarred }),
    });
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isStarred: !isStarred } : e))
    );
    if (selectedEmail?.id === id) {
      setSelectedEmail({ ...selectedEmail, isStarred: !isStarred });
    }
  };

  const handleDeleteEmail = async (id: string) => {
    setDeleteEmailId(id);
  };

  const confirmDeleteEmail = async () => {
    if (!deleteEmailId) return;
    setDeleting(true);
    const res = await fetch(`/api/emails/${deleteEmailId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      toast.error("Failed to delete email");
      return;
    }
    toast.success("Email deleted");
    setEmails((prev) => prev.filter((e) => e.id !== deleteEmailId));
    if (selectedEmailId === deleteEmailId) {
      setSelectedEmailId(null);
    }
    setDeleteEmailId(null);
  };

  const handleSelectEmail = async (email: EmailListItem) => {
    setSelectedEmailId(email.id);

    if (email.status !== "UNREAD") return;

    // Optimistic UI update
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) => (prev?.id === email.id ? { ...prev, status: "READ" } : prev));

    // Persist immediately (also triggers realtime update for other tabs)
    fetch(`/api/emails/${email.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READ" }),
    }).catch(() => {
      // ignore
    });
  };

  const toggleEmailSelection = (id: string, checked: boolean) => {
    setSelectedEmailIds((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        return [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedEmailIds((prev) => {
      if (checked) {
        const next = new Set(prev);
        for (const e of emails) next.add(e.id);
        return Array.from(next);
      }
      const emailIds = new Set(emails.map((e) => e.id));
      return prev.filter((id) => !emailIds.has(id));
    });
  };

  const selectedCountOnPage = useMemo(() => {
    if (emails.length === 0) return 0;
    let count = 0;
    for (const e of emails) {
      if (selectedEmailIdSet.has(e.id)) count++;
    }
    return count;
  }, [emails, selectedEmailIdSet]);

  const allSelectedOnPage = emails.length > 0 && selectedCountOnPage === emails.length;
  const someSelectedOnPage = selectedCountOnPage > 0 && !allSelectedOnPage;

  const handleBulkMarkRead = async () => {
    const ids = selectedEmailIds;
    if (ids.length === 0) return;

    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead", ids }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to mark emails as read");
      return;
    }

    toast.success("Marked as read");
    setEmails((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) => (prev && ids.includes(prev.id) ? { ...prev, status: "READ" } : prev));
    setSelectedEmailIds([]);
  };

  const confirmBulkDelete = async () => {
    const ids = selectedEmailIds;
    if (ids.length === 0) return;

    setDeleting(true);
    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids }),
    });
    const data = await res.json().catch(() => null);
    setDeleting(false);

    if (!res.ok) {
      toast.error(data?.error || "Failed to delete emails");
      return;
    }

    toast.success("Emails deleted");
    setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
    setSelectedEmailId((current) => (current && ids.includes(current) ? null : current));
    setSelectedEmail((prev) => (prev && ids.includes(prev.id) ? null : prev));
    setSelectedEmailIds([]);
    setBulkDeleteOpen(false);
  };

  const handleSelectMailbox = (mailboxId: string | null) => {
    setSelectedMailboxId(mailboxId);
    setSelectedEmailId(null);
    setEmailSearch("");
  };

  const [previewMode, setPreviewMode] = useState<"text" | "html" | "raw">("text");

  useEffect(() => {
    setPreviewMode("text");
  }, [selectedEmailId]);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Group name is required");
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await fetch("/api/mailbox-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to create group");
        return;
      }

      setGroups((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success("Group created");
      setNewGroupName("");
      setGroupDialogOpen(false);
    } catch {
      toast.error("Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const generateRandomPrefix = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewMailboxPrefix(result);
  };

  const handleCreateMailbox = async () => {
    const prefix = newMailboxPrefix.trim();
    if (!prefix || !newMailboxDomainId) {
      toast.error("Please fill in all required fields");
      return;
    }

    const groupId = newMailboxGroupId || undefined;

    setCreatingMailbox(true);
    try {
      const res = await fetch("/api/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          domainId: newMailboxDomainId,
          note: newMailboxNote.trim() || undefined,
          groupId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to create mailbox");
        return;
      }

      toast.success("Mailbox created");
      setMailboxDialogOpen(false);
      setNewMailboxPrefix("");
      setNewMailboxDomainId("");
      setNewMailboxGroupId("");
      setNewMailboxNote("");
      await loadMailboxes("");
      setMailboxSearch("");
    } catch {
      toast.error("Failed to create mailbox");
    } finally {
      setCreatingMailbox(false);
    }
  };

  const openRenameGroup = (group: MailboxGroup) => {
    setRenameGroupId(group.id);
    setRenameGroupName(group.name);
    setRenameDialogOpen(true);
  };

  const handleRenameGroup = async () => {
    const groupId = renameGroupId;
    if (!groupId) return;
    const name = renameGroupName.trim();
    if (!name) {
      toast.error("Group name is required");
      return;
    }

    setRenamingGroup(true);
    try {
      const res = await fetch(`/api/mailbox-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Failed to rename group");
        return;
      }

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name } : g)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setMailboxes((prev) =>
        prev.map((m) => (m.group?.id === groupId ? { ...m, group: { ...m.group, name } } : m))
      );
      toast.success("Group renamed");
      setRenameDialogOpen(false);
    } catch {
      toast.error("Failed to rename group");
    } finally {
      setRenamingGroup(false);
    }
  };

  const handleDeleteGroup = (group: MailboxGroup) => {
    setDeleteGroup(group);
  };

  const confirmDeleteGroup = async () => {
    if (!deleteGroup) return;
    setDeleting(true);
    const res = await fetch(`/api/mailbox-groups/${deleteGroup.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete group");
      return;
    }

    setGroups((prev) => prev.filter((g) => g.id !== deleteGroup.id));
    setMailboxes((prev) => prev.map((m) => (m.group?.id === deleteGroup.id ? { ...m, group: null } : m)));
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
    });
    toast.success("Group deleted");
    setDeleteGroup(null);
  };

  const handleMoveMailboxToGroup = async (mailboxId: string, groupId: string | null) => {
    const res = await fetch(`/api/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error || "Failed to update mailbox");
      return;
    }

    const nextGroup = groupId ? groups.find((g) => g.id === groupId) || null : null;
    setMailboxes((prev) =>
      prev.map((m) => (m.id === mailboxId ? { ...m, group: nextGroup } : m))
    );
    toast.success("Mailbox updated");
  };

  const handleStarMailbox = async (mailboxId: string, isStarred: boolean) => {
    const res = await fetch(`/api/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !isStarred }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to update mailbox");
      return;
    }
    setMailboxes((prev) =>
      prev.map((m) => (m.id === mailboxId ? { ...m, isStarred: !isStarred } : m))
    );
  };

  const handleDeleteMailbox = (mailboxId: string) => {
    setDeleteMailboxId(mailboxId);
  };

  const confirmDeleteMailbox = async () => {
    if (!deleteMailboxId) return;
    setDeleting(true);
    const res = await fetch(`/api/mailboxes/${deleteMailboxId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete mailbox");
      return;
    }
    toast.success("Mailbox deleted");
    setMailboxes((prev) => prev.filter((m) => m.id !== deleteMailboxId));
    if (selectedMailboxId === deleteMailboxId) {
      handleSelectMailbox(null);
    }
    setDeleteMailboxId(null);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-4">
        <div className="grid gap-4 h-[calc(100vh-theme(spacing.24))] lg:grid-cols-[280px_minmax(320px,420px)_minmax(420px,1fr)]">
        {/* Left: groups + mailboxes */}
        <Card className="border-border/50 overflow-hidden flex flex-col">
          <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Mailboxes</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleNotifications}
                    aria-label={notificationsEnabled ? "Disable desktop notifications" : "Enable desktop notifications"}
                  >
                    {notificationsEnabled ? (
                      <BellOff className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {notificationsEnabled ? "Disable desktop notifications" : "Enable desktop notifications"}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search mailboxes..."
                value={mailboxSearch}
                onChange={(e) => setMailboxSearch(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={selectedMailboxId === null ? "default" : "outline"}
                onClick={() => handleSelectMailbox(null)}
                className="flex-1 min-w-[140px]"
              >
                <Inbox className="mr-2 h-4 w-4" />
                All Emails
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    New
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setMailboxDialogOpen(true)} disabled={loadingDomains}>
                    New Mailbox
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setGroupDialogOpen(true)}>
                    New Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Dialog open={mailboxDialogOpen} onOpenChange={setMailboxDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Mailbox</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Domain</Label>
                      <Select value={newMailboxDomainId} onValueChange={setNewMailboxDomainId}>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingDomains ? "Loading..." : "Select domain"} />
                        </SelectTrigger>
                        <SelectContent>
                          {domains.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Prefix</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="username"
                          value={newMailboxPrefix}
                          onChange={(e) => setNewMailboxPrefix(e.target.value)}
                        />
                        <Button variant="outline" onClick={generateRandomPrefix} type="button">
                          Random
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Group (Optional)</Label>
                      <Select
                        value={newMailboxGroupId}
                        onValueChange={(value) =>
                          setNewMailboxGroupId(value === UNGROUPED_SELECT_VALUE ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ungrouped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNGROUPED_SELECT_VALUE}>Ungrouped</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Note (Optional)</Label>
                      <Input
                        placeholder="Add a note"
                        value={newMailboxNote}
                        onChange={(e) => setNewMailboxNote(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={handleCreateMailbox}
                      className="w-full"
                      disabled={creatingMailbox}
                    >
                      {creatingMailbox ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Group</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="groupName">Name</Label>
                      <Input
                        id="groupName"
                        placeholder="e.g. Shopping, Work"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={handleCreateGroup}
                      className="w-full"
                      disabled={creatingGroup}
                    >
                      {creatingGroup ? "Creating..." : "Create"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="renameGroupName">Name</Label>
                    <Input
                      id="renameGroupName"
                      value={renameGroupName}
                      onChange={(e) => setRenameGroupName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleRenameGroup}
                    className="w-full"
                    disabled={renamingGroup}
                  >
                    {renamingGroup ? "Saving..." : "Save"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <span className="text-xs text-muted-foreground">
              {loadingGroups || loadingMailboxes
                ? "Loading..."
                : `${mailboxes.length} mailboxes • ${groups.length} groups`}
            </span>

            <div className="space-y-2">
              {loadingMailboxes ? (
                <div className="space-y-3">
                  {[1, 2].map((group) => (
                    <div key={group} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      {[1, 2, 3].map((item) => (
                        <div key={item} className="flex items-center gap-3 px-2 py-2">
                          <div className="flex-1 space-y-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-5 w-8 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                groupedMailboxes.map((groupItem) => {
                  const label =
                    groupItem.key === "__ungrouped__"
                      ? "Ungrouped"
                      : groupItem.group?.name || "Group";
                  const collapsed = Boolean(collapsedGroups[groupItem.key]);
                  return (
                    <div key={groupItem.key} className="space-y-1">
                      <div className="flex items-center justify-between px-1 py-1">
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupItem.key)}
                          className="flex items-center gap-1 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider hover:text-muted-foreground"
                        >
                          {collapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {label}
                        </button>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">
                            {groupItem.mailboxes.length}
                          </span>
                          {groupItem.group && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openRenameGroup(groupItem.group as MailboxGroup)}
                                >
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteGroup(groupItem.group as MailboxGroup)}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {!collapsed && (
                        <div className="space-y-1">
                          {groupItem.mailboxes.map((mailbox) => {
                            const active = selectedMailboxId === mailbox.id;
                            return (
                              <button
                                type="button"
                                key={mailbox.id}
                                onClick={() => handleSelectMailbox(mailbox.id)}
                                className={cn(
                                  "w-full flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors",
                                  active
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div className="text-left min-w-0">
                                  <div className="truncate font-medium">
                                    {mailbox.address}
                                  </div>
                                  {mailbox.note && (
                                    <div
                                      className={cn(
                                        "truncate text-xs",
                                        active ? "text-primary-foreground/80" : "text-muted-foreground"
                                      )}
                                    >
                                      {mailbox.note}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {mailbox.isStarred && (
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        className={cn(
                                          "h-8 w-8 p-0",
                                          active ? "hover:bg-white/15" : ""
                                        )}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuLabel>Mailbox</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => handleStarMailbox(mailbox.id, mailbox.isStarred)}>
                                        {mailbox.isStarred ? "Unstar" : "Star"}
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Move to group</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleMoveMailboxToGroup(mailbox.id, null)}
                                        disabled={!mailbox.group}
                                      >
                                        Ungrouped
                                      </DropdownMenuItem>
                                      {groups.length === 0 ? (
                                        <DropdownMenuItem disabled>No groups</DropdownMenuItem>
                                      ) : (
                                        groups.map((group) => (
                                          <DropdownMenuItem
                                            key={group.id}
                                            onClick={() => handleMoveMailboxToGroup(mailbox.id, group.id)}
                                            disabled={mailbox.group?.id === group.id}
                                          >
                                            {group.name}
                                          </DropdownMenuItem>
                                        ))
                                      )}

                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => handleDeleteMailbox(mailbox.id)}
                                      >
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                  <Badge
                                    variant={active ? "secondary" : "secondary"}
                                    className={cn(active ? "bg-white/15 text-white" : "")}
                                  >
                                    {mailbox._count.emails}
                                  </Badge>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Middle: email list */}
        <Card className="border-border/50 overflow-hidden flex flex-col">
          <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={emailSearch}
                  onChange={(e) => setEmailSearch(e.target.value)}
                  className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                />
              </div>
            </div>

            {emails.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <label className="flex items-center gap-2 text-sm select-none">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    ref={(el) => {
                      if (!el) return;
                      el.indeterminate = someSelectedOnPage;
                    }}
                    onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  />
                  <span className="text-muted-foreground">
                    {selectedEmailIds.length > 0 ? `${selectedEmailIds.length} selected` : "Select"}
                  </span>
                </label>
                {selectedEmailIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleBulkMarkRead}>
                      Mark read
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEmailIds([])}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}

            {loadingEmails ? (
              <div className="divide-y rounded-md border">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-12 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-3 w-64" />
                  </div>
                ))}
              </div>
            ) : emails.length === 0 ? (
              <EmptyState
                icon={<Mail className="h-8 w-8 text-muted-foreground" />}
                title={emailSearch ? "No results found" : "No emails"}
                description={emailSearch ? `No emails matching "${emailSearch}"` : "Incoming emails will appear here automatically"}
                action={emailSearch ? { label: "Clear search", onClick: () => setEmailSearch("") } : undefined}
              />
            ) : (
              <div className="divide-y rounded-md border">
                {emails.map((email) => {
                  const active = selectedEmailId === email.id;
                  const isUnread = email.status === "UNREAD";
                  return (
                    <button
                      type="button"
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={cn(
                        "w-full text-left p-3 transition-all duration-150 group",
                        "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        active && "bg-accent ring-1 ring-primary/20",
                        isUnread && !active && "bg-primary/[0.03]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedEmailIdSet.has(email.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleEmailSelection(email.id, e.target.checked)}
                          />
                        </div>
                        {/* Unread indicator */}
                        <div className="pt-1.5 w-2 flex-shrink-0">
                          {isUnread && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "truncate",
                              isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                            )}>
                              {email.subject || "(No subject)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {email.fromName || email.fromAddress}
                            </span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="flex-shrink-0">
                              {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                            </span>
                          </div>
                          {/* Mailbox badge */}
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                            {email.mailbox.address.split('@')[0]}
                          </Badge>
                        </div>

                        {/* Action buttons - show on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleStarEmail(email.id, email.isStarred);
                                }}
                              >
                                <Star
                                  className={cn(
                                    "h-4 w-4",
                                    email.isStarred ? "fill-yellow-400 text-yellow-400" : ""
                                  )}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {email.isStarred ? "Unstar" : "Star"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteEmail(email.id);
                                }}
                                className="hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: preview */}
        <Card className="border-border/50 overflow-hidden flex flex-col">
          <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Preview</p>
              <div className="flex items-center gap-2">
                {selectedEmailId && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/emails/${selectedEmailId}`}>
                      Open
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {!selectedEmailId ? (
              <EmptyState
                icon={<Mail className="h-8 w-8 text-muted-foreground" />}
                title="Select an email"
                description="Choose an email from the list to preview its content"
              />
            ) : loadingPreview ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-[400px] w-full rounded-md" />
              </div>
            ) : !selectedEmail ? (
              <div className="text-sm text-muted-foreground">Email not found</div>
            ) : (
              <div className="space-y-4">
                {/* Subject and status */}
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold leading-tight flex-1">
                    {selectedEmail.subject || "(No subject)"}
                  </h2>
                  <Badge
                    variant={selectedEmail.status === 'UNREAD' ? 'default' : 'secondary'}
                    className={cn(
                      selectedEmail.status === 'UNREAD' && "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {selectedEmail.status === 'UNREAD' ? 'New' : 'Read'}
                  </Badge>
                </div>

                {/* Sender info card */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {(selectedEmail.fromName || selectedEmail.fromAddress || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {selectedEmail.fromName || selectedEmail.fromAddress}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedEmail.fromAddress}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{new Date(selectedEmail.receivedAt).toLocaleDateString()}</p>
                    <p>{new Date(selectedEmail.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {/* Recipient info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    <span className="text-muted-foreground/60">To:</span>{' '}
                    <span className="font-mono">{selectedEmail.toAddress}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground/60">Mailbox:</span>{' '}
                    <span className="font-mono">{selectedEmail.mailbox.address}</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={previewMode === "text" ? "default" : "outline"}
                    onClick={() => setPreviewMode("text")}
                  >
                    Text
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "html" ? "default" : "outline"}
                    onClick={() => setPreviewMode("html")}
                    disabled={!selectedEmail.htmlBody}
                  >
                    HTML
                  </Button>
                  <Button
                    size="sm"
                    variant={previewMode === "raw" ? "default" : "outline"}
                    onClick={() => setPreviewMode("raw")}
                    disabled={!selectedEmail.rawContent}
                  >
                    Raw
                  </Button>
                </div>

                {previewMode === "html" && selectedEmail.htmlBody ? (
                  <HtmlPreview html={selectedEmail.htmlBody} />
                ) : previewMode === "raw" && selectedEmail.rawContent ? (
                  <pre className="whitespace-pre-wrap break-words text-xs bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[520px]">
                    {selectedEmail.rawContent}
                  </pre>
                ) : (
                  <pre className="whitespace-pre-wrap break-words text-sm bg-white p-4 rounded-md border min-h-[360px]">
                    {selectedEmail.textBody || "No text content"}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Email Confirmation Dialog */}
      <AlertDialog open={!!deleteEmailId} onOpenChange={(open) => !open && setDeleteEmailId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEmail}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Emails</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {selectedEmailIds.length} selected emails? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Mailbox Confirmation Dialog */}
      <AlertDialog open={!!deleteMailboxId} onOpenChange={(open) => !open && setDeleteMailboxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mailbox</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete mailbox &quot;{mailboxes.find(m => m.id === deleteMailboxId)?.address}&quot;?
              All emails in this mailbox will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteMailbox}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Group Confirmation Dialog */}
      <AlertDialog open={!!deleteGroup} onOpenChange={(open) => !open && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete group &quot;{deleteGroup?.name}&quot;?
              Mailboxes in this group will become ungrouped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
