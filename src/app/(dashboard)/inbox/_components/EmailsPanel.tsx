"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Archive, ArchiveRestore, Copy, ExternalLink, Mail, MailOpen, Plus, Search, Star, StarOff, Tag as TagIcon, Trash2, X } from "lucide-react";
import Link from "next/link";
import type { EmailListItem, Tag } from "../types";

export type EmailStatusFilter = "all" | "unread" | "archived";

type EmailsPanelProps = {
  emailSearch: string;
  tags: Tag[];
  selectedTagId: string | null;
  emails: EmailListItem[];
  loadingEmails: boolean;
  page: number;
  pages: number;
  pageSize: number;
  selectedEmailId: string | null;
  selectedEmailIds: string[];
  selectedEmailIdSet: Set<string>;
  allSelectedOnPage: boolean;
  someSelectedOnPage: boolean;
  statusFilter: EmailStatusFilter;
  unreadCount: number;
  onEmailSearchChange: (value: string) => void;
  onPageSizeChange: (pageSize: number) => void;
  onTagFilterChange: (tagId: string | null) => void;
  onUpdateEmailTags: (emailId: string, patch: { add?: string[]; remove?: string[] }) => Promise<boolean>;
  onSelectEmail: (email: EmailListItem) => void;
  onToggleSelectAllOnPage: (checked: boolean) => void;
  onToggleEmailSelection: (emailId: string, checked: boolean) => void;
  onBulkMarkRead: () => void;
  onBulkArchive: () => void;
  onOpenBulkDelete: () => void;
  onClearSelection: () => void;
  onStarEmail: (emailId: string, isStarred: boolean) => void;
  onDeleteEmail: (emailId: string) => void;
  onMarkEmailRead: (emailId: string) => void;
  onArchiveEmail: (emailId: string) => void;
  onUnarchiveEmail: (emailId: string) => void;
  onCopySenderAddress: (address: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onStatusFilterChange: (filter: EmailStatusFilter) => void;
};

export function EmailsPanel({
  emailSearch,
  tags,
  selectedTagId,
  emails,
  loadingEmails,
  page,
  pages,
  pageSize,
  selectedEmailId,
  selectedEmailIds,
  selectedEmailIdSet,
  allSelectedOnPage,
  someSelectedOnPage,
  statusFilter,
  unreadCount,
  onEmailSearchChange,
  onPageSizeChange,
  onTagFilterChange,
  onUpdateEmailTags,
  onSelectEmail,
  onToggleSelectAllOnPage,
  onToggleEmailSelection,
  onBulkMarkRead,
  onBulkArchive,
  onOpenBulkDelete,
  onClearSelection,
  onStarEmail,
  onDeleteEmail,
  onMarkEmailRead,
  onArchiveEmail,
  onUnarchiveEmail,
  onCopySenderAddress,
  onPrevPage,
  onNextPage,
  onStatusFilterChange,
}: EmailsPanelProps) {
  const safePages = Math.max(1, pages);
  const [emailSearchInput, setEmailSearchInput] = useState(() => emailSearch);
  const [pageSizeInput, setPageSizeInput] = useState(() => String(pageSize));
  const pageSizeValue = String(pageSize);
  const tagFilterValue = selectedTagId || "__all__";
  const isPresetPageSize = pageSize === 5 || pageSize === 10 || pageSize === 15;
  const [pageSizeOpen, setPageSizeOpen] = useState(false);
  const lastSearchSubmitAt = useRef<number>(0);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addTagEmailId, setAddTagEmailId] = useState<string | null>(null);
  const [addTagName, setAddTagName] = useState("");

  useEffect(() => {
    setEmailSearchInput(emailSearch);
  }, [emailSearch]);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const submitSearch = () => {
    const now = Date.now();
    if (now - lastSearchSubmitAt.current < 250) return;
    lastSearchSubmitAt.current = now;

    const next = emailSearchInput.trim();
    if (next === emailSearch) return;
    onEmailSearchChange(next);
  };

  const commitPageSize = () => {
    const parsed = Number.parseInt(pageSizeInput, 10);
    if (!Number.isFinite(parsed)) {
      setPageSizeInput(String(pageSize));
      return;
    }
    const next = Math.min(100, Math.max(1, parsed));
    setPageSizeInput(String(next));
    if (next !== pageSize) {
      onPageSizeChange(next);
    }
    setPageSizeOpen(false);
  };

  const openAddTagDialog = (emailId: string) => {
    setAddTagEmailId(emailId);
    setAddTagName("");
    setAddTagDialogOpen(true);
  };

  const submitAddTag = async () => {
    if (!addTagEmailId) return;
    const name = addTagName.trim();
    if (!name) return;
    const ok = await onUpdateEmailTags(addTagEmailId, { add: [name] });
    if (ok) {
      setAddTagDialogOpen(false);
      setAddTagEmailId(null);
      setAddTagName("");
    }
  };

  return (
    <Card className="border-border/50 overflow-hidden min-h-0 py-0 gap-0 h-full flex flex-col">
      <div className="p-4 space-y-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails... (press Enter)"
              value={emailSearchInput}
              onChange={(e) => setEmailSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                submitSearch();
              }}
              className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
            />
          </div>
        </div>

        <Tabs value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as EmailStatusFilter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread{unreadCount > 0 && ` (${unreadCount})`}
            </TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tag</span>
            <Select
              value={tagFilterValue}
              onValueChange={(value) => onTagFilterChange(value === "__all__" ? null : value)}
            >
              <SelectTrigger className="h-8 text-sm w-[180px]">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="__all__">All tags</SelectItem>
                {tags.length > 0 && <SelectSeparator />}
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                onChange={(e) => onToggleSelectAllOnPage(e.target.checked)}
              />
              <span className="text-muted-foreground">
                {selectedEmailIds.length > 0
                  ? `${selectedEmailIds.length} selected`
                  : "Select"}
              </span>
            </label>
            {selectedEmailIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={onBulkMarkRead}
                      aria-label="Mark selected as read"
                    >
                      <MailOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mark read</TooltipContent>
                </Tooltip>
                {statusFilter !== "archived" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={onBulkArchive}
                        aria-label="Archive selected"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Archive</TooltipContent>
                  </Tooltip>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="destructive"
                      onClick={onOpenBulkDelete}
                      aria-label="Delete selected"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={onClearSelection}
                      aria-label="Clear selection"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </div>

      <CardContent className="flex-1 min-h-0 overflow-y-auto p-0">
        <div className="p-4 pt-3">
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
              description={
                emailSearch
                  ? `No emails matching "${emailSearch}"`
                  : "Incoming emails will appear here automatically"
              }
              action={
                emailSearch
                  ? {
                      label: "Clear search",
                      onClick: () => {
                        setEmailSearchInput("");
                        onEmailSearchChange("");
                      },
                    }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y rounded-md border">
              {emails.map((email) => {
                const active = selectedEmailId === email.id;
                const isUnread = email.status === "UNREAD";
                const emailTagIds = new Set((email.tags || []).map((t) => t.id));
                return (
                  <ContextMenu key={email.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-pressed={active}
                        onClick={() => onSelectEmail(email)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectEmail(email);
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 transition-all duration-150 group",
                          "cursor-pointer hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
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
                              onChange={(e) =>
                                onToggleEmailSelection(email.id, e.target.checked)
                              }
                            />
                          </div>
                          <div className="pt-1.5 w-2 flex-shrink-0">
                            {isUnread && <div className="w-2 h-2 rounded-full bg-primary" />}
                          </div>

                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "truncate",
                                  isUnread
                                    ? "font-semibold text-foreground"
                                    : "font-medium text-foreground/90"
                                )}
                              >
                                {email.subject || "(No subject)"}
                              </span>
                              {email.isStarred && (
                                <Star className="h-4 w-4 flex-shrink-0 fill-yellow-400 text-yellow-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="truncate">
                                {email.fromName || email.fromAddress}
                              </span>
                              <span className="text-muted-foreground/50">·</span>
                              <span className="flex-shrink-0">
                                {formatDistanceToNow(new Date(email.receivedAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                {email.mailbox.address.split("@")[0]}
                              </Badge>
                              {email.tags && email.tags.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {email.tags.slice(0, 3).map((tag) => (
                                    <Badge key={tag.id} variant="outline" className="text-[10px] h-5 px-1.5">
                                      {tag.name}
                                    </Badge>
                                  ))}
                                  {email.tags.length > 3 && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                      +{email.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuLabel>Email</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem asChild>
                        <Link href={`/emails/${email.id}`}>
                          <ExternalLink />
                          Open
                        </Link>
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => onCopySenderAddress(email.fromAddress)}
                      >
                        <Copy />
                        Copy Sender
                      </ContextMenuItem>
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <TagIcon />
                          Tags
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-56">
                          {tags.length === 0 ? (
                            <ContextMenuItem disabled>
                              No tags yet
                            </ContextMenuItem>
                          ) : (
                            tags.map((tag) => {
                              const checked = emailTagIds.has(tag.id);
                              return (
                                <ContextMenuCheckboxItem
                                  key={tag.id}
                                  checked={checked}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={(next) => {
                                    const enabled = Boolean(next);
                                    if (enabled) {
                                      void onUpdateEmailTags(email.id, { add: [tag.name] });
                                    } else {
                                      void onUpdateEmailTags(email.id, { remove: [tag.id] });
                                    }
                                  }}
                                >
                                  {tag.name}
                                </ContextMenuCheckboxItem>
                              );
                            })
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => openAddTagDialog(email.id)}>
                            <Plus />
                            Add new…
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                      {isUnread && (
                        <ContextMenuItem
                          onClick={() => onMarkEmailRead(email.id)}
                        >
                          <MailOpen />
                          Mark as Read
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem
                        onClick={() => onStarEmail(email.id, email.isStarred)}
                      >
                        {email.isStarred ? (
                          <>
                            <StarOff />
                            Unstar
                          </>
                        ) : (
                          <>
                            <Star />
                            Star
                          </>
                        )}
                      </ContextMenuItem>
                      {email.status === "ARCHIVED" ? (
                        <ContextMenuItem
                          onClick={() => onUnarchiveEmail(email.id)}
                        >
                          <ArchiveRestore />
                          Unarchive
                        </ContextMenuItem>
                      ) : (
                        <ContextMenuItem
                          onClick={() => onArchiveEmail(email.id)}
                        >
                          <Archive />
                          Archive
                        </ContextMenuItem>
                      )}
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => onDeleteEmail(email.id)}
                      >
                        <Trash2 />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      <Dialog
        open={addTagDialogOpen}
        onOpenChange={(open) => {
          setAddTagDialogOpen(open);
          if (!open) {
            setAddTagEmailId(null);
            setAddTagName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add tag</DialogTitle>
            <DialogDescription>
              Create a new tag or attach an existing tag by name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="add-tag-name">Tag name</Label>
            <Input
              id="add-tag-name"
              list="email-tag-suggestions"
              value={addTagName}
              onChange={(e) => setAddTagName(e.target.value)}
              placeholder="e.g. urgent"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (e.nativeEvent.isComposing) return;
                e.preventDefault();
                void submitAddTag();
              }}
            />
            <datalist id="email-tag-suggestions">
              {tags.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddTagDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitAddTag()} disabled={!addTagName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-3 border-t border-border/50 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Per page</span>
          <Select
            open={pageSizeOpen}
            onOpenChange={setPageSizeOpen}
            value={pageSizeValue}
            onValueChange={(value) => {
              const parsed = Number.parseInt(value, 10);
              if (!Number.isFinite(parsed)) return;
              setPageSizeInput(String(parsed));
              if (parsed !== pageSize) onPageSizeChange(parsed);
              setPageSizeOpen(false);
            }}
          >
            <SelectTrigger size="sm" className="w-[96px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              {!isPresetPageSize && (
                <>
                  <SelectSeparator />
                  <SelectItem value={pageSizeValue}>{pageSizeValue}</SelectItem>
                </>
              )}
              <SelectSeparator />
              <div className="p-2">
                <div className="text-xs text-muted-foreground mb-1">Custom</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={pageSizeInput}
                    onChange={(e) => setPageSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      e.stopPropagation();
                      commitPageSize();
                    }}
                    className="h-8 w-[96px] px-2"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={(e) => {
                      e.preventDefault();
                      commitPageSize();
                    }}
                  >
                    Set
                  </Button>
                </div>
              </div>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground/50">·</span>
          <span>
            Page {page} / {safePages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrevPage}
            disabled={loadingEmails || page <= 1}
          >
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNextPage}
            disabled={loadingEmails || page >= safePages}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
