"use client";

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
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderInput,
  FolderMinus,
  Inbox,
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
  mailboxes: Mailbox[];
  groupedMailboxes: GroupedMailboxesItem[];
  collapsedGroups: Record<string, boolean>;
  loadingDomains: boolean;
  loadingGroups: boolean;
  loadingMailboxes: boolean;
  mailboxSearch: string;
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
  onMoveMailboxToGroup: (mailboxId: string, groupId: string | null) => void;
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
  mailboxes,
  groupedMailboxes,
  collapsedGroups,
  loadingDomains,
  loadingGroups,
  loadingMailboxes,
  mailboxSearch,
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
  onMoveMailboxToGroup,
  onRequestDeleteMailbox,
  onCopyMailboxAddress,
  onRefreshImap,
  refreshingImap,
  refreshCooldown,
}: MailboxesPanelProps) {
  return (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Mailboxes</p>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRefreshImap}
                  disabled={refreshingImap || refreshCooldown > 0}
                  aria-label="Refresh emails"
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
                  ? "Refreshing..."
                  : refreshCooldown > 0
                    ? `Wait ${refreshCooldown}s`
                    : "Refresh emails"}
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
                      ? "Disable desktop notifications"
                      : "Enable desktop notifications"
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
                  ? "Disable desktop notifications"
                  : "Enable desktop notifications"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search mailboxes..."
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
              <DropdownMenuItem
                onSelect={() => onMailboxDialogOpenChange(true)}
                disabled={loadingDomains}
              >
                New Mailbox
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onGroupDialogOpenChange(true)}>
                New Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Dialog open={mailboxDialogOpen} onOpenChange={onMailboxDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Mailbox</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select
                  value={newMailboxDomainId}
                  onValueChange={onNewMailboxDomainIdChange}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingDomains ? "Loading..." : "Select domain"}
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
                <Label>Prefix</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="username"
                    value={newMailboxPrefix}
                    onChange={(e) => onNewMailboxPrefixChange(e.target.value)}
                  />
                  <Button variant="outline" onClick={onGenerateRandomPrefix} type="button">
                    Random
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Group (Optional)</Label>
                <Select
                  value={newMailboxGroupId}
                  onValueChange={(value) =>
                    onNewMailboxGroupIdChange(value === ungroupedSelectValue ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ungrouped" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ungroupedSelectValue}>Ungrouped</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
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
                  onChange={(e) => onNewMailboxNoteChange(e.target.value)}
                />
              </div>

              <Button onClick={onCreateMailbox} className="w-full" disabled={creatingMailbox}>
                {creatingMailbox ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={groupDialogOpen} onOpenChange={onGroupDialogOpenChange}>
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
                  onChange={(e) => onNewGroupNameChange(e.target.value)}
                />
              </div>
              <Button onClick={onCreateGroup} className="w-full" disabled={creatingGroup}>
                {creatingGroup ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={renameDialogOpen} onOpenChange={onRenameDialogOpenChange}>
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
                  onChange={(e) => onRenameGroupNameChange(e.target.value)}
                />
              </div>
              <Button onClick={onRenameGroupSave} className="w-full" disabled={renamingGroup}>
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
                      <span className="text-[11px] text-muted-foreground">
                        {groupItem.mailboxes.length}
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
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onRequestDeleteGroup(groupItem.group as MailboxGroup)}
                            >
                              <Trash2 />
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
                          <ContextMenu key={mailbox.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                role="button"
                                tabIndex={0}
                                aria-pressed={active}
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
                                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                                )}
                              >
                                <div className="text-left min-w-0">
                                  <div className="truncate font-medium">{mailbox.address}</div>
                                  {mailbox.note && (
                                    <div
                                      className={cn(
                                        "truncate text-xs",
                                        active
                                          ? "text-primary-foreground/80"
                                          : "text-muted-foreground"
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
                                  {mailbox._count.emails > 0 && (
                                    <Badge
                                      variant="secondary"
                                      className={cn(active ? "bg-white/15 text-white" : "")}
                                    >
                                      {mailbox._count.emails}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48">
                              <ContextMenuLabel>Mailbox</ContextMenuLabel>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => onCopyMailboxAddress(mailbox.address)}
                              >
                                <Copy />
                                Copy Address
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => onStarMailbox(mailbox.id, mailbox.isStarred)}
                              >
                                {mailbox.isStarred ? (
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
                              <ContextMenuSeparator />
                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <FolderInput />
                                  Move to Group
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent className="w-40">
                                  <ContextMenuItem
                                    onClick={() => onMoveMailboxToGroup(mailbox.id, null)}
                                    disabled={!mailbox.group}
                                  >
                                    <FolderMinus />
                                    Ungrouped
                                  </ContextMenuItem>
                                  {groups.length === 0 ? (
                                    <ContextMenuItem disabled>
                                      <FolderInput />
                                      No groups
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
                                Delete
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
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
  );
}
