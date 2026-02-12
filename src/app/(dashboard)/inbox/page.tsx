"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectRealtime } from "@/lib/realtime/client";
import { isVercelDeployment } from "@/lib/deployment/public";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getApiErrorMessage, type Translator } from "@/lib/policy-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Inbox, Mail, Eye } from "lucide-react";
import { ConfirmDialogs } from "./_components/ConfirmDialogs";
import { ConnectPersonalImapDialog } from "./_components/ConnectPersonalImapDialog";
import { EditMailboxNoteDialog } from "./_components/EditMailboxNoteDialog";
import { EmailsPanel, type EmailStatusFilter } from "./_components/EmailsPanel";
import { MailboxesPanel } from "./_components/MailboxesPanel";
import { PreviewPanel } from "./_components/PreviewPanel";
import type { Domain, EmailDetail, EmailListItem, Mailbox, MailboxGroup, Tag } from "./types";

const INBOX_DESKTOP_LAYOUT_MODE_KEY = "temail.inbox.desktopLayoutMode";

function getInboxDesktopLayoutMode(): "three" | "two" {
  if (typeof window === "undefined") return "three";
  try {
    const raw = localStorage.getItem(INBOX_DESKTOP_LAYOUT_MODE_KEY);
    return raw === "two" ? "two" : "three";
  } catch {
    return "three";
  }
}

