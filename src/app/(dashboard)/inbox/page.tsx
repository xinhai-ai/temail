"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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

  const [groups, setGroups] = useState<MailboxGroup[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [emails, setEmails] = useState<EmailListItem[]>([]);
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);

  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

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

  useEffect(() => {
    const fetchGroups = async () => {
      setLoadingGroups(true);
      const res = await fetch("/api/mailbox-groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
      setLoadingGroups(false);
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    const fetchMailboxes = async () => {
      setLoadingMailboxes(true);
      const res = await fetch(`/api/mailboxes?search=${encodeURIComponent(mailboxSearch)}`);
      const data = await res.json();
      setMailboxes(Array.isArray(data) ? data : []);
      setLoadingMailboxes(false);
    };
    fetchMailboxes();
  }, [mailboxSearch]);

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

            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant={selectedMailboxId === null ? "default" : "outline"}
                onClick={() => handleSelectMailbox(null)}
              >
                <Inbox className="mr-2 h-4 w-4" />
                All Emails
              </Button>
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
              <span className="text-xs text-muted-foreground">
                {loadingGroups || loadingMailboxes
                  ? "Loading..."
                  : `${mailboxes.length} mailboxes • ${groups.length} groups`}
              </span>
            </div>

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
                      <button
                        type="button"
                        onClick={() => toggleGroup(groupItem.key)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider px-1 py-1 hover:text-muted-foreground"
                      >
                        <span className="flex items-center gap-1">
                          {collapsed ? (
                            <ChevronRight className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {label}
                        </span>
                        <span className="text-[11px]">
                          {groupItem.mailboxes.length}
                        </span>
                      </button>

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
