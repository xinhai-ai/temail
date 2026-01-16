"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Mail, Search, Star, Trash2 } from "lucide-react";
import type { EmailListItem } from "../types";

type EmailsPanelProps = {
  emailSearch: string;
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
  onEmailSearchChange: (value: string) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectEmail: (email: EmailListItem) => void;
  onToggleSelectAllOnPage: (checked: boolean) => void;
  onToggleEmailSelection: (emailId: string, checked: boolean) => void;
  onBulkMarkRead: () => void;
  onOpenBulkDelete: () => void;
  onClearSelection: () => void;
  onStarEmail: (emailId: string, isStarred: boolean) => void;
  onDeleteEmail: (emailId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function EmailsPanel({
  emailSearch,
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
  onEmailSearchChange,
  onPageSizeChange,
  onSelectEmail,
  onToggleSelectAllOnPage,
  onToggleEmailSelection,
  onBulkMarkRead,
  onOpenBulkDelete,
  onClearSelection,
  onStarEmail,
  onDeleteEmail,
  onPrevPage,
  onNextPage,
}: EmailsPanelProps) {
  const safePages = Math.max(1, pages);
  const [pageSizeInput, setPageSizeInput] = useState(() => String(pageSize));

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

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
  };

  return (
    <Card className="border-border/50 overflow-hidden min-h-0 py-0 gap-0">
      <div className="p-4 space-y-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={emailSearch}
              onChange={(e) => onEmailSearchChange(e.target.value)}
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
                <Button size="sm" variant="outline" onClick={onBulkMarkRead}>
                  Mark read
                </Button>
                <Button size="sm" variant="destructive" onClick={onOpenBulkDelete}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={onClearSelection}>
                  Clear
                </Button>
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
                  ? { label: "Clear search", onClick: () => onEmailSearchChange("") }
                  : undefined
              }
            />
          ) : (
            <div className="divide-y rounded-md border">
              {emails.map((email) => {
                const active = selectedEmailId === email.id;
                const isUnread = email.status === "UNREAD";
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    key={email.id}
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
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                          {email.mailbox.address.split("@")[0]}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onStarEmail(email.id, email.isStarred);
                              }}
                            >
                              <Star
                                className={cn(
                                  "h-4 w-4",
                                  email.isStarred
                                    ? "fill-yellow-400 text-yellow-400"
                                    : ""
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
                                onDeleteEmail(email.id);
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>

      <div className="p-3 border-t border-border/50 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Per page</span>
          <div className="flex items-center gap-1">
            {[5, 10, 15].map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={pageSize === preset ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2"
                onClick={() => {
                  setPageSizeInput(String(preset));
                  if (preset !== pageSize) onPageSizeChange(preset);
                }}
              >
                {preset}
              </Button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            max={100}
            value={pageSizeInput}
            onChange={(e) => setPageSizeInput(e.target.value)}
            onBlur={commitPageSize}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              commitPageSize();
              e.currentTarget.blur();
            }}
            className="h-8 w-[72px] px-2"
          />
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
