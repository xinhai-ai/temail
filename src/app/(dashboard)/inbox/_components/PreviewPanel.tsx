"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";
import { EmailHtmlPreview } from "@/components/email/EmailHtmlPreview";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Mail } from "lucide-react";
import type { EmailDetail } from "../types";
import { toast } from "sonner";

type PreviewPanelProps = {
  selectedEmailId: string | null;
  selectedEmail: EmailDetail | null;
  loadingPreview: boolean;
};

export function PreviewPanel({
  selectedEmailId,
  selectedEmail,
  loadingPreview,
}: PreviewPanelProps) {
  const REMOTE_RESOURCES_KEY = "temail.preview.allowRemoteResources";
  const REMOTE_RESOURCES_WARNED_KEY = "temail.preview.remoteResourcesWarned";

  const [manualPreviewMode, setManualPreviewMode] = useState<"text" | "html" | "raw" | null>(null);
  const [allowRemoteResources, setAllowRemoteResources] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(REMOTE_RESOURCES_KEY) === "1";
    } catch {
      return false;
    }
  });

  const previewMode: "text" | "html" | "raw" = manualPreviewMode ?? (selectedEmail?.htmlBody ? "html" : "text");

  const handleAllowRemoteResourcesChange = (checked: boolean) => {
    setAllowRemoteResources(checked);
    try {
      localStorage.setItem(REMOTE_RESOURCES_KEY, checked ? "1" : "0");
    } catch {
      // ignore
    }

    if (!checked) return;

    try {
      const warned = localStorage.getItem(REMOTE_RESOURCES_WARNED_KEY) === "1";
      if (!warned) {
        toast.warning("Loading remote images may reveal your IP address to the sender.");
        localStorage.setItem(REMOTE_RESOURCES_WARNED_KEY, "1");
      }
    } catch {
      // ignore
    }
  };

  return (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
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
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold leading-tight flex-1">
                {selectedEmail.subject || "(No subject)"}
              </h2>
              <Badge
                variant={selectedEmail.status === "UNREAD" ? "default" : "secondary"}
                className={cn(
                  selectedEmail.status === "UNREAD" &&
                    "bg-primary/10 text-primary border-primary/20"
                )}
              >
                {selectedEmail.status === "UNREAD" ? "New" : "Read"}
              </Badge>
            </div>

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
                <p>
                  {new Date(selectedEmail.receivedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="text-muted-foreground/60">To:</span>{" "}
                <span className="font-mono">{selectedEmail.toAddress}</span>
              </span>
              <span>
                <span className="text-muted-foreground/60">Mailbox:</span>{" "}
                <span className="font-mono">{selectedEmail.mailbox.address}</span>
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={previewMode === "text" ? "default" : "outline"}
                onClick={() => setManualPreviewMode("text")}
              >
                Text
              </Button>
              <Button
                size="sm"
                variant={previewMode === "html" ? "default" : "outline"}
                onClick={() => setManualPreviewMode("html")}
                disabled={!selectedEmail.htmlBody}
              >
                HTML
              </Button>
              <Button
                size="sm"
                variant={previewMode === "raw" ? "default" : "outline"}
                onClick={() => setManualPreviewMode("raw")}
                disabled={!selectedEmail.rawContent}
              >
                Raw
              </Button>
            </div>

            {previewMode === "html" && selectedEmail.htmlBody && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  Load remote images
                </div>
                <Switch checked={allowRemoteResources} onCheckedChange={handleAllowRemoteResourcesChange} />
              </div>
            )}

            {previewMode === "html" && selectedEmail.htmlBody ? (
              <EmailHtmlPreview html={selectedEmail.htmlBody} allowRemoteResources={allowRemoteResources} />
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
  );
}
