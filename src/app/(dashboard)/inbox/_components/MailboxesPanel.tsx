"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderInput,
  FolderMinus,
  Inbox,
  MailOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import type { Domain, Mailbox, MailboxGroup } from "../types";

type GroupedMailboxesItem = {
  key: string;
  group: MailboxGroup | null;
  mailboxes: Mailbox[];
};

type MailboxesPanelProps = {
  ungroupedSelectValue: string;
  domains: Domain[];
  groups: MailboxGroup[];
  groupedMailboxes: GroupedMailboxesItem[];
  collapsedGroups: Record<string, boolean>;
  mailboxCount: number;
  mailboxPaginationByGroupKey: Record<string, { page: number; pages: number; total: number; limit: number }>;
  loadingMailboxesByGroupKey: Record<string, boolean>;
  mailboxErrorsByGroupKey: Record<string, string | null>;
  loadingDomains: boolean;
  loadingGroups: boolean;
  mailboxSearch: string;
  mailboxSearchResults: Mailbox[];
  mailboxSearchPage: number;
  mailboxSearchPages: number;
  mailboxSearchTotal: number;
  loadingMailboxSearch: boolean;
  selectedMailboxId: string | null;
  notificationsEnabled: boolean;
  mailboxDialogOpen: boolean;
  groupDialogOpen: boolean;
  renameDialogOpen: boolean;
  newMailboxPrefix: string;
  newMailboxDomainId: string;
  newMailboxGroupId: string;
  newMailboxNote: string;
  creatingMailbox: boolean;
  newGroupName: string;
  creatingGroup: boolean;
  renameGroupName: string;
  renamingGroup: boolean;
  onToggleNotifications: () => void;
  onMailboxSearchChange: (value: string) => void;
  onPrevMailboxSearchPage: () => void;
  onNextMailboxSearchPage: () => void;
  onPrevGroupMailboxesPage: (key: string) => void;
  onNextGroupMailboxesPage: (key: string) => void;
  onRetryGroupMailboxes: (key: string) => void;
  onSelectMailbox: (id: string | null) => void;
  onMailboxDialogOpenChange: (open: boolean) => void;
  onGroupDialogOpenChange: (open: boolean) => void;
  onRenameDialogOpenChange: (open: boolean) => void;
  onNewMailboxDomainIdChange: (value: string) => void;
  onNewMailboxPrefixChange: (value: string) => void;
  onGenerateRandomPrefix: () => void;
  onNewMailboxGroupIdChange: (value: string) => void;
  onNewMailboxNoteChange: (value: string) => void;
  onCreateMailbox: () => void;
  onNewGroupNameChange: (value: string) => void;
  onCreateGroup: () => void;
  onRenameGroupNameChange: (value: string) => void;
  onRenameGroupSave: () => void;
  onToggleGroupCollapse: (key: string) => void;
  onOpenRenameGroup: (group: MailboxGroup) => void;
  onRequestDeleteGroup: (group: MailboxGroup) => void;
  onStarMailbox: (mailboxId: string, isStarred: boolean) => void;
  onRequestEditMailboxNote: (mailbox: Mailbox) => void;
  onMoveMailboxToGroup: (mailboxId: string, groupId: string | null) => void;
  onMarkMailboxRead: (mailboxId: string) => void;
  onRequestDeleteMailbox: (mailboxId: string) => void;
  onCopyMailboxAddress: (address: string) => void;
  onRefreshImap: () => void;
  refreshingImap: boolean;
  refreshCooldown: number; // remaining seconds
};

