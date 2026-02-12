"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Inbox, Search, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MailboxGroup } from "../types";

export type DesktopMailboxOption = {
  id: string;
  address: string;
  note?: string | null;
  isStarred: boolean;
  group?: { id: string; name: string; color?: string | null } | null;
  _count: { emails: number };
};

type MailboxSwitcherPopoverProps = {
  options: DesktopMailboxOption[];
  groups: MailboxGroup[];
  selectedMailboxId: string | null;
  onSelectMailbox: (id: string | null) => void;
};

export function MailboxSwitcherPopover({
  options,
  groups,
  selectedMailboxId,
  onSelectMailbox,
}: MailboxSwitcherPopoverProps) {
  const t = useTranslations("inbox");
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = useMemo(
    () => (selectedMailboxId ? options.find((o) => o.id === selectedMailboxId) ?? null : null),
    [options, selectedMailboxId]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.address.toLowerCase().includes(q) ||
        (o.note && o.note.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const groupedFiltered = useMemo(() => {
    const groupMap = new Map<string, MailboxGroup>();
    for (const group of groups) {
      groupMap.set(group.id, group);
    }

    const buckets = new Map<string, { group: MailboxGroup | null; items: DesktopMailboxOption[] }>();

    for (const option of filtered) {
      const groupId = option.group?.id ?? "__ungrouped__";
      if (!buckets.has(groupId)) {
        buckets.set(groupId, {
          group: option.group ? groupMap.get(option.group.id) ?? option.group : null,
          items: [],
        });
      }
      buckets.get(groupId)!.items.push(option);
    }

    // Sort: groups in their original order, ungrouped last
    const result: Array<{ groupId: string; group: MailboxGroup | null; items: DesktopMailboxOption[] }> = [];
    for (const group of groups) {
      const bucket = buckets.get(group.id);
      if (bucket && bucket.items.length > 0) {
        result.push({ groupId: group.id, group: bucket.group, items: bucket.items });
      }
    }
    const ungrouped = buckets.get("__ungrouped__");
    if (ungrouped && ungrouped.items.length > 0) {
      result.push({ groupId: "__ungrouped__", group: null, items: ungrouped.items });
    }

    return result;
  }, [filtered, groups]);

  const handleSelect = (id: string | null) => {
    onSelectMailbox(id);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearchQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="hidden lg:flex w-full justify-between h-9 bg-background font-normal"
        >
          <span className="truncate">
            {selectedOption ? selectedOption.address : t("mailboxSwitcher.allEmails")}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("mailboxSwitcher.searchPlaceholder")}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
        </div>

        {/* "All emails" option */}
        <div
          role="option"
          aria-selected={!selectedMailboxId}
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors",
            !selectedMailboxId && "bg-accent"
          )}
          onClick={() => handleSelect(null)}
        >
          <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">{t("mailboxSwitcher.allEmails")}</span>
          {!selectedMailboxId && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </div>

        <Separator />

        <ScrollArea className="max-h-80">
          {groupedFiltered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {t("mailboxSwitcher.empty")}
            </div>
          ) : (
            groupedFiltered.map(({ groupId, group, items }) => (
              <div key={groupId}>
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground sticky top-0 bg-popover">
                  {group?.name ?? t("mailboxSwitcher.ungrouped")}
                </div>
                {items.map((option) => {
                  const isSelected = selectedMailboxId === option.id;
                  const unread = option._count.emails;
                  return (
                    <div
                      key={option.id}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors",
                        isSelected && "bg-accent"
                      )}
                      onClick={() => handleSelect(option.id)}
                    >
                      <span className="font-mono text-xs truncate flex-1">{option.address}</span>
                      {option.isStarred && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-400 text-yellow-400" />
                      )}
                      {unread > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                          {unread}
                        </Badge>
                      )}
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