export default function InboxPage() {
  const vercelMode = isVercelDeployment();
  const [desktopLayoutMode, setDesktopLayoutMode] = useState<"three" | "two">("three");
  const UNGROUPED_SELECT_VALUE = "__ungrouped__";
  const NOTIFICATIONS_ENABLED_KEY = "temail.notificationsEnabled";
  const EMAILS_PAGE_SIZE_STORAGE_KEY = "temail.inbox.emailsPageSize";
  const SKIP_EMAIL_DELETE_CONFIRM_KEY = "temail.inbox.skipEmailDeleteConfirm";
  const DEFAULT_EMAILS_PAGE_SIZE = 15;
  const DEFAULT_MAILBOXES_PAGE_SIZE = 5;
  const t = useTranslations("inbox");
  const tPolicy = useTranslations("policy") as unknown as Translator;
  const [mailboxSearch, setMailboxSearch] = useState("");
  const [showArchivedMailboxes, setShowArchivedMailboxes] = useState(false);
  const [emailSearch, setEmailSearch] = useState("");
  const mailboxSearchQuery = mailboxSearch.trim();
  const isMailboxSearchMode = mailboxSearchQuery.length > 0;
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsTotalPages, setEmailsTotalPages] = useState(1);
  const [emailsPageSize, setEmailsPageSize] = useState(DEFAULT_EMAILS_PAGE_SIZE);
  const [emailsPageSizeLoaded, setEmailsPageSizeLoaded] = useState(false);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [groups, setGroups] = useState<MailboxGroup[]>([]);
  const [mailboxesByGroupKey, setMailboxesByGroupKey] = useState<Record<string, Mailbox[]>>({});
  const [mailboxPaginationByGroupKey, setMailboxPaginationByGroupKey] = useState<
    Record<string, { page: number; pages: number; total: number; limit: number }>
  >({});
  const [loadingMailboxesByGroupKey, setLoadingMailboxesByGroupKey] = useState<Record<string, boolean>>({});
  const [mailboxErrorsByGroupKey, setMailboxErrorsByGroupKey] = useState<Record<string, string | null>>({});
  const [mailboxSearchPage, setMailboxSearchPage] = useState(1);
  const [mailboxSearchPages, setMailboxSearchPages] = useState(1);
  const [mailboxSearchTotal, setMailboxSearchTotal] = useState(0);
  const [mailboxSearchResults, setMailboxSearchResults] = useState<Mailbox[]>([]);
  const [loadingMailboxSearch, setLoadingMailboxSearch] = useState(false);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);

  const [loadingDomains, setLoadingDomains] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false);
  const [personalImapDialogOpen, setPersonalImapDialogOpen] = useState(false);
  const [creatingMailbox, setCreatingMailbox] = useState(false);
  const [newMailboxPrefix, setNewMailboxPrefix] = useState("");
  const [newMailboxDomainId, setNewMailboxDomainId] = useState("");
  const [newMailboxGroupId, setNewMailboxGroupId] = useState<string>("");
  const [newMailboxNote, setNewMailboxNote] = useState("");
  const [newMailboxExpireMailboxDaysOverride, setNewMailboxExpireMailboxDaysOverride] = useState("");
  const [newMailboxExpireMailboxActionOverride, setNewMailboxExpireMailboxActionOverride] = useState("");
  const [newMailboxExpireEmailDaysOverride, setNewMailboxExpireEmailDaysOverride] = useState("");
  const [newMailboxExpireEmailActionOverride, setNewMailboxExpireEmailActionOverride] = useState("");

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState("");
  const [reorderingGroups, setReorderingGroups] = useState(false);

  const [editMailboxNoteDialogOpen, setEditMailboxNoteDialogOpen] = useState(false);
  const [editMailboxNoteMailboxId, setEditMailboxNoteMailboxId] = useState<string | null>(null);
  const [editMailboxNoteMailboxAddress, setEditMailboxNoteMailboxAddress] = useState<string | null>(null);
  const [editMailboxNoteValue, setEditMailboxNoteValue] = useState("");
  const [savingMailboxNote, setSavingMailboxNote] = useState(false);

  // Delete confirmation dialog states
  const [deleteEmailId, setDeleteEmailId] = useState<string | null>(null);
  const [skipEmailDeleteConfirm, setSkipEmailDeleteConfirm] = useState(false);
  const [deleteMailboxId, setDeleteMailboxId] = useState<string | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<MailboxGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [refreshingImap, setRefreshingImap] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0); // remaining seconds
  const [mobileTab, setMobileTab] = useState<"mailboxes" | "emails" | "preview">("emails");
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilter>("all");
  const [emailsRefreshKey, setEmailsRefreshKey] = useState(0);

  const selectedEmailIdSet = useMemo(() => new Set(selectedEmailIds), [selectedEmailIds]);

  const groupedMailboxes = useMemo(() => {
    const items: Array<{ key: string; group: MailboxGroup | null; mailboxes: Mailbox[] }> = [];
    const groupIdSet = new Set<string>();

    for (const group of groups) {
      groupIdSet.add(group.id);
      items.push({
        key: group.id,
        group,
        mailboxes: mailboxesByGroupKey[group.id] || [],
      });
    }

    items.push({
      key: UNGROUPED_SELECT_VALUE,
      group: null,
      mailboxes: mailboxesByGroupKey[UNGROUPED_SELECT_VALUE] || [],
    });

    for (const [key, value] of Object.entries(mailboxesByGroupKey)) {
      if (key === UNGROUPED_SELECT_VALUE) continue;
      if (groupIdSet.has(key)) continue;
      items.push({ key, group: null, mailboxes: value });
    }

    return items;
  }, [groups, mailboxesByGroupKey, UNGROUPED_SELECT_VALUE]);

  const mailboxes = useMemo(() => {
    const byId = new Map<string, Mailbox>();
    for (const list of Object.values(mailboxesByGroupKey)) {
      for (const mailbox of list) {
        byId.set(mailbox.id, mailbox);
      }
    }
    for (const mailbox of mailboxSearchResults) {
      byId.set(mailbox.id, mailbox);
    }
    return Array.from(byId.values());
  }, [mailboxesByGroupKey, mailboxSearchResults]);

  const desktopMailboxBaseOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{
      id: string;
      address: string;
      note?: string | null;
      isStarred: boolean;
      group?: { id: string; name: string; color?: string | null } | null;
      _count: { emails: number };
    }> = [];
    for (const mailbox of mailboxes) {
      if (mailbox.archivedAt) continue;
      if (seen.has(mailbox.id)) continue;
      seen.add(mailbox.id);
      options.push({
        id: mailbox.id,
        address: mailbox.address,
        note: mailbox.note,
        isStarred: mailbox.isStarred,
        group: mailbox.group ? { id: mailbox.group.id, name: mailbox.group.name, color: mailbox.group.color } : null,
        _count: mailbox._count,
      });
    }
    options.sort((a, b) => a.address.localeCompare(b.address));
    return options;
  }, [mailboxes]);

  const mailboxCount = useMemo(() => {
    const groupedCount = groups.reduce((sum, group) => sum + (group._count?.mailboxes ?? 0), 0);
    const ungroupedTotal = mailboxPaginationByGroupKey[UNGROUPED_SELECT_VALUE]?.total;
    const ungroupedFallback = mailboxesByGroupKey[UNGROUPED_SELECT_VALUE]?.length ?? 0;
    return groupedCount + (typeof ungroupedTotal === "number" ? ungroupedTotal : ungroupedFallback);
  }, [groups, mailboxPaginationByGroupKey, mailboxesByGroupKey, UNGROUPED_SELECT_VALUE]);

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true);
    const res = await fetch("/api/domains");
    const data = await res.json();
    setDomains(Array.isArray(data) ? data : []);
    setLoadingDomains(false);
  }, []);

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    const params = new URLSearchParams();
    if (showArchivedMailboxes) {
      params.set("archived", "only");
    }
    const url = params.size ? `/api/mailbox-groups?${params.toString()}` : "/api/mailbox-groups";
    const res = await fetch(url);
    const data = await res.json();
    setGroups(Array.isArray(data) ? data : []);
    setLoadingGroups(false);
  }, [showArchivedMailboxes]);

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
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");

    if (action === "new-mailbox") {
      setMailboxDialogOpen(true);
    } else if (action === "connect-imap") {
      setPersonalImapDialogOpen(true);
    } else {
      return;
    }

    params.delete("action");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  const mailboxSearchLastQueryRef = useRef<string>("");
  const mailboxPrefetchScheduledRef = useRef<Set<string>>(new Set());

  const updateMailboxById = useCallback((mailboxId: string, updater: (mailbox: Mailbox) => Mailbox) => {
    setMailboxesByGroupKey((prev) => {
      let changed = false;
      const next: Record<string, Mailbox[]> = {};
      for (const [key, list] of Object.entries(prev)) {
        const index = list.findIndex((m) => m.id === mailboxId);
        if (index === -1) {
          next[key] = list;
          continue;
        }
        changed = true;
        const updated = [...list];
        updated[index] = updater(updated[index]);
        next[key] = updated;
      }
      return changed ? next : prev;
    });

    setMailboxSearchResults((prev) => {
      const index = prev.findIndex((m) => m.id === mailboxId);
      if (index === -1) return prev;
      const updated = [...prev];
      updated[index] = updater(updated[index]);
      return updated;
    });
  }, []);

  const closeEditMailboxNoteDialog = () => {
    setEditMailboxNoteDialogOpen(false);
    setEditMailboxNoteMailboxId(null);
    setEditMailboxNoteMailboxAddress(null);
    setEditMailboxNoteValue("");
  };

  const handleEditMailboxNoteDialogOpenChange = (open: boolean) => {
    if (open) {
      setEditMailboxNoteDialogOpen(true);
      return;
    }
    if (savingMailboxNote) return;
    closeEditMailboxNoteDialog();
  };

  const handleOpenEditMailboxNote = (mailbox: Mailbox) => {
    setEditMailboxNoteMailboxId(mailbox.id);
    setEditMailboxNoteMailboxAddress(mailbox.address);
    setEditMailboxNoteValue(mailbox.note || "");
    setEditMailboxNoteDialogOpen(true);
  };

  const handleSaveMailboxNote = async () => {
    if (!editMailboxNoteMailboxId) return;
    if (savingMailboxNote) return;

    setSavingMailboxNote(true);
    try {
      const trimmed = editMailboxNoteValue.trim();
      const note = trimmed ? trimmed : null;

      const res = await fetch(`/api/mailboxes/${editMailboxNoteMailboxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.mailboxes.updateFailed"));
        return;
      }

      updateMailboxById(editMailboxNoteMailboxId, (mailbox) => ({ ...mailbox, note }));
      toast.success(t("toast.mailboxes.updated"));
      closeEditMailboxNoteDialog();
    } catch {
      toast.error(t("toast.mailboxes.updateFailed"));
    } finally {
      setSavingMailboxNote(false);
    }
  };

  const loadMailboxGroupPage = useCallback(
    async (groupKey: string, page: number, options?: { replace?: boolean }) => {
      if (page < 1) return;

      setLoadingMailboxesByGroupKey((prev) => ({ ...prev, [groupKey]: true }));
      setMailboxErrorsByGroupKey((prev) => ({ ...prev, [groupKey]: null }));

      try {
        const params = new URLSearchParams();
        params.set("groupId", groupKey);
        params.set("page", String(page));
        params.set("limit", String(DEFAULT_MAILBOXES_PAGE_SIZE));
        if (showArchivedMailboxes) {
          params.set("archived", "only");
        }

        const res = await fetch(`/api/mailboxes/paginated?${params.toString()}`);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || t("toast.mailboxes.loadFailed"));
        }

        const items = Array.isArray(data?.mailboxes) ? data.mailboxes : [];
        const pages = Math.max(1, Number(data?.pagination?.pages || 1));
        const nextPage = Math.max(1, Number(data?.pagination?.page || page));
        const total = Math.max(0, Number(data?.pagination?.total || 0));
        const limit = Math.min(DEFAULT_MAILBOXES_PAGE_SIZE, Math.max(1, Number(data?.pagination?.limit || DEFAULT_MAILBOXES_PAGE_SIZE)));

        setMailboxPaginationByGroupKey((prev) => ({
          ...prev,
          [groupKey]: { page: nextPage, pages, total, limit },
        }));

        setMailboxesByGroupKey((prev) => ({ ...prev, [groupKey]: items }));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("toast.mailboxes.loadFailed");
        setMailboxErrorsByGroupKey((prev) => ({ ...prev, [groupKey]: message }));
      } finally {
        setLoadingMailboxesByGroupKey((prev) => ({ ...prev, [groupKey]: false }));
      }
    },
    [DEFAULT_MAILBOXES_PAGE_SIZE, showArchivedMailboxes, t]
  );

  const loadMailboxSearchPage = useCallback(
    async (search: string, page: number) => {
      if (!search.trim()) return;

      setLoadingMailboxSearch(true);
      try {
        const params = new URLSearchParams();
        params.set("search", search);
        params.set("page", String(page));
        params.set("limit", String(DEFAULT_MAILBOXES_PAGE_SIZE));
        if (showArchivedMailboxes) {
          params.set("archived", "only");
        }

        const res = await fetch(`/api/mailboxes/paginated?${params.toString()}`);
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || t("toast.mailboxes.loadFailed"));
        }

        const items = Array.isArray(data?.mailboxes) ? data.mailboxes : [];
        const pages = Math.max(1, Number(data?.pagination?.pages || 1));
        const total = Math.max(0, Number(data?.pagination?.total || 0));

        setMailboxSearchResults(items);
        setMailboxSearchTotal(total);
        setMailboxSearchPages(pages);

        if (page > pages) {
          setMailboxSearchPage(pages);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t("toast.mailboxes.loadFailed");
        toast.error(message);
        setMailboxSearchResults([]);
        setMailboxSearchTotal(0);
        setMailboxSearchPages(1);
      } finally {
        setLoadingMailboxSearch(false);
      }
    },
    [DEFAULT_MAILBOXES_PAGE_SIZE, showArchivedMailboxes, t]
  );

  useEffect(() => {
    if (!mailboxSearchQuery) {
      mailboxSearchLastQueryRef.current = "";
      setMailboxSearchResults([]);
      setMailboxSearchTotal(0);
      setMailboxSearchPages(1);
      setLoadingMailboxSearch(false);
      return;
    }

    const isQueryChanged = mailboxSearchLastQueryRef.current !== mailboxSearchQuery;
    mailboxSearchLastQueryRef.current = mailboxSearchQuery;
    const delayMs = isQueryChanged ? 250 : 0;

    const timer = setTimeout(() => {
      void loadMailboxSearchPage(mailboxSearchQuery, mailboxSearchPage);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [mailboxSearchQuery, mailboxSearchPage, loadMailboxSearchPage]);

  useEffect(() => {
    if (loadingGroups) return;
    if (isMailboxSearchMode) return;

    const candidateKeys: string[] = [UNGROUPED_SELECT_VALUE];
    for (const group of groups) {
      const count = group._count?.mailboxes;
      if (typeof count === "number" && count <= 0) continue;
      candidateKeys.push(group.id);
    }

    const toPrefetch: string[] = [];
    for (const key of candidateKeys) {
      if (mailboxPrefetchScheduledRef.current.has(key)) continue;
      if (loadingMailboxesByGroupKey[key]) continue;
      if (mailboxPaginationByGroupKey[key]?.page) continue;
      mailboxPrefetchScheduledRef.current.add(key);
      toPrefetch.push(key);
    }

    if (toPrefetch.length === 0) return;

    let cancelled = false;
    const queue = [...toPrefetch];
    const concurrency = 3;

    const worker = async () => {
      while (!cancelled) {
        const key = queue.shift();
        if (!key) return;
        await loadMailboxGroupPage(key, 1, { replace: true });
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => worker()
    );

    void Promise.all(workers);
    return () => {
      cancelled = true;
    };
  }, [
    groups,
    isMailboxSearchMode,
    loadingGroups,
    loadingMailboxesByGroupKey,
    mailboxPaginationByGroupKey,
    loadMailboxGroupPage,
    UNGROUPED_SELECT_VALUE,
  ]);

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
    setDesktopLayoutMode(getInboxDesktopLayoutMode());
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== INBOX_DESKTOP_LAYOUT_MODE_KEY) return;
      setDesktopLayoutMode(getInboxDesktopLayoutMode());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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
    try {
      const raw = localStorage.getItem(SKIP_EMAIL_DELETE_CONFIRM_KEY);
      setSkipEmailDeleteConfirm(raw === "1");
    } catch {
      // ignore
    }
  }, [SKIP_EMAIL_DELETE_CONFIRM_KEY]);

  const persistSkipEmailDeleteConfirm = (next: boolean) => {
    setSkipEmailDeleteConfirm(next);
    try {
      localStorage.setItem(SKIP_EMAIL_DELETE_CONFIRM_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  };

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
      if (!selectedMailboxId && showArchivedMailboxes) {
        params.set("mailboxArchived", "only");
      }

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
  }, [selectedMailboxId, selectedTagId, emailSearch, emailsPage, emailsPageSize, emailsPageSizeLoaded, statusFilter, emailsRefreshKey, showArchivedMailboxes]);

  const toggleNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast.error(t("notifications.unsupported"));
      return;
    }

    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      try {
        localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "0");
      } catch {
        // ignore
      }
      toast.message(t("notifications.disabled"));
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") {
      toast.error(t("notifications.permissionNotGranted"));
      return;
    }

    setNotificationsEnabled(true);
    try {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "1");
    } catch {
      // ignore
    }
    toast.success(t("notifications.enabled"));
  };

	  useEffect(() => {
	    if (vercelMode) return;

	    const disconnect = connectRealtime({
	      onEvent: (event) => {
	        if (event.type === "email.created") {
	          if (notificationsEnabled && notificationPermission === "granted") {
	            try {
	              const n = new Notification(event.data.email.subject || t("email.noSubject"), {
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
          const allowListUpdate = !showArchivedMailboxes || Boolean(selectedMailboxId);
          const matchesMailbox =
            allowListUpdate && (!selectedMailboxId || event.data.email.mailboxId === selectedMailboxId);
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
            updateMailboxById(event.data.email.mailboxId, (mailbox) => ({
              ...mailbox,
              _count: { emails: mailbox._count.emails + 1 },
            }));
          }
          return;
        }

        if (event.type === "email.updated") {
          if (event.data.status === "DELETED") {
            setSelectedEmailIds((prev) => prev.filter((id) => id !== event.data.id));
            setSelectedEmailId((current) => (current === event.data.id ? null : current));
            setSelectedEmail((prev) => (prev?.id === event.data.id ? null : prev));
            setEmails((prev) => prev.filter((e) => e.id !== event.data.id));
            return;
          }
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

        if (event.type === "mailbox.mark_read") {
          if (event.data.count <= 0) return;
          updateMailboxById(event.data.mailboxId, (mailbox) => ({
            ...mailbox,
            _count: { emails: Math.max(0, mailbox._count.emails - event.data.count) },
          }));
          setSelectedEmail((prev) =>
            prev && prev.mailboxId === event.data.mailboxId && prev.status === "UNREAD"
              ? { ...prev, status: "READ" }
              : prev
          );
          setEmailsRefreshKey((k) => k + 1);
        }
	      },
	    });

	    return disconnect;
		  }, [notificationsEnabled, notificationPermission, selectedMailboxId, emailSearch, emailsPage, emailsPageSize, showArchivedMailboxes, t, updateMailboxById, vercelMode]);

  useEffect(() => {
    if (!vercelMode) return;
    if (!emailsPageSizeLoaded) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setEmailsRefreshKey((k) => k + 1);
    }, 15_000);

    return () => clearInterval(interval);
  }, [emailSearch, emailsPageSizeLoaded, selectedMailboxId, selectedTagId, statusFilter, vercelMode]);

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
    const nextCollapsed = !collapsedGroups[key];
    if (!nextCollapsed) {
      const alreadyLoaded = Boolean(mailboxPaginationByGroupKey[key]?.page);
      const loading = Boolean(loadingMailboxesByGroupKey[key]);
      if (!alreadyLoaded && !loading) {
        void loadMailboxGroupPage(key, 1, { replace: true });
      }
    }
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

  const moveEmailToTrash = async (id: string) => {
    const emailInList = emails.find((e) => e.id === id);
    const emailForCount = emailInList || (selectedEmail?.id === id ? selectedEmail : null);
    const shouldDecrementUnread =
      emailForCount?.status === "UNREAD" && typeof emailForCount?.mailboxId === "string";

	    setDeleting(true);
	    const res = await fetch(`/api/emails/${id}`, { method: "DELETE" });
	    setDeleting(false);
	    if (!res.ok) {
	      toast.error(t("toast.trash.failed"));
	      return false;
	    }

    toast.success(t("toast.trash.moved"));

    if (shouldDecrementUnread) {
      updateMailboxById(emailForCount.mailboxId, (mailbox) => ({
        ...mailbox,
        _count: { emails: Math.max(0, mailbox._count.emails - 1) },
      }));
    }

    setSelectedEmailIds((prev) => prev.filter((x) => x !== id));
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedEmailId === id) {
      setSelectedEmailId(null);
      setSelectedEmail(null);
    }
    setDeleteEmailId(null);
    return true;
  };

  const handleDeleteEmail = async (id: string) => {
    if (skipEmailDeleteConfirm) {
      void moveEmailToTrash(id);
      return;
    }
    setDeleteEmailId(id);
  };

  const confirmDeleteEmail = async () => {
    if (!deleteEmailId) return;
    void moveEmailToTrash(deleteEmailId);
  };

  const handleSelectEmail = async (email: EmailListItem) => {
    setSelectedEmailId(email.id);

    if (email.status !== "UNREAD") return;

    // Optimistic UI update
    setEmails((prev) => prev.map((e) => (e.id === email.id ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) => (prev?.id === email.id ? { ...prev, status: "READ" } : prev));

    // Decrement unread count for the mailbox
    updateMailboxById(email.mailboxId, (mailbox) => ({
      ...mailbox,
      _count: { emails: Math.max(0, mailbox._count.emails - 1) },
    }));

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

  const handleMultiSelectModeChange = (enabled: boolean) => {
    setMultiSelectMode(enabled);
    if (!enabled) {
      setSelectedEmailIds([]);
      setBulkDeleteOpen(false);
    }
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
	      toast.error(t("toast.email.archiveFailed"));
	      return;
	    }

	    toast.success(t("toast.email.archived"));
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
	      toast.error(t("toast.email.unarchiveFailed"));
	      return;
	    }

	    toast.success(t("toast.email.unarchived"));
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
	      toast.error(data?.error || t("toast.bulk.archiveFailed"));
	      return;
	    }

	    toast.success(t("toast.bulk.archived"));
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

  const handleBulkUnarchive = async () => {
    const ids = selectedEmailIds;
    if (ids.length === 0) return;

    const res = await fetch("/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchive", ids }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || t("toast.bulk.unarchiveFailed"));
      return;
    }

    toast.success(t("toast.bulk.unarchived"));
    setSelectedEmailIds([]);

    if (statusFilter === "archived") {
      setEmails((prev) => prev.filter((e) => !ids.includes(e.id)));
      if (selectedEmailId && ids.includes(selectedEmailId)) {
        setSelectedEmailId(null);
        setSelectedEmail(null);
      }
      return;
    }

    setEmails((prev) => prev.map((e) => (ids.includes(e.id) ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) =>
      prev && ids.includes(prev.id) ? { ...prev, status: "READ" } : prev
    );
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
	      toast.error(data?.error || t("toast.tags.updateFailed"));
	      return false;
	    }

    const nextTags = Array.isArray(data?.tags) ? data.tags : [];
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, tags: nextTags } : e)));
    setSelectedEmail((prev) => (prev?.id === emailId ? { ...prev, tags: nextTags } : prev));

    await loadTags();
    setEmailsRefreshKey((k) => k + 1);
    return true;
	  }, [loadTags, t]);

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
	      toast.error(data?.error || t("toast.bulk.markReadFailed"));
	      return;
	    }

    toast.success(t("toast.bulk.markedRead"));
    setSelectedEmailIds([]);

    // Update mailbox unread counts
    for (const [mailboxId, decrement] of unreadCountByMailbox.entries()) {
      if (decrement <= 0) continue;
      updateMailboxById(mailboxId, (mailbox) => ({
        ...mailbox,
        _count: { emails: Math.max(0, mailbox._count.emails - decrement) },
      }));
    }

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
	      toast.error(data?.error || t("toast.trash.failed"));
	      return;
	    }

	    toast.success(t("toast.trash.moved"));
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

  const openBulkDelete = () => {
    if (skipEmailDeleteConfirm) {
      void confirmBulkDelete();
      return;
    }
    setBulkDeleteOpen(true);
  };

  const handleMailboxSearchChange = (value: string) => {
    setMailboxSearch(value);
    setMailboxSearchPage(1);
  };

  const handleToggleArchivedMailboxes = () => {
    const next = !showArchivedMailboxes;
    if (selectedMailboxId) {
      const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId) || null;
      const selectedIsArchived = Boolean(selectedMailbox?.archivedAt);
      if ((next && !selectedIsArchived) || (!next && selectedIsArchived)) {
        handleSelectMailbox(null);
      }
    }

    mailboxPrefetchScheduledRef.current.clear();
    setMailboxesByGroupKey({});
    setMailboxPaginationByGroupKey({});
    setMailboxErrorsByGroupKey({});
    setLoadingMailboxesByGroupKey({});
    setMailboxSearchResults([]);
    setMailboxSearchTotal(0);
    setMailboxSearchPages(1);
    setMailboxSearchPage(1);

    setShowArchivedMailboxes(next);
  };

  const goPrevMailboxSearchPage = () => {
    setMailboxSearchPage((prev) => Math.max(1, prev - 1));
  };

  const goNextMailboxSearchPage = () => {
    setMailboxSearchPage((prev) => Math.min(mailboxSearchPages, prev + 1));
  };

  const goPrevGroupMailboxesPage = (key: string) => {
    const pagination = mailboxPaginationByGroupKey[key];
    const page = pagination?.page ?? 1;
    if (page <= 1) return;
    void loadMailboxGroupPage(key, page - 1, { replace: true });
  };

  const goNextGroupMailboxesPage = (key: string) => {
    const pagination = mailboxPaginationByGroupKey[key];
    const page = pagination?.page ?? 1;
    const pages = pagination?.pages ?? 1;
    if (page >= pages) return;
    void loadMailboxGroupPage(key, page + 1, { replace: true });
  };

  const retryGroupMailboxes = (key: string) => {
    void loadMailboxGroupPage(key, 1, { replace: true });
  };

  const handleEmailSearchChange = (value: string) => {
    setEmailSearch(value);
    setEmailsPage(1);
  };

  const handlePersonalImapConnected = useCallback(async () => {
    setMailboxSearch("");
    setMailboxSearchPage(1);
    await loadGroups();
    await loadMailboxGroupPage(UNGROUPED_SELECT_VALUE, 1, { replace: true });
  }, [UNGROUPED_SELECT_VALUE, loadGroups, loadMailboxGroupPage]);

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
	      toast.error(t("toast.groups.nameRequired"));
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
	        toast.error(data?.error || t("toast.groups.createFailed"));
	        return;
	      }

	      setGroups((prev) => [...prev, data]);
	      toast.success(t("toast.groups.created"));
	      setNewGroupName("");
	      setGroupDialogOpen(false);
	    } catch {
	      toast.error(t("toast.groups.createFailed"));
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

  const parseRetentionDaysOverride = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || (parsed !== -1 && parsed <= 0) || parsed > 3650) {
      return Number.NaN;
    }
    return parsed;
  };

  const handleCreateMailbox = async () => {
	    const prefix = newMailboxPrefix.trim();
	    if (!prefix || !newMailboxDomainId) {
	      toast.error(t("toast.mailboxes.requiredFields"));
	      return;
	    }

    const groupId = newMailboxGroupId || undefined;
    const expireMailboxDaysOverride = parseRetentionDaysOverride(newMailboxExpireMailboxDaysOverride);
    if (Number.isNaN(expireMailboxDaysOverride)) {
      toast.error(t("toast.mailboxes.retentionDaysInvalid"));
      return;
    }
    const expireEmailDaysOverride = parseRetentionDaysOverride(newMailboxExpireEmailDaysOverride);
    if (Number.isNaN(expireEmailDaysOverride)) {
      toast.error(t("toast.mailboxes.retentionDaysInvalid"));
      return;
    }

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
          expireMailboxDaysOverride,
          expireMailboxActionOverride: newMailboxExpireMailboxActionOverride || undefined,
          expireEmailDaysOverride,
          expireEmailActionOverride: newMailboxExpireEmailActionOverride || undefined,
        }),
      });

	      const data = await res.json();
	      if (!res.ok) {
	        toast.error(getApiErrorMessage(tPolicy, data, t("toast.mailboxes.createFailed")));
	        return;
	      }

      toast.success(t("toast.mailboxes.created"));
      setMailboxDialogOpen(false);
      setNewMailboxPrefix("");
      setNewMailboxDomainId("");
      setNewMailboxGroupId("");
      setNewMailboxNote("");
      setNewMailboxExpireMailboxDaysOverride("");
      setNewMailboxExpireMailboxActionOverride("");
      setNewMailboxExpireEmailDaysOverride("");
      setNewMailboxExpireEmailActionOverride("");
      const groupKey = groupId || UNGROUPED_SELECT_VALUE;
      setMailboxSearchPage(1);
      setMailboxSearch("");
      await loadGroups();
      await loadMailboxGroupPage(groupKey, 1, { replace: true });
    } catch {
      toast.error(t("toast.mailboxes.createFailed"));
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
	      toast.error(t("toast.groups.nameRequired"));
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
        toast.error(data?.error || t("toast.groups.renameFailed"));
        return;
      }

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, name } : g))
      );
      toast.success(t("toast.groups.renamed"));
      setRenameDialogOpen(false);
	    } catch {
	      toast.error(t("toast.groups.renameFailed"));
	    } finally {
      setRenamingGroup(false);
    }
	  };

  const handleReorderGroups = async (orderedGroupIds: string[]) => {
    if (reorderingGroups) return;
    if (showArchivedMailboxes) return;
    if (orderedGroupIds.length <= 1) return;

    const prevGroups = groups;
    if (prevGroups.length <= 1) return;

    const groupById = new Map(prevGroups.map((group) => [group.id, group]));
    const nextGroups: MailboxGroup[] = [];

    for (const id of orderedGroupIds) {
      const group = groupById.get(id);
      if (!group) continue;
      nextGroups.push(group);
    }

    const nextIdSet = new Set(nextGroups.map((group) => group.id));
    for (const group of prevGroups) {
      if (!nextIdSet.has(group.id)) {
        nextGroups.push(group);
      }
    }

    if (nextGroups.length !== prevGroups.length) return;

    setGroups(nextGroups);
    setReorderingGroups(true);
    try {
      const res = await fetch("/api/mailbox-groups/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: nextGroups.map((group) => group.id) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("toast.groups.reorderFailed"));
        setGroups(prevGroups);
      }
    } catch {
      toast.error(t("toast.groups.reorderFailed"));
      setGroups(prevGroups);
    } finally {
      setReorderingGroups(false);
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
	      toast.error(data?.error || t("toast.groups.deleteFailed"));
	      return;
	    }

    setGroups((prev) => prev.filter((g) => g.id !== deleteGroup.id));
    setMailboxesByGroupKey((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
    });
    setMailboxPaginationByGroupKey((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
    });
    setLoadingMailboxesByGroupKey((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
    });
    setMailboxErrorsByGroupKey((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
    });
    mailboxPrefetchScheduledRef.current.delete(deleteGroup.id);
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      delete next[deleteGroup.id];
      return next;
	    });
	    toast.success(t("toast.groups.deleted"));
	    setDeleteGroup(null);
      await loadGroups();
      await loadMailboxGroupPage(UNGROUPED_SELECT_VALUE, 1, { replace: true });
	  };

  const handleMoveMailboxToGroup = async (mailboxId: string, groupId: string | null) => {
    const mailboxInSearch = mailboxSearchResults.find((m) => m.id === mailboxId) || null;
    let mailboxInGroups = mailboxInSearch;
    if (!mailboxInGroups) {
      for (const list of Object.values(mailboxesByGroupKey)) {
        const found = list.find((m) => m.id === mailboxId) || null;
        if (found) {
          mailboxInGroups = found;
          break;
        }
      }
    }

    const prevGroupKey = mailboxInGroups?.group?.id || UNGROUPED_SELECT_VALUE;
    const nextGroupKey = groupId || UNGROUPED_SELECT_VALUE;

    const res = await fetch(`/api/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });

	    if (!res.ok) {
	      const data = await res.json().catch(() => null);
	      toast.error(data?.error || t("toast.mailboxes.updateFailed"));
	      return;
	    }

	    toast.success(t("toast.mailboxes.updated"));
      await loadGroups();

      const keysToReload = Array.from(new Set([prevGroupKey, nextGroupKey]));
      await Promise.all(keysToReload.map((key) => loadMailboxGroupPage(key, 1, { replace: true })));

      if (isMailboxSearchMode) {
        await loadMailboxSearchPage(mailboxSearchQuery, mailboxSearchPage);
      }
	  };

  const handleStarMailbox = async (mailboxId: string, isStarred: boolean) => {
    const res = await fetch(`/api/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !isStarred }),
    });
	    const data = await res.json().catch(() => null);
	    if (!res.ok) {
	      toast.error(data?.error || t("toast.mailboxes.updateFailed"));
	      return;
	    }
    updateMailboxById(mailboxId, (mailbox) => ({ ...mailbox, isStarred: !isStarred }));
  };

  const setMailboxArchived = async (mailboxId: string, archived: boolean) => {
    const mailbox = mailboxes.find((m) => m.id === mailboxId) || null;
    const groupKey = mailbox?.group?.id || UNGROUPED_SELECT_VALUE;
    const currentPage = mailboxPaginationByGroupKey[groupKey]?.page || 1;

    const res = await fetch(`/api/mailboxes/${mailboxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(
        data?.error ||
          (archived ? t("toast.mailboxes.archiveFailed") : t("toast.mailboxes.unarchiveFailed"))
      );
      return;
    }

    toast.success(archived ? t("toast.mailboxes.archived") : t("toast.mailboxes.unarchived"));
    if (archived && !showArchivedMailboxes && selectedMailboxId === mailboxId) {
      handleSelectMailbox(null);
    }
    if (!archived && showArchivedMailboxes && selectedMailboxId === mailboxId) {
      handleSelectMailbox(null);
    }

    await loadGroups();
    await loadMailboxGroupPage(groupKey, currentPage, { replace: true });
    if (isMailboxSearchMode) {
      await loadMailboxSearchPage(mailboxSearchQuery, mailboxSearchPage);
    }
  };

  const handleArchiveMailbox = (mailboxId: string) => {
    void setMailboxArchived(mailboxId, true);
  };

  const handleUnarchiveMailbox = (mailboxId: string) => {
    void setMailboxArchived(mailboxId, false);
  };

  const handleDeleteMailbox = (mailboxId: string) => {
    setDeleteMailboxId(mailboxId);
  };

  const confirmDeleteMailbox = async () => {
    if (!deleteMailboxId) return;
    const mailboxInSearch = mailboxSearchResults.find((m) => m.id === deleteMailboxId) || null;
    let mailboxInGroups = mailboxInSearch;
    if (!mailboxInGroups) {
      for (const list of Object.values(mailboxesByGroupKey)) {
        const found = list.find((m) => m.id === deleteMailboxId) || null;
        if (found) {
          mailboxInGroups = found;
          break;
        }
      }
    }
    const groupKey = mailboxInGroups?.group?.id || UNGROUPED_SELECT_VALUE;

    setDeleting(true);
    const res = await fetch(`/api/mailboxes/${deleteMailboxId}`, { method: "DELETE" });
	    const data = await res.json().catch(() => null);
	    setDeleting(false);
	    if (!res.ok) {
	      toast.error(data?.error || t("toast.mailboxes.deleteFailed"));
	      return;
	    }
	    toast.success(t("toast.mailboxes.deleted"));
	    if (selectedMailboxId === deleteMailboxId) {
	      handleSelectMailbox(null);
    }
    setDeleteMailboxId(null);
    await loadGroups();
    await loadMailboxGroupPage(groupKey, 1, { replace: true });
    if (isMailboxSearchMode) {
      await loadMailboxSearchPage(mailboxSearchQuery, mailboxSearchPage);
    }
  };

  const handleCopyMailboxAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success(t("toast.clipboard.copied"));
  };

  const handleCopySenderAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success(t("toast.clipboard.senderCopied"));
  };

  const handleCopyEmailSubject = (subject: string) => {
    navigator.clipboard.writeText(subject);
    toast.success(t("toast.clipboard.copied"));
  };

  const handleMarkEmailRead = async (emailId: string) => {
    const email = emails.find((e) => e.id === emailId);
    if (!email || email.status !== "UNREAD") return;

    // Optimistic UI update
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, status: "READ" } : e)));
    setSelectedEmail((prev) => (prev?.id === emailId ? { ...prev, status: "READ" } : prev));

    // Decrement unread count for the mailbox
    updateMailboxById(email.mailboxId, (mailbox) => ({
      ...mailbox,
      _count: { emails: Math.max(0, mailbox._count.emails - 1) },
    }));

    // Persist
    fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READ" }),
    }).catch(() => {
      // ignore
    });
  };

  const handleMarkEmailUnread = async (emailId: string) => {
    const email = emails.find((e) => e.id === emailId);
    if (!email || email.status !== "READ") return;

    // Optimistic UI update
    setEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, status: "UNREAD" } : e)));
    setSelectedEmail((prev) => (prev?.id === emailId ? { ...prev, status: "UNREAD" } : prev));

    // Increment unread count for the mailbox
    updateMailboxById(email.mailboxId, (mailbox) => ({
      ...mailbox,
      _count: { emails: mailbox._count.emails + 1 },
    }));

    // Persist
    fetch(`/api/emails/${emailId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "UNREAD" }),
    }).catch(() => {
      // ignore
    });
  };

  const handleMarkMailboxRead = async (mailboxId: string) => {
    const res = await fetch(`/api/mailboxes/${mailboxId}/mark-read`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || t("toast.mailboxes.markReadFailed"));
      return;
    }

    const count = typeof data?.count === "number" ? data.count : 0;
    if (count <= 0) {
      toast.message(t("toast.mailboxes.alreadyRead"));
      return;
    }

    toast.success(t("toast.mailboxes.markedRead", { count }));

    updateMailboxById(mailboxId, (mailbox) => ({
      ...mailbox,
      _count: { emails: Math.max(0, mailbox._count.emails - count) },
    }));

    if (statusFilter === "unread") {
      setEmailsRefreshKey((k) => k + 1);
      return;
    }

    setEmails((prev) =>
      prev.map((e) => (e.mailboxId === mailboxId && e.status === "UNREAD" ? { ...e, status: "READ" } : e))
    );
    setSelectedEmail((prev) =>
      prev && prev.mailboxId === mailboxId && prev.status === "UNREAD"
        ? { ...prev, status: "READ" }
        : prev
    );
  };

  const handleRefreshImap = async () => {
    if (refreshingImap || refreshCooldown > 0) return;
    setRefreshingImap(true);
    try {
      const res = await fetch("/api/inbox/refresh", { method: "POST" });
      const data = await res.json().catch(() => null);

      const remainingMs = data?.imap?.remainingMs;
      if (typeof remainingMs === "number" && remainingMs > 0) {
        setRefreshCooldown(Math.ceil(remainingMs / 1000));
      }

	      if (!res.ok) {
	        toast.error(data?.error || t("toast.refresh.failed"));
	        return;
	      }

      const imap = data?.imap;
      if (imap?.ok === false && (imap.reason === "cooldown" || imap.reason === "running")) {
        toast.error(data?.message || imap.message || t("toast.refresh.wait"));
        return;
      }

      if (imap?.ok === false && imap.reason === "error") {
        toast.error(data?.message || imap.message || t("toast.refresh.failed"));
        return;
      }

      toast.success(data?.message || t("toast.refresh.triggered"));
    } catch {
      toast.error(t("toast.refresh.failed"));
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
	              <span className="hidden sm:inline">{t("tabs.mailboxes")}</span>
	            </TabsTrigger>
	            <TabsTrigger value="emails" className="gap-1.5">
	              <Mail className="h-4 w-4" />
	              <span className="hidden sm:inline">{t("tabs.emails")}</span>
	            </TabsTrigger>
	            <TabsTrigger value="preview" className="gap-1.5 relative">
	              <Eye className="h-4 w-4" />
	              <span className="hidden sm:inline">{t("tabs.preview")}</span>
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
              reorderingGroups={reorderingGroups}
              groupedMailboxes={groupedMailboxes}
              collapsedGroups={collapsedGroups}
              mailboxCount={mailboxCount}
              mailboxPaginationByGroupKey={mailboxPaginationByGroupKey}
              loadingMailboxesByGroupKey={loadingMailboxesByGroupKey}
              mailboxErrorsByGroupKey={mailboxErrorsByGroupKey}
              loadingDomains={loadingDomains}
              loadingGroups={loadingGroups}
              mailboxSearch={mailboxSearch}
              mailboxSearchResults={mailboxSearchResults}
              mailboxSearchPage={mailboxSearchPage}
	              mailboxSearchPages={mailboxSearchPages}
	              mailboxSearchTotal={mailboxSearchTotal}
	              loadingMailboxSearch={loadingMailboxSearch}
	              selectedMailboxId={selectedMailboxId}
	              showArchivedMailboxes={showArchivedMailboxes}
	              notificationsEnabled={notificationsEnabled}
	              mailboxDialogOpen={mailboxDialogOpen}
	              groupDialogOpen={groupDialogOpen}
	              renameDialogOpen={renameDialogOpen}
              newMailboxPrefix={newMailboxPrefix}
              newMailboxDomainId={newMailboxDomainId}
              newMailboxGroupId={newMailboxGroupId}
              newMailboxNote={newMailboxNote}
              newMailboxExpireMailboxDaysOverride={newMailboxExpireMailboxDaysOverride}
              newMailboxExpireMailboxActionOverride={newMailboxExpireMailboxActionOverride}
              newMailboxExpireEmailDaysOverride={newMailboxExpireEmailDaysOverride}
              newMailboxExpireEmailActionOverride={newMailboxExpireEmailActionOverride}
              creatingMailbox={creatingMailbox}
              newGroupName={newGroupName}
              creatingGroup={creatingGroup}
              renameGroupName={renameGroupName}
              renamingGroup={renamingGroup}
              onToggleNotifications={toggleNotifications}
              onMailboxSearchChange={handleMailboxSearchChange}
              onPrevMailboxSearchPage={goPrevMailboxSearchPage}
              onNextMailboxSearchPage={goNextMailboxSearchPage}
              onPrevGroupMailboxesPage={goPrevGroupMailboxesPage}
              onNextGroupMailboxesPage={goNextGroupMailboxesPage}
              onRetryGroupMailboxes={retryGroupMailboxes}
              onReorderGroups={handleReorderGroups}
              onSelectMailbox={(id) => {
                handleSelectMailbox(id);
                setMobileTab("emails");
              }}
              onToggleArchivedMailboxes={handleToggleArchivedMailboxes}
	              onMailboxDialogOpenChange={setMailboxDialogOpen}
	              onGroupDialogOpenChange={setGroupDialogOpen}
	              onRenameDialogOpenChange={setRenameDialogOpen}
              onNewMailboxDomainIdChange={setNewMailboxDomainId}
              onNewMailboxPrefixChange={setNewMailboxPrefix}
              onGenerateRandomPrefix={generateRandomPrefix}
              onNewMailboxGroupIdChange={setNewMailboxGroupId}
              onNewMailboxNoteChange={setNewMailboxNote}
              onNewMailboxExpireMailboxDaysOverrideChange={setNewMailboxExpireMailboxDaysOverride}
              onNewMailboxExpireMailboxActionOverrideChange={setNewMailboxExpireMailboxActionOverride}
              onNewMailboxExpireEmailDaysOverrideChange={setNewMailboxExpireEmailDaysOverride}
              onNewMailboxExpireEmailActionOverrideChange={setNewMailboxExpireEmailActionOverride}
              onCreateMailbox={handleCreateMailbox}
              onOpenPersonalImapDialog={() => setPersonalImapDialogOpen(true)}
              onNewGroupNameChange={setNewGroupName}
              onCreateGroup={handleCreateGroup}
              onRenameGroupNameChange={setRenameGroupName}
              onRenameGroupSave={handleRenameGroup}
	              onToggleGroupCollapse={toggleGroup}
	              onOpenRenameGroup={openRenameGroup}
	              onRequestDeleteGroup={handleDeleteGroup}
	              onStarMailbox={handleStarMailbox}
	              onArchiveMailbox={handleArchiveMailbox}
	              onUnarchiveMailbox={handleUnarchiveMailbox}
	              onRequestEditMailboxNote={handleOpenEditMailboxNote}
	              onMoveMailboxToGroup={handleMoveMailboxToGroup}
	              onMarkMailboxRead={handleMarkMailboxRead}
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
              multiSelectMode={multiSelectMode}
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
              onBulkUnarchive={handleBulkUnarchive}
              onOpenBulkDelete={openBulkDelete}
              onClearSelection={() => setSelectedEmailIds([])}
              onMultiSelectModeChange={handleMultiSelectModeChange}
              onStarEmail={handleStarEmail}
              onDeleteEmail={handleDeleteEmail}
              onMarkEmailRead={handleMarkEmailRead}
              onMarkEmailUnread={handleMarkEmailUnread}
              onArchiveEmail={handleArchiveEmail}
              onUnarchiveEmail={handleUnarchiveEmail}
              onMarkMailboxRead={handleMarkMailboxRead}
              onCopySenderAddress={handleCopySenderAddress}
              onCopyMailboxAddress={handleCopyMailboxAddress}
              onCopyEmailSubject={handleCopyEmailSubject}
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
        {desktopLayoutMode === "three" ? (
          <div className="hidden lg:grid gap-4 h-full grid-cols-[280px_minmax(320px,420px)_minmax(420px,1fr)]">
            <MailboxesPanel
              ungroupedSelectValue={UNGROUPED_SELECT_VALUE}
              domains={domains}
              groups={groups}
              reorderingGroups={reorderingGroups}
              groupedMailboxes={groupedMailboxes}
              collapsedGroups={collapsedGroups}
              mailboxCount={mailboxCount}
              mailboxPaginationByGroupKey={mailboxPaginationByGroupKey}
              loadingMailboxesByGroupKey={loadingMailboxesByGroupKey}
              mailboxErrorsByGroupKey={mailboxErrorsByGroupKey}
              loadingDomains={loadingDomains}
              loadingGroups={loadingGroups}
              mailboxSearch={mailboxSearch}
              mailboxSearchResults={mailboxSearchResults}
              mailboxSearchPage={mailboxSearchPage}
              mailboxSearchPages={mailboxSearchPages}
              mailboxSearchTotal={mailboxSearchTotal}
              loadingMailboxSearch={loadingMailboxSearch}
              selectedMailboxId={selectedMailboxId}
              showArchivedMailboxes={showArchivedMailboxes}
              notificationsEnabled={notificationsEnabled}
              mailboxDialogOpen={mailboxDialogOpen}
              groupDialogOpen={groupDialogOpen}
              renameDialogOpen={renameDialogOpen}
              newMailboxPrefix={newMailboxPrefix}
              newMailboxDomainId={newMailboxDomainId}
              newMailboxGroupId={newMailboxGroupId}
              newMailboxNote={newMailboxNote}
              newMailboxExpireMailboxDaysOverride={newMailboxExpireMailboxDaysOverride}
              newMailboxExpireMailboxActionOverride={newMailboxExpireMailboxActionOverride}
              newMailboxExpireEmailDaysOverride={newMailboxExpireEmailDaysOverride}
              newMailboxExpireEmailActionOverride={newMailboxExpireEmailActionOverride}
              creatingMailbox={creatingMailbox}
              newGroupName={newGroupName}
              creatingGroup={creatingGroup}
              renameGroupName={renameGroupName}
              renamingGroup={renamingGroup}
              onToggleNotifications={toggleNotifications}
              onMailboxSearchChange={handleMailboxSearchChange}
              onPrevMailboxSearchPage={goPrevMailboxSearchPage}
              onNextMailboxSearchPage={goNextMailboxSearchPage}
              onPrevGroupMailboxesPage={goPrevGroupMailboxesPage}
              onNextGroupMailboxesPage={goNextGroupMailboxesPage}
              onRetryGroupMailboxes={retryGroupMailboxes}
              onReorderGroups={handleReorderGroups}
              onSelectMailbox={handleSelectMailbox}
              onToggleArchivedMailboxes={handleToggleArchivedMailboxes}
              onMailboxDialogOpenChange={setMailboxDialogOpen}
              onGroupDialogOpenChange={setGroupDialogOpen}
              onRenameDialogOpenChange={setRenameDialogOpen}
              onNewMailboxDomainIdChange={setNewMailboxDomainId}
              onNewMailboxPrefixChange={setNewMailboxPrefix}
              onGenerateRandomPrefix={generateRandomPrefix}
              onNewMailboxGroupIdChange={setNewMailboxGroupId}
              onNewMailboxNoteChange={setNewMailboxNote}
              onNewMailboxExpireMailboxDaysOverrideChange={setNewMailboxExpireMailboxDaysOverride}
              onNewMailboxExpireMailboxActionOverrideChange={setNewMailboxExpireMailboxActionOverride}
              onNewMailboxExpireEmailDaysOverrideChange={setNewMailboxExpireEmailDaysOverride}
              onNewMailboxExpireEmailActionOverrideChange={setNewMailboxExpireEmailActionOverride}
              onCreateMailbox={handleCreateMailbox}
              onOpenPersonalImapDialog={() => setPersonalImapDialogOpen(true)}
              onNewGroupNameChange={setNewGroupName}
              onCreateGroup={handleCreateGroup}
              onRenameGroupNameChange={setRenameGroupName}
              onRenameGroupSave={handleRenameGroup}
              onToggleGroupCollapse={toggleGroup}
              onOpenRenameGroup={openRenameGroup}
              onRequestDeleteGroup={handleDeleteGroup}
              onStarMailbox={handleStarMailbox}
              onArchiveMailbox={handleArchiveMailbox}
              onUnarchiveMailbox={handleUnarchiveMailbox}
              onRequestEditMailboxNote={handleOpenEditMailboxNote}
              onMoveMailboxToGroup={handleMoveMailboxToGroup}
              onMarkMailboxRead={handleMarkMailboxRead}
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
              multiSelectMode={multiSelectMode}
              statusFilter={statusFilter}
              unreadCount={unreadCount}
              selectedMailboxId={selectedMailboxId}
              onSelectMailbox={handleSelectMailbox}
              onEmailSearchChange={handleEmailSearchChange}
              onPageSizeChange={handleEmailsPageSizeChange}
              onTagFilterChange={handleTagFilterChange}
              onUpdateEmailTags={handleUpdateEmailTags}
              onSelectEmail={handleSelectEmail}
              onToggleSelectAllOnPage={toggleSelectAllOnPage}
              onToggleEmailSelection={toggleEmailSelection}
              onBulkMarkRead={handleBulkMarkRead}
              onBulkArchive={handleBulkArchive}
              onBulkUnarchive={handleBulkUnarchive}
              onOpenBulkDelete={openBulkDelete}
              onClearSelection={() => setSelectedEmailIds([])}
              onMultiSelectModeChange={handleMultiSelectModeChange}
              onStarEmail={handleStarEmail}
              onDeleteEmail={handleDeleteEmail}
              onMarkEmailRead={handleMarkEmailRead}
              onMarkEmailUnread={handleMarkEmailUnread}
              onArchiveEmail={handleArchiveEmail}
              onUnarchiveEmail={handleUnarchiveEmail}
              onMarkMailboxRead={handleMarkMailboxRead}
              onCopySenderAddress={handleCopySenderAddress}
              onCopyMailboxAddress={handleCopyMailboxAddress}
              onCopyEmailSubject={handleCopyEmailSubject}
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
        ) : (
          <div className="hidden lg:grid gap-4 h-full grid-cols-[minmax(420px,560px)_minmax(520px,1fr)]">
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
              multiSelectMode={multiSelectMode}
              statusFilter={statusFilter}
              unreadCount={unreadCount}
              showDesktopMailboxSwitcher
              desktopMailboxOptions={desktopMailboxBaseOptions}
              desktopMailboxGroups={groups}
              selectedMailboxId={selectedMailboxId}
              onSelectMailbox={handleSelectMailbox}
              onEmailSearchChange={handleEmailSearchChange}
              onPageSizeChange={handleEmailsPageSizeChange}
              onTagFilterChange={handleTagFilterChange}
              onUpdateEmailTags={handleUpdateEmailTags}
              onSelectEmail={handleSelectEmail}
              onToggleSelectAllOnPage={toggleSelectAllOnPage}
              onToggleEmailSelection={toggleEmailSelection}
              onBulkMarkRead={handleBulkMarkRead}
              onBulkArchive={handleBulkArchive}
              onBulkUnarchive={handleBulkUnarchive}
              onOpenBulkDelete={openBulkDelete}
              onClearSelection={() => setSelectedEmailIds([])}
              onMultiSelectModeChange={handleMultiSelectModeChange}
              onStarEmail={handleStarEmail}
              onDeleteEmail={handleDeleteEmail}
              onMarkEmailRead={handleMarkEmailRead}
              onMarkEmailUnread={handleMarkEmailUnread}
              onArchiveEmail={handleArchiveEmail}
              onUnarchiveEmail={handleUnarchiveEmail}
              onMarkMailboxRead={handleMarkMailboxRead}
              onCopySenderAddress={handleCopySenderAddress}
              onCopyMailboxAddress={handleCopyMailboxAddress}
              onCopyEmailSubject={handleCopyEmailSubject}
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
        )}

        <ConnectPersonalImapDialog
          open={personalImapDialogOpen}
          onOpenChange={setPersonalImapDialogOpen}
          onConnected={handlePersonalImapConnected}
        />

        <ConfirmDialogs
          deleteEmailId={deleteEmailId}
          skipEmailDeleteConfirm={skipEmailDeleteConfirm}
          bulkDeleteOpen={bulkDeleteOpen}
          selectedEmailCount={selectedEmailIds.length}
          deleteMailboxId={deleteMailboxId}
          deleteGroup={deleteGroup}
          deleting={deleting}
          mailboxes={mailboxes}
          onDeleteEmailIdChange={setDeleteEmailId}
          onSkipEmailDeleteConfirmChange={persistSkipEmailDeleteConfirm}
          onBulkDeleteOpenChange={setBulkDeleteOpen}
          onDeleteMailboxIdChange={setDeleteMailboxId}
          onDeleteGroupChange={setDeleteGroup}
          onConfirmDeleteEmail={confirmDeleteEmail}
          onConfirmBulkDelete={confirmBulkDelete}
          onConfirmDeleteMailbox={confirmDeleteMailbox}
          onConfirmDeleteGroup={confirmDeleteGroup}
        />

        <EditMailboxNoteDialog
          open={editMailboxNoteDialogOpen}
          mailboxAddress={editMailboxNoteMailboxAddress}
          note={editMailboxNoteValue}
          saving={savingMailboxNote}
          onOpenChange={handleEditMailboxNoteDialogOpenChange}
          onNoteChange={setEditMailboxNoteValue}
          onSave={handleSaveMailboxNote}
        />
      </div>
    </TooltipProvider>
  );
}