export function MailboxesPanel({
  ungroupedSelectValue,
  domains,
  groups,
  groupedMailboxes,
  collapsedGroups,
  mailboxCount,
  mailboxPaginationByGroupKey,
  loadingMailboxesByGroupKey,
  mailboxErrorsByGroupKey,
  loadingDomains,
  loadingGroups,
  mailboxSearch,
  mailboxSearchResults,
  mailboxSearchPage,
  mailboxSearchPages,
  mailboxSearchTotal,
  loadingMailboxSearch,
  selectedMailboxId,
  notificationsEnabled,
  mailboxDialogOpen,
  groupDialogOpen,
  renameDialogOpen,
  newMailboxPrefix,
  newMailboxDomainId,
  newMailboxGroupId,
  newMailboxNote,
  creatingMailbox,
  newGroupName,
  creatingGroup,
  renameGroupName,
  renamingGroup,
  onToggleNotifications,
  onMailboxSearchChange,
  onPrevMailboxSearchPage,
  onNextMailboxSearchPage,
  onPrevGroupMailboxesPage,
  onNextGroupMailboxesPage,
  onRetryGroupMailboxes,
  onSelectMailbox,
  onMailboxDialogOpenChange,
  onGroupDialogOpenChange,
  onRenameDialogOpenChange,
  onNewMailboxDomainIdChange,
  onNewMailboxPrefixChange,
  onGenerateRandomPrefix,
  onNewMailboxGroupIdChange,
  onNewMailboxNoteChange,
  onCreateMailbox,
  onNewGroupNameChange,
  onCreateGroup,
  onRenameGroupNameChange,
  onRenameGroupSave,
  onToggleGroupCollapse,
  onOpenRenameGroup,
  onRequestDeleteGroup,
  onStarMailbox,
  onRequestEditMailboxNote,
  onMoveMailboxToGroup,
  onMarkMailboxRead,
  onRequestDeleteMailbox,
  onCopyMailboxAddress,
  onRefreshImap,
  refreshingImap,
  refreshCooldown,
}: MailboxesPanelProps) {
  const t = useTranslations("inbox");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const mailboxSearchQuery = mailboxSearch.trim();
  const isSearchMode = mailboxSearchQuery.length > 0;
  const [openContextMenuMailboxId, setOpenContextMenuMailboxId] = useState<string | null>(null);

  const groupNameById = new Map<string, string>();
  for (const group of groups) {
    groupNameById.set(group.id, group.name);
  }

  const getMailboxGroupLabel = (mailbox: Mailbox) => {
    const groupId = mailbox.group?.id;
    if (!groupId) return t("mailboxes.dialog.ungrouped");
    return groupNameById.get(groupId) || mailbox.group?.name || t("mailboxes.context.group");
  };

  const renderMailboxSkeletonList = (count: number) => (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
      ))}
    </div>
  );

  const renderMailboxItem = (mailbox: Mailbox, options?: { showGroupLabel?: boolean }) => {
    const selected = selectedMailboxId === mailbox.id;
    const contextOpen = openContextMenuMailboxId === mailbox.id;
    const showGroupLabel = options?.showGroupLabel === true;
    const groupLabel = showGroupLabel ? getMailboxGroupLabel(mailbox) : "";
    const meta = showGroupLabel
      ? [groupLabel, mailbox.note].filter(Boolean).join(" · ")
      : mailbox.note || "";

    return (
      <ContextMenu
        key={mailbox.id}
        onOpenChange={(open) => setOpenContextMenuMailboxId(open ? mailbox.id : null)}
      >
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            onClick={() => onSelectMailbox(mailbox.id)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectMailbox(mailbox.id);
              }
            }}
            className={cn(
              "w-full flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors",
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              selected ? "bg-primary text-primary-foreground" : contextOpen ? "bg-accent" : "hover:bg-accent"
            )}
          >
            <div className="text-left min-w-0">
              <div className="truncate font-medium">{mailbox.address}</div>
              {meta ? (
                <div
                  className={cn(
                    "truncate text-xs",
                    selected ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}
                >
                  {meta}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {mailbox.isStarred && (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              )}
              {mailbox._count.emails > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(selected ? "bg-white/15 text-white" : "")}
                >
                  {mailbox._count.emails}
                </Badge>
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuLabel>{t("mailboxes.context.mailbox")}</ContextMenuLabel>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onCopyMailboxAddress(mailbox.address)}
          >
            <Copy />
            {t("mailboxes.context.copyAddress")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onRequestEditMailboxNote(mailbox)}>
            <Pencil />
            {t("mailboxes.context.editNote")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onStarMailbox(mailbox.id, mailbox.isStarred)}
          >
            {mailbox.isStarred ? (
              <>
                <StarOff />
                {t("mailboxes.context.unstar")}
              </>
            ) : (
              <>
                <Star />
                {t("mailboxes.context.star")}
              </>
            )}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => onMarkMailboxRead(mailbox.id)}
            disabled={mailbox._count.emails <= 0}
          >
            <MailOpen />
            {t("mailboxes.context.markAllAsRead")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <FolderInput />
              {t("mailboxes.context.moveToGroup")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40">
              <ContextMenuItem
                onClick={() => onMoveMailboxToGroup(mailbox.id, null)}
                disabled={!mailbox.group}
              >
                <FolderMinus />
                {t("mailboxes.dialog.ungrouped")}
              </ContextMenuItem>
              {groups.length === 0 ? (
                <ContextMenuItem disabled>
                  <FolderInput />
                  {t("mailboxes.context.noGroups")}
                </ContextMenuItem>
              ) : (
                groups.map((group) => (
                  <ContextMenuItem
                    key={group.id}
                    onClick={() => onMoveMailboxToGroup(mailbox.id, group.id)}
                    disabled={mailbox.group?.id === group.id}
                  >
                    <FolderInput />
                    {group.name}
                  </ContextMenuItem>
                ))
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onClick={() => onRequestDeleteMailbox(mailbox.id)}
          >
            <Trash2 />
            {tCommon("delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{tNav("mailboxes")}</p>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRefreshImap}
                  disabled={refreshingImap || refreshCooldown > 0}
                  aria-label={t("mailboxes.refresh.aria")}
                >
                  {refreshCooldown > 0 ? (
                    <span className="text-xs font-medium tabular-nums">{refreshCooldown}</span>
                  ) : (
                    <RefreshCw className={cn("h-4 w-4", refreshingImap && "animate-spin")} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {refreshingImap
                  ? t("mailboxes.refresh.refreshing")
                  : refreshCooldown > 0
                    ? t("mailboxes.refresh.wait", { seconds: refreshCooldown })
                    : t("mailboxes.refresh.tooltip")}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleNotifications}
                  aria-label={
                    notificationsEnabled
                      ? t("mailboxes.notifications.disable")
                      : t("mailboxes.notifications.enable")
                  }
                >
                  {notificationsEnabled ? (
                    <BellOff className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {notificationsEnabled
                  ? t("mailboxes.notifications.disable")
                  : t("mailboxes.notifications.enable")}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("mailboxes.searchPlaceholder")}
            value={mailboxSearch}
            onChange={(e) => onMailboxSearchChange(e.target.value)}
            className="pl-10 h-10 bg-muted/50 border-border/50 focus:bg-background transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={selectedMailboxId === null ? "default" : "outline"}
            onClick={() => onSelectMailbox(null)}
            className="flex-1 min-w-[140px]"
          >
            <Inbox className="mr-2 h-4 w-4" />
            {t("mailboxes.allEmails")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                {t("mailboxes.new")}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => onMailboxDialogOpenChange(true)}
                disabled={loadingDomains}
              >
                {t("mailboxes.newMailbox")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onGroupDialogOpenChange(true)}>
                {t("mailboxes.newGroup")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={mailboxDialogOpen} onOpenChange={onMailboxDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("mailboxes.dialog.createMailbox")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>{t("mailboxes.dialog.domain")}</Label>
                <Select
                  value={newMailboxDomainId}
                  onValueChange={onNewMailboxDomainIdChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingDomains ? tCommon("loading") : t("mailboxes.dialog.selectDomain")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                <div className="space-y-2">
                  <Label>{t("mailboxes.dialog.prefix")}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("mailboxes.dialog.prefixPlaceholder")}
                      value={newMailboxPrefix}
                      onChange={(e) => onNewMailboxPrefixChange(e.target.value)}
                    />
                    <Button variant="outline" onClick={onGenerateRandomPrefix} type="button">
                      {t("mailboxes.dialog.random")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("mailboxes.dialog.groupOptional")}</Label>
                <Select
                  value={newMailboxGroupId}
                  onValueChange={(value) =>
                    onNewMailboxGroupIdChange(value === ungroupedSelectValue ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("mailboxes.dialog.ungrouped")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ungroupedSelectValue}>{t("mailboxes.dialog.ungrouped")}</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("mailboxes.dialog.noteOptional")}</Label>
                <Input
                  placeholder={t("mailboxes.dialog.notePlaceholder")}
                  value={newMailboxNote}
                  onChange={(e) => onNewMailboxNoteChange(e.target.value)}
                />
              </div>

              <Button onClick={onCreateMailbox} className="w-full" disabled={creatingMailbox}>
                {creatingMailbox ? t("mailboxes.actions.creating") : tCommon("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={groupDialogOpen} onOpenChange={onGroupDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("mailboxes.dialog.createGroup")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="groupName">{t("mailboxes.dialog.name")}</Label>
                <Input
                  id="groupName"
                  placeholder={t("mailboxes.dialog.groupNamePlaceholder")}
                  value={newGroupName}
                  onChange={(e) => onNewGroupNameChange(e.target.value)}
                />
              </div>
              <Button onClick={onCreateGroup} className="w-full" disabled={creatingGroup}>
                {creatingGroup ? t("mailboxes.actions.creating") : tCommon("create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={renameDialogOpen} onOpenChange={onRenameDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("mailboxes.dialog.renameGroup")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="renameGroupName">{t("mailboxes.dialog.name")}</Label>
                <Input
                  id="renameGroupName"
                  value={renameGroupName}
                  onChange={(e) => onRenameGroupNameChange(e.target.value)}
                />
              </div>
              <Button onClick={onRenameGroupSave} className="w-full" disabled={renamingGroup}>
                {renamingGroup ? t("mailboxes.actions.saving") : tCommon("save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <span className="text-xs text-muted-foreground">
          {loadingGroups
            ? tCommon("loading")
            : t("mailboxes.summary", { mailboxCount, groupCount: groups.length })}
        </span>

        {isSearchMode ? (
          <div className="space-y-2">
            {loadingMailboxSearch && mailboxSearchResults.length === 0 ? (
              renderMailboxSkeletonList(6)
            ) : mailboxSearchResults.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                {t("mailboxes.pagination.noResults")}
              </div>
            ) : (
              <div className="space-y-1">
                {mailboxSearchResults.map((mailbox) =>
                  renderMailboxItem(mailbox, { showGroupLabel: true })
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                {t("mailboxes.pagination.searchResults", { count: mailboxSearchTotal })}
                <span className="text-muted-foreground/50"> · </span>
                {t("mailboxes.pagination.page", { page: mailboxSearchPage, pages: mailboxSearchPages })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onPrevMailboxSearchPage}
                  disabled={loadingMailboxSearch || mailboxSearchPage <= 1}
                >
                  {t("mailboxes.pagination.prev")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onNextMailboxSearchPage}
                  disabled={loadingMailboxSearch || mailboxSearchPage >= mailboxSearchPages}
                >
                  {t("mailboxes.pagination.next")}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedMailboxes.map((groupItem) => {
              const label =
                groupItem.key === ungroupedSelectValue
                  ? t("mailboxes.dialog.ungrouped")
                  : groupItem.group?.name || t("mailboxes.context.group");
              const collapsed = Boolean(collapsedGroups[groupItem.key]);
              const loading = Boolean(loadingMailboxesByGroupKey[groupItem.key]);
              const error = mailboxErrorsByGroupKey[groupItem.key];
              const pagination = mailboxPaginationByGroupKey[groupItem.key];
              const page = pagination?.page || 1;
              const pages = pagination?.pages || 1;
              const loadedCount = groupItem.mailboxes.length;
              const totalFromGroupCount = groupItem.key === ungroupedSelectValue ? undefined : groupItem.group?._count?.mailboxes;
              const total =
                typeof pagination?.total === "number"
                  ? pagination.total
                  : typeof totalFromGroupCount === "number"
                    ? totalFromGroupCount
                    : loadedCount;

              const countLabel = String(total);
              const showPager = pages > 1;

              return (
                <div key={groupItem.key} className="space-y-1">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div className="flex items-center justify-between px-1 py-1">
                        <button
                          type="button"
                          onClick={() => onToggleGroupCollapse(groupItem.key)}
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
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {countLabel}
                          </span>
                          {groupItem.group && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onOpenRenameGroup(groupItem.group as MailboxGroup)}>
                                  <Pencil />
                                  {t("mailboxes.context.rename")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => onRequestDeleteGroup(groupItem.group as MailboxGroup)}
                                >
                                  <Trash2 />
                                  {tCommon("delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuLabel>{label}</ContextMenuLabel>
                      <ContextMenuSeparator />
                      <ContextMenuItem onClick={() => onToggleGroupCollapse(groupItem.key)}>
                        {collapsed ? <ChevronDown /> : <ChevronRight />}
                        {collapsed ? t("mailboxes.context.expand") : t("mailboxes.context.collapse")}
                      </ContextMenuItem>
                      {groupItem.group ? (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => onOpenRenameGroup(groupItem.group as MailboxGroup)}>
                            <Pencil />
                            {t("mailboxes.context.rename")}
                          </ContextMenuItem>
                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => onRequestDeleteGroup(groupItem.group as MailboxGroup)}
                          >
                            <Trash2 />
                            {tCommon("delete")}
                          </ContextMenuItem>
                        </>
                      ) : null}
                    </ContextMenuContent>
                  </ContextMenu>

                  {!collapsed ? (
                    <div className="space-y-1">
                      {error ? (
                        <div className="rounded-md border bg-muted/20 px-2 py-2 space-y-2">
                          <div className="text-xs text-muted-foreground break-words">{error}</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onRetryGroupMailboxes(groupItem.key)}
                            disabled={loading}
                          >
                            {t("mailboxes.pagination.retry")}
                          </Button>
                        </div>
                      ) : loading && loadedCount === 0 ? (
                        renderMailboxSkeletonList(3)
                      ) : (
                        <div className="space-y-1">
                          {groupItem.mailboxes.map((mailbox) => renderMailboxItem(mailbox))}
                        </div>
                      )}

                      {!error && showPager ? (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="text-xs text-muted-foreground">
                            {t("mailboxes.pagination.page", { page, pages })}
                            {loading ? <span className="text-muted-foreground/50"> · {t("mailboxes.pagination.loading")}</span> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onPrevGroupMailboxesPage(groupItem.key)}
                              disabled={loading || page <= 1}
                            >
                              {t("mailboxes.pagination.prev")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onNextGroupMailboxesPage(groupItem.key)}
                              disabled={loading || page >= pages}
                            >
                              {t("mailboxes.pagination.next")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
