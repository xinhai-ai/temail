"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { connectRealtime } from "@/lib/realtime/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Inbox, Mail, Eye } from "lucide-react";
import { ConfirmDialogs } from "./_components/ConfirmDialogs";
import { EmailsPanel, type EmailStatusFilter } from "./_components/EmailsPanel";
import { MailboxesPanel } from "./_components/MailboxesPanel";
import { PreviewPanel } from "./_components/PreviewPanel";
import type { Domain, EmailDetail, EmailListItem, Mailbox, MailboxGroup, Tag } from "./types";

export default function InboxPage() {
  const UNGROUPED_SELECT_VALUE = "__ungrouped__";
  const NOTIFICATIONS_ENABLED_KEY = "temail.notificationsEnabled";
  const EMAILS_PAGE_SIZE_STORAGE_KEY = "temail.inbox.emailsPageSize";
  const DEFAULT_EMAILS_PAGE_SIZE = 15;
  const [mailboxSearch, setMailboxSearch] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsTotalPages, setEmailsTotalPages] = useState(1);
  const [emailsPageSize, setEmailsPageSize] = useState(DEFAULT_EMAILS_PAGE_SIZE);
  const [emailsPageSizeLoaded, setEmailsPageSizeLoaded] = useState(false);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [groups, setGroups] = useState<MailboxGroup[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);

  const [loadingDomains, setLoadingDomains] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

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
  const [refreshingImap, setRefreshingImap] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0); // remaining seconds
  const [mobileTab, setMobileTab] = useState<"mailboxes" | "emails" | "preview">("emails");
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>("all");
  const [emailsRefreshKey, setEmailsRefreshKey] = useState(0);

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

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    const data = await res.json().catch(() => null);
    setAvailableTags(Array.isArray(data) ? data : []);
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
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification !== "undefined") {
      setNotificationPermission(Notification.permission);
    }
    try {
      const enabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === "1";
      setNotificationsEnabled(enabled);
      if (enabled && typeof Notification !== "undefined" && Notification.permission !== "granted") {
        setNotificationsEnabled(false);
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "0");
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(EMAILS_PAGE_SIZE_STORAGE_KEY);
      if (raw) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isFinite(parsed)) {
          const next = Math.min(100, Math.max(1, parsed));
          setEmailsPageSize(next);
          setEmailsPage(1);
        }
      }
    } catch {
      // ignore
    } finally {
      setEmailsPageSizeLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!emailsPageSizeLoaded) return;
    try {
      localStorage.setItem(EMAILS_PAGE_SIZE_STORAGE_KEY, String(emailsPageSize));
    } catch {
      // ignore
    }
  }, [emailsPageSize, emailsPageSizeLoaded]);

  useEffect(() => {
    if (!emailsPageSizeLoaded) return;
    const fetchEmails = async () => {
      setLoadingEmails(true);
      const params = new URLSearchParams();
      let endpoint = "/api/emails";
      if (emailSearch) {
        endpoint = "/api/search/emails";
        params.set("q", emailSearch);
      }
      params.set("page", String(emailsPage));
      params.set("limit", String(emailsPageSize));
      if (selectedMailboxId) params.set("mailboxId", selectedMailboxId);
      if (selectedTagId) params.set("tagId", selectedTagId);

      // Apply status filter
      if (statusFilter === "unread") {
        params.set("status", "UNREAD");
      } else if (statusFilter === "archived") {
        params.set("status", "ARCHIVED");
      } else {
        // "all" - exclude archived emails
        params.set("excludeArchived", "true");
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      const data = await res.json().catch(() => null);
      setEmails(Array.isArray(data?.emails) ? data.emails : []);
      const pagesRaw = typeof data?.pagination?.pages === "number" ? data.pagination.pages : 1;
      const pages = Math.max(1, pagesRaw);
      setEmailsTotalPages(pages);
      if (emailsPage > pages) {
        setEmailsPage(pages);
      }
      setLoadingEmails(false);
    };

    fetchEmails();
  }, [selectedMailboxId, selectedTagId, emailSearch, emailsPage, emailsPageSize, emailsPageSizeLoaded, statusFilter, emailsRefreshKey]);

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
          const matchesMailbox =
            !selectedMailboxId || event.data.email.mailboxId === selectedMailboxId;
          const hasSearch = Boolean(emailSearch);
          const isFirstPage = emailsPage === 1;
          if (matchesMailbox && !hasSearch && isFirstPage) {
            setEmails((prev) => {
              if (prev.some((e) => e.id === event.data.email.id)) return prev;
              return [
                {
                  id: event.data.email.id,
                  mailboxId: event.data.email.mailboxId,
                  mailbox: { address: event.data.email.mailboxAddress },
                  subject: event.data.email.subject,
                  fromAddress: event.data.email.fromAddress,
                  fromName: event.data.email.fromName,
                  status: event.data.email.status,
                  isStarred: event.data.email.isStarred,
                  receivedAt: event.data.email.receivedAt,
                },
                ...prev,
              ].slice(0, emailsPageSize);
            });
          }

          // Increment unread count for the mailbox (new emails are UNREAD)
          if (event.data.email.status === "UNREAD") {
            setMailboxes((prev) =>
              prev.map((m) =>
                m.id === event.data.email.mailboxId
                  ? { ...m, _count: { emails: m._count.emails + 1 } }
                  : m
              )
            );
          }
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
          setEmails((prev) =>
            prev.map((e) =>
              e.id === event.data.id
                ? {
                    ...e,
                    ...(event.data.status ? { status: event.data.status } : {}),
                    ...(typeof event.data.isStarred === "boolean" ? { isStarred: event.data.isStarred } : {}),
                  }
                : e
            )
          );
          return;
        }

        if (event.type === "email.deleted") {
          setSelectedEmailIds((prev) => prev.filter((id) => id !== event.data.id));
          setSelectedEmailId((current) => (current === event.data.id ? null : current));
          setSelectedEmail((prev) => (prev?.id === event.data.id ? null : prev));
          setEmails((prev) => prev.filter((e) => e.id !== event.data.id));
          return;
        }

        if (event.type === "emails.bulk_updated") {
          setSelectedEmailIds((prev) => prev.filter((id) => !event.data.ids.includes(id)));
          if (event.data.action === "delete") {
            setSelectedEmailId((current) => (current && event.data.ids.includes(current) ? null : current));
            setSelectedEmail((prev) => (prev && event.data.ids.includes(prev.id) ? null : prev));
            setEmails((prev) => prev.filter((e) => !event.data.ids.includes(e.id)));
          } else if (event.data.action === "markRead") {
            setSelectedEmail((prev) => (prev ? { ...prev, status: "READ" } : prev));
            setEmails((prev) =>
              prev.map((e) => (event.data.ids.includes(e.id) ? { ...e, status: "READ" } : e))
            );
          } else if (event.data.action === "archive") {
            // Remove archived emails from list unless viewing archived
            setSelectedEmailId((current) => (current && event.data.ids.includes(current) ? null : current));
            setSelectedEmail((prev) => (prev && event.data.ids.includes(prev.id) ? null : prev));
            setEmails((prev) => prev.filter((e) => !event.data.ids.includes(e.id)));
          } else if (event.data.action === "unarchive") {
            // Remove unarchived emails from archived view
            setSelectedEmailId((current) => (current && event.data.ids.includes(current) ? null : current));
            setSelectedEmail((prev) => (prev && event.data.ids.includes(prev.id) ? null : prev));
            setEmails((prev) => prev.filter((e) => !event.data.ids.includes(e.id)));
          }
        }
      },
    });

    return disconnect;
  }, [notificationsEnabled, notificationPermission, selectedMailboxId, emailSearch, emailsPage, emailsPageSize]);

  useEffect(() => {
    setSelectedEmailIds([]);
  }, [selectedMailboxId, selectedTagId, emailSearch, emailsPage, emailsPageSize]);

  // Cooldown timer for refresh button
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

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

    // Decrement unread count for the mailbox
    setMailboxes((prev) =>
      prev.map((m) =>
        m.id === email.mailboxId
          ? { ...m, _count: { emails: Math.max(0, m._count.emails - 1) } }
          : m
      )
    );

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

  // Compute unread count from current emails list for display in status filter
  const unreadCount = useMemo(() => {
    return emails.filter((e) => e.status === "UNREAD").length;
  }, [emails]);

  const handleArchiveEmail = async (emailId: string) => {
    const res = await fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });

    if (!res.ok) {
      toast.error("Failed to archive email");
      return;
    }

    toast.success("Email archived");
    // Remove from list if not viewing archived
    if (statusFilter !== "archived") {
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setSelectedEmail(null);
      }
    } else {
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, status: "ARCHIVED" } : e))
      );
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, status: "ARCHIVED" });
      }
    }
  };

  const handleUnarchiveEmail = async (emailId: string) => {
    const res = await fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READ" }),
    });

    if (!res.ok) {
      toast.error("Failed to unarchive email");
      return;
    }

    toast.success("Email unarchived");
    // Remove from list if viewing archived
    if (statusFilter === "archived") {
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (selectedEmailId === emailId) {
        setSelectedEmailId(null);
        setSelectedEmail(null);
      }
    } else {
      setEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, status: "READ" } : e))
      );
      if (selectedEmail?.id === emailId) {
        setSelectedEmail({ ...selectedEmail, status: "READ" });
      }
    }
  };

  const handleBulkArchive = async () => {
    const ids = selectedEmailIds;
    if (ids.length === 0) return;

    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", ids }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to archive emails");
      return;
    }

    toast.success("Emails archived");
    setSelectedEmailIds([]);
    // Clear selected email if it was archived
    if (selectedEmailId && ids.includes(selectedEmailId)) {
      setSelectedEmailId(null);
      setSelectedEmail(null);
    }
    // Refresh list to get correct data
    if (statusFilter !== "archived") {
      setEmailsRefreshKey((k) => k + 1);
    } else {
      setEmails((prev) =>
        prev.map((e) => (ids.includes(e.id) ? { ...e, status: "ARCHIVED" } : e))
      );
      setSelectedEmail((prev) =>
        prev && ids.includes(prev.id) ? { ...prev, status: "ARCHIVED" } : prev
      );
    }
  };

  const handleStatusFilterChange = (filter: EmailStatusFilter) => {
    setStatusFilter(filter);
    setEmailsPage(1);
    setSelectedEmailIds([]);
  };

  const handleTagFilterChange = (tagId: string | null) => {
    setSelectedTagId(tagId);
    setEmailsPage(1);
    setSelectedEmailIds([]);
  };

  const handleUpdateEmailTags = useCallback(async (
    emailId: string,
    patch: { add?: string[]; remove?: string[] }
  ) => {
    const res = await fetch(`/api/emails/${emailId}/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      toast.error(data?.error || "Failed to update tags");
      return false;
    }

    const nextTags = Array.isArray(data?.tags) ? data.tags : [];
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, tags: nextTags } : e)));
    setSelectedEmail((prev) => (prev?.id === emailId ? { ...prev, tags: nextTags } : prev));

    await loadTags();
    setEmailsRefreshKey((k) => k + 1);
    return true;
  }, [loadTags]);

  const handleBulkMarkRead = async () => {
    const ids = selectedEmailIds;
    if (ids.length === 0) return;

    // Count unread emails per mailbox before marking
    const unreadCountByMailbox = new Map<string, number>();
    for (const e of emails) {
      if (ids.includes(e.id) && e.status === "UNREAD") {
        unreadCountByMailbox.set(e.mailboxId, (unreadCountByMailbox.get(e.mailboxId) || 0) + 1);
      }
    }

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
    setSelectedEmailIds([]);

    // Update mailbox unread counts
    setMailboxes((prev) =>
      prev.map((m) => {
        const decrement = unreadCountByMailbox.get(m.id) || 0;
        if (decrement > 0) {
          return { ...m, _count: { emails: Math.max(0, m._count.emails - decrement) } };
        }
        return m;
      })
    );

    // Refresh list when viewing unread filter (marked emails should disappear)
    if (statusFilter === "unread") {
      setEmailsRefreshKey((k) => k + 1);
    } else {
      setEmails((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, status: "READ" } : e)));
      setSelectedEmail((prev) => (prev && ids.includes(prev.id) ? { ...prev, status: "READ" } : prev));
    }
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
    setSelectedEmailIds([]);
    setBulkDeleteOpen(false);
    // Clear selected email if it was deleted
    if (selectedEmailId && ids.includes(selectedEmailId)) {
      setSelectedEmailId(null);
      setSelectedEmail(null);
    }
    // Refresh list to get correct data
    setEmailsRefreshKey((k) => k + 1);
  };

  const handleEmailSearchChange = (value: string) => {
    setEmailSearch(value);
    setEmailsPage(1);
  };

  const handleEmailsPageSizeChange = (value: number) => {
    const next = Math.min(100, Math.max(1, value));
    setEmailsPageSize(next);
    setEmailsPage(1);
  };

  const goPrevEmailsPage = () => {
    setEmailsPage((prev) => Math.max(1, prev - 1));
  };

  const goNextEmailsPage = () => {
    setEmailsPage((prev) => Math.min(emailsTotalPages, prev + 1));
  };

  const handleSelectMailbox = (mailboxId: string | null) => {
    setSelectedMailboxId(mailboxId);
    setSelectedEmailId(null);
    setEmailSearch("");
    setEmailsPage(1);
    setStatusFilter("all");
  };

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

  const handleCopyMailboxAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Copied to clipboard");
  };

  const handleCopySenderAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Sender address copied");
  };

  const handleMarkEmailRead = async (emailId: string) => {
    const email = emails.find((e) => e.id === emailId);
    if (!email || email.status !== "UNREAD") return;

    // Optimistic UI update
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) => (prev?.id === emailId ? { ...prev, status: "READ" } : prev));

    // Decrement unread count for the mailbox
    setMailboxes((prev) =>
      prev.map((m) =>
        m.id === email.mailboxId
          ? { ...m, _count: { emails: Math.max(0, m._count.emails - 1) } }
          : m
      )
    );

    // Persist
    fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READ" }),
    }).catch(() => {
      // ignore
    });
  };

  const handleRefreshImap = async () => {
    if (refreshingImap || refreshCooldown > 0) return;
    setRefreshingImap(true);
    try {
      const res = await fetch("/api/imap/sync", { method: "POST" });
      const data = await res.json().catch(() => null);

      if (res.status === 429) {
        // Rate limited - set cooldown timer
        const remainingMs = data?.remainingMs || 30000;
        setRefreshCooldown(Math.ceil(remainingMs / 1000));
        toast.error(data?.message || "Please wait before refreshing again");
        return;
      }

      if (!res.ok) {
        toast.error(data?.error || "Failed to refresh");
        return;
      }
      toast.success(data?.message || "Refresh triggered");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setRefreshingImap(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-[calc(100vh-theme(spacing.24))]">
        {/* Mobile Layout - Tabs */}
        <Tabs
          value={mobileTab}
          onValueChange={(v) => setMobileTab(v as typeof mobileTab)}
          className="flex flex-col h-full lg:hidden"
        >
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="mailboxes" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              <span className="hidden sm:inline">Mailboxes</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="gap-1.5">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Emails</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5 relative">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
              {selectedEmailId && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mailboxes" className="flex-1 min-h-0 mt-4 data-[state=inactive]:hidden">
            <MailboxesPanel
              ungroupedSelectValue={UNGROUPED_SELECT_VALUE}
              domains={domains}
              groups={groups}
              mailboxes={mailboxes}
              groupedMailboxes={groupedMailboxes}
              collapsedGroups={collapsedGroups}
              loadingDomains={loadingDomains}
              loadingGroups={loadingGroups}
              loadingMailboxes={loadingMailboxes}
              mailboxSearch={mailboxSearch}
              selectedMailboxId={selectedMailboxId}
              notificationsEnabled={notificationsEnabled}
              mailboxDialogOpen={mailboxDialogOpen}
              groupDialogOpen={groupDialogOpen}
              renameDialogOpen={renameDialogOpen}
              newMailboxPrefix={newMailboxPrefix}
              newMailboxDomainId={newMailboxDomainId}
              newMailboxGroupId={newMailboxGroupId}
              newMailboxNote={newMailboxNote}
              creatingMailbox={creatingMailbox}
              newGroupName={newGroupName}
              creatingGroup={creatingGroup}
              renameGroupName={renameGroupName}
              renamingGroup={renamingGroup}
              onToggleNotifications={toggleNotifications}
              onMailboxSearchChange={setMailboxSearch}
              onSelectMailbox={(id) => {
                handleSelectMailbox(id);
                setMobileTab("emails");
              }}
              onMailboxDialogOpenChange={setMailboxDialogOpen}
              onGroupDialogOpenChange={setGroupDialogOpen}
              onRenameDialogOpenChange={setRenameDialogOpen}
              onNewMailboxDomainIdChange={setNewMailboxDomainId}
              onNewMailboxPrefixChange={setNewMailboxPrefix}
              onGenerateRandomPrefix={generateRandomPrefix}
              onNewMailboxGroupIdChange={setNewMailboxGroupId}
              onNewMailboxNoteChange={setNewMailboxNote}
              onCreateMailbox={handleCreateMailbox}
              onNewGroupNameChange={setNewGroupName}
              onCreateGroup={handleCreateGroup}
              onRenameGroupNameChange={setRenameGroupName}
              onRenameGroupSave={handleRenameGroup}
              onToggleGroupCollapse={toggleGroup}
              onOpenRenameGroup={openRenameGroup}
              onRequestDeleteGroup={handleDeleteGroup}
              onStarMailbox={handleStarMailbox}
              onMoveMailboxToGroup={handleMoveMailboxToGroup}
              onRequestDeleteMailbox={handleDeleteMailbox}
              onCopyMailboxAddress={handleCopyMailboxAddress}
              onRefreshImap={handleRefreshImap}
              refreshingImap={refreshingImap}
              refreshCooldown={refreshCooldown}
            />
          </TabsContent>

          <TabsContent value="emails" className="flex-1 min-h-0 mt-4 data-[state=inactive]:hidden">
            <EmailsPanel
              emailSearch={emailSearch}
              tags={availableTags}
              selectedTagId={selectedTagId}
              emails={emails}
              loadingEmails={loadingEmails}
              page={emailsPage}
              pages={emailsTotalPages}
              pageSize={emailsPageSize}
              selectedEmailId={selectedEmailId}
              selectedEmailIds={selectedEmailIds}
              selectedEmailIdSet={selectedEmailIdSet}
              allSelectedOnPage={allSelectedOnPage}
              someSelectedOnPage={someSelectedOnPage}
              statusFilter={statusFilter}
              unreadCount={unreadCount}
              onEmailSearchChange={handleEmailSearchChange}
              onPageSizeChange={handleEmailsPageSizeChange}
              onTagFilterChange={handleTagFilterChange}
              onUpdateEmailTags={handleUpdateEmailTags}
              onSelectEmail={(email) => {
                handleSelectEmail(email);
                setMobileTab("preview");
              }}
              onToggleSelectAllOnPage={toggleSelectAllOnPage}
              onToggleEmailSelection={toggleEmailSelection}
              onBulkMarkRead={handleBulkMarkRead}
              onBulkArchive={handleBulkArchive}
              onOpenBulkDelete={() => setBulkDeleteOpen(true)}
              onClearSelection={() => setSelectedEmailIds([])}
              onStarEmail={handleStarEmail}
              onDeleteEmail={handleDeleteEmail}
              onMarkEmailRead={handleMarkEmailRead}
              onArchiveEmail={handleArchiveEmail}
              onUnarchiveEmail={handleUnarchiveEmail}
              onCopySenderAddress={handleCopySenderAddress}
              onPrevPage={goPrevEmailsPage}
              onNextPage={goNextEmailsPage}
              onStatusFilterChange={handleStatusFilterChange}
            />
          </TabsContent>

          <TabsContent value="preview" className="flex-1 min-h-0 mt-4 data-[state=inactive]:hidden">
          <PreviewPanel
            key={selectedEmailId ?? "none"}
            selectedEmailId={selectedEmailId}
            selectedEmail={selectedEmail}
            loadingPreview={loadingPreview}
          />
        </TabsContent>
        </Tabs>

        {/* Desktop Layout - Grid */}
        <div className="hidden lg:grid gap-4 h-full grid-cols-[280px_minmax(320px,420px)_minmax(420px,1fr)]">
          <MailboxesPanel
            ungroupedSelectValue={UNGROUPED_SELECT_VALUE}
            domains={domains}
            groups={groups}
            mailboxes={mailboxes}
            groupedMailboxes={groupedMailboxes}
            collapsedGroups={collapsedGroups}
            loadingDomains={loadingDomains}
            loadingGroups={loadingGroups}
            loadingMailboxes={loadingMailboxes}
            mailboxSearch={mailboxSearch}
            selectedMailboxId={selectedMailboxId}
            notificationsEnabled={notificationsEnabled}
            mailboxDialogOpen={mailboxDialogOpen}
            groupDialogOpen={groupDialogOpen}
            renameDialogOpen={renameDialogOpen}
            newMailboxPrefix={newMailboxPrefix}
            newMailboxDomainId={newMailboxDomainId}
            newMailboxGroupId={newMailboxGroupId}
            newMailboxNote={newMailboxNote}
            creatingMailbox={creatingMailbox}
            newGroupName={newGroupName}
            creatingGroup={creatingGroup}
            renameGroupName={renameGroupName}
            renamingGroup={renamingGroup}
            onToggleNotifications={toggleNotifications}
            onMailboxSearchChange={setMailboxSearch}
            onSelectMailbox={handleSelectMailbox}
            onMailboxDialogOpenChange={setMailboxDialogOpen}
            onGroupDialogOpenChange={setGroupDialogOpen}
            onRenameDialogOpenChange={setRenameDialogOpen}
            onNewMailboxDomainIdChange={setNewMailboxDomainId}
            onNewMailboxPrefixChange={setNewMailboxPrefix}
            onGenerateRandomPrefix={generateRandomPrefix}
            onNewMailboxGroupIdChange={setNewMailboxGroupId}
            onNewMailboxNoteChange={setNewMailboxNote}
            onCreateMailbox={handleCreateMailbox}
            onNewGroupNameChange={setNewGroupName}
            onCreateGroup={handleCreateGroup}
            onRenameGroupNameChange={setRenameGroupName}
            onRenameGroupSave={handleRenameGroup}
            onToggleGroupCollapse={toggleGroup}
            onOpenRenameGroup={openRenameGroup}
            onRequestDeleteGroup={handleDeleteGroup}
            onStarMailbox={handleStarMailbox}
            onMoveMailboxToGroup={handleMoveMailboxToGroup}
            onRequestDeleteMailbox={handleDeleteMailbox}
            onCopyMailboxAddress={handleCopyMailboxAddress}
            onRefreshImap={handleRefreshImap}
            refreshingImap={refreshingImap}
            refreshCooldown={refreshCooldown}
          />

          <EmailsPanel
            emailSearch={emailSearch}
            tags={availableTags}
            selectedTagId={selectedTagId}
            emails={emails}
            loadingEmails={loadingEmails}
            page={emailsPage}
            pages={emailsTotalPages}
            pageSize={emailsPageSize}
            selectedEmailId={selectedEmailId}
            selectedEmailIds={selectedEmailIds}
            selectedEmailIdSet={selectedEmailIdSet}
            allSelectedOnPage={allSelectedOnPage}
            someSelectedOnPage={someSelectedOnPage}
            statusFilter={statusFilter}
            unreadCount={unreadCount}
            onEmailSearchChange={handleEmailSearchChange}
            onPageSizeChange={handleEmailsPageSizeChange}
            onTagFilterChange={handleTagFilterChange}
            onUpdateEmailTags={handleUpdateEmailTags}
            onSelectEmail={handleSelectEmail}
            onToggleSelectAllOnPage={toggleSelectAllOnPage}
            onToggleEmailSelection={toggleEmailSelection}
            onBulkMarkRead={handleBulkMarkRead}
            onBulkArchive={handleBulkArchive}
            onOpenBulkDelete={() => setBulkDeleteOpen(true)}
            onClearSelection={() => setSelectedEmailIds([])}
            onStarEmail={handleStarEmail}
            onDeleteEmail={handleDeleteEmail}
            onMarkEmailRead={handleMarkEmailRead}
            onArchiveEmail={handleArchiveEmail}
            onUnarchiveEmail={handleUnarchiveEmail}
            onCopySenderAddress={handleCopySenderAddress}
            onPrevPage={goPrevEmailsPage}
            onNextPage={goNextEmailsPage}
            onStatusFilterChange={handleStatusFilterChange}
          />

          <PreviewPanel
            key={selectedEmailId ?? "none"}
            selectedEmailId={selectedEmailId}
            selectedEmail={selectedEmail}
            loadingPreview={loadingPreview}
          />
        </div>

        <ConfirmDialogs
          deleteEmailId={deleteEmailId}
          bulkDeleteOpen={bulkDeleteOpen}
          selectedEmailCount={selectedEmailIds.length}
          deleteMailboxId={deleteMailboxId}
          deleteGroup={deleteGroup}
          deleting={deleting}
          mailboxes={mailboxes}
          onDeleteEmailIdChange={setDeleteEmailId}
          onBulkDeleteOpenChange={setBulkDeleteOpen}
          onDeleteMailboxIdChange={setDeleteMailboxId}
          onDeleteGroupChange={setDeleteGroup}
          onConfirmDeleteEmail={confirmDeleteEmail}
          onConfirmBulkDelete={confirmBulkDelete}
          onConfirmDeleteMailbox={confirmDeleteMailbox}
          onConfirmDeleteGroup={confirmDeleteGroup}
        />
      </div>
    </TooltipProvider>
  );
}
