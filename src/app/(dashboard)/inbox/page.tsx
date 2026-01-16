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
  DialogTrigger,
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
    if (!confirm("Delete this email?")) return;
    const res = await fetch(`/api/emails/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    toast.success("Email deleted");
    setEmails((prev) => prev.filter((e) => e.id !== id));
    if (selectedEmailId === id) {
      setSelectedEmailId(null);
    }
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

  const handleDeleteGroup = async (group: MailboxGroup) => {
    if (!confirm(`Delete group \"${group.name}\"? Mailboxes will become ungrouped.`)) return;
    const res = await fetch(`/api/mailbox-groups/${group.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete group");
      return;
    }

    setGroups((prev) => prev.filter((g) => g.id !== group.id));
    setMailboxes((prev) => prev.map((m) => (m.group?.id === group.id ? { ...m, group: null } : m)));
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      delete next[group.id];
      return next;
    });
    toast.success("Group deleted");
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

  const handleDeleteMailbox = async (mailboxId: string) => {
    const mailbox = mailboxes.find((m) => m.id === mailboxId);
    if (!confirm(`Delete mailbox \"${mailbox?.address || mailboxId}\"?`)) return;
    const res = await fetch(`/api/mailboxes/${mailboxId}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error || "Failed to delete mailbox");
      return;
    }
    toast.success("Mailbox deleted");
    setMailboxes((prev) => prev.filter((m) => m.id !== mailboxId));
    if (selectedMailboxId === mailboxId) {
      handleSelectMailbox(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">
            Mailboxes, grouped — with instant email preview
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr_520px]">
        {/* Left: groups + mailboxes */}
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
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
              <Dialog open={mailboxDialogOpen} onOpenChange={setMailboxDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={loadingDomains}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Mailbox
                  </Button>
                </DialogTrigger>
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
                      <Select value={newMailboxGroupId} onValueChange={setNewMailboxGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ungrouped" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Ungrouped</SelectItem>
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
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    New Group
                  </Button>
                </DialogTrigger>
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
            </div>

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
                <div className="text-sm text-muted-foreground">Loading mailboxes...</div>
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
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
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
              <Button variant="outline" size="sm" asChild>
                <Link href="/emails">
                  Open full
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {loadingEmails ? (
              <div className="text-sm text-muted-foreground">Loading emails...</div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">No emails</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Incoming emails will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {emails.map((email) => {
                  const active = selectedEmailId === email.id;
                  return (
                    <button
                      type="button"
                      key={email.id}
                      onClick={() => setSelectedEmailId(email.id)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-accent transition-colors",
                        active ? "bg-accent" : ""
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {email.status === "UNREAD" && (
                              <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                                New
                              </Badge>
                            )}
                            <span className="font-medium truncate">
                              {email.subject || "(No subject)"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {email.fromName || email.fromAddress} • {email.mailbox.address}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                          </span>
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
        <Card className="border-border/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Preview</p>
              {selectedEmailId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/emails/${selectedEmailId}`}>
                    Open
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>

            {!selectedEmailId ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">Select an email</p>
                <p className="text-sm text-muted-foreground/60 mt-1">
                  Preview content without opening a new page
                </p>
              </div>
            ) : loadingPreview ? (
              <div className="text-sm text-muted-foreground">Loading preview...</div>
            ) : !selectedEmail ? (
              <div className="text-sm text-muted-foreground">Email not found</div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">
                      {selectedEmail.subject || "(No subject)"}
                    </h2>
                    <Badge variant="secondary">{selectedEmail.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    From:{" "}
                    <span className="font-mono">
                      {selectedEmail.fromAddress || "-"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    To:{" "}
                    <span className="font-mono">{selectedEmail.toAddress}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Mailbox:{" "}
                    <span className="font-mono">{selectedEmail.mailbox.address}</span>
                  </div>
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
    </div>
  );
}
