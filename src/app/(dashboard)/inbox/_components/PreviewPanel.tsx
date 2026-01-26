"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect } from "react";
import { EmailHtmlPreview } from "@/components/email/EmailHtmlPreview";
import { DkimStatusIndicator } from "@/components/email/DkimStatusIndicator";
import { ChevronDown, Copy, Download, Globe, Image as ImageIcon, ImageOff as ImageOffIcon, Mail, Paperclip } from "lucide-react";
import type { EmailDetail } from "../types";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

type PreviewPanelProps = {
  selectedEmailId: string | null;
  selectedEmail: EmailDetail | null;
  loadingPreview: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function extractRemoteImageHosts(html: string): string[] {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return [];

  const hosts = new Set<string>();
  const addUrlHost = (urlValue: string) => {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("data:") || trimmed.startsWith("cid:") || trimmed.startsWith("blob:")) return;
    const absolute = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
    if (!absolute.startsWith("http://") && !absolute.startsWith("https://")) return;

    try {
      const parsed = new URL(absolute);
      if (parsed.hostname) hosts.add(parsed.hostname.toLowerCase());
    } catch {
      // ignore
    }
  };

  const addSrcsetHosts = (value: string | null) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const url = part.trim().split(/\s+/)[0] || "";
      addUrlHost(url);
    }
  };

  const addSrcHosts = (value: string | null) => {
    if (!value) return;
    addUrlHost(value);
  };

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("img").forEach((img) => {
      addSrcHosts(img.getAttribute("src"));
      addSrcsetHosts(img.getAttribute("srcset"));
    });
    doc.querySelectorAll("source").forEach((source) => {
      addSrcsetHosts(source.getAttribute("srcset"));
    });
  } catch {
    return [];
  }

  return Array.from(hosts).sort((a, b) => a.localeCompare(b));
}

export function PreviewPanel({
  selectedEmailId,
  selectedEmail,
  loadingPreview,
}: PreviewPanelProps) {
  const locale = useLocale();
  const t = useTranslations("inbox");

  const REMOTE_RESOURCES_WARNED_KEY = "temail.preview.remoteResourcesWarned";
  const REMOTE_RESOURCES_ALLOWED_SENDERS_KEY = "temail.preview.allowedRemoteSenders";
  const REMOTE_RESOURCES_ALLOWED_HOSTS_KEY = "temail.preview.allowedRemoteHosts";

  const [manualPreviewMode, setManualPreviewMode] = useState<"text" | "html" | "raw" | null>(null);
  const [allowRemoteForMessage, setAllowRemoteForMessage] = useState(false);
  const [allowedRemoteSenders, setAllowedRemoteSenders] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(REMOTE_RESOURCES_ALLOWED_SENDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value) => typeof value === "string").map((value) => value.trim().toLowerCase()).filter(Boolean);
    } catch {
      return [];
    }
  });
  const [allowedRemoteHosts, setAllowedRemoteHosts] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(REMOTE_RESOURCES_ALLOWED_HOSTS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((value) => typeof value === "string").map((value) => value.trim().toLowerCase()).filter(Boolean);
    } catch {
      return [];
    }
  });

  // Lazy loading state for raw content
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);

  // Reset raw content when email changes
  useEffect(() => {
    setRawContent(null);
    setManualPreviewMode(null);
    setAllowRemoteForMessage(false);
  }, [selectedEmailId]);

  const previewMode: "text" | "html" | "raw" = manualPreviewMode ?? (selectedEmail?.htmlBody ? "html" : "text");

  // Check if raw content is available (either in database or file)
  // rawContent can be: string (inline), true (available via API), or rawContentPath (file storage)
  const hasRawContent = selectedEmail?.rawContent || selectedEmail?.rawContentPath;

  const warnAboutRemoteResources = () => {
    try {
      const warned = localStorage.getItem(REMOTE_RESOURCES_WARNED_KEY) === "1";
      if (!warned) {
        toast.warning(t("preview.remoteImages.warning"));
        localStorage.setItem(REMOTE_RESOURCES_WARNED_KEY, "1");
      }
    } catch {
      toast.warning(t("preview.remoteImages.warning"));
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(REMOTE_RESOURCES_ALLOWED_SENDERS_KEY, JSON.stringify(allowedRemoteSenders));
    } catch {
      // ignore
    }
  }, [allowedRemoteSenders, REMOTE_RESOURCES_ALLOWED_SENDERS_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(REMOTE_RESOURCES_ALLOWED_HOSTS_KEY, JSON.stringify(allowedRemoteHosts));
    } catch {
      // ignore
    }
  }, [allowedRemoteHosts, REMOTE_RESOURCES_ALLOWED_HOSTS_KEY]);

  const handleRawClick = async () => {
    setManualPreviewMode("raw");

    // If raw content is already loaded from API, use it
    if (rawContent) return;

    // If rawContent is a string (inline content from legacy), use it directly
    if (typeof selectedEmail?.rawContent === "string") {
      setRawContent(selectedEmail.rawContent);
      return;
    }

    // If already loading, skip
    if (loadingRaw) return;

    // Lazy load from API (for both rawContentPath and rawContent=true cases)
    if (selectedEmailId && hasRawContent) {
      setLoadingRaw(true);
      try {
        const res = await fetch(`/api/emails/${selectedEmailId}/raw`);
	        if (res.ok) {
	          const text = await res.text();
	          setRawContent(text);
	        } else {
	          toast.error(t("preview.raw.loadFailed"));
	        }
	      } catch (error) {
	        console.error("Failed to load raw content:", error);
	        toast.error(t("preview.raw.loadFailed"));
	      } finally {
	        setLoadingRaw(false);
	      }
    }
  };

  const handleDownloadAttachment = (attachmentId: string, filename: string) => {
    if (!selectedEmailId) return;
    const url = `/api/emails/${selectedEmailId}/attachments/${attachmentId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Get the raw content to display (only use selectedEmail.rawContent if it's a string)
  const displayRawContent = rawContent || (typeof selectedEmail?.rawContent === "string" ? selectedEmail.rawContent : null);

  const remoteImageHosts = useMemo(() => {
    if (!selectedEmail?.htmlBody) return [];
    return extractRemoteImageHosts(selectedEmail.htmlBody);
  }, [selectedEmail?.htmlBody]);
  const allowedRemoteHostsSet = new Set(allowedRemoteHosts);
  const allowedRemoteSendersSet = new Set(allowedRemoteSenders);
  const senderKey = selectedEmail?.fromAddress?.trim().toLowerCase() || "";
  const senderAllowed = Boolean(senderKey && allowedRemoteSendersSet.has(senderKey));
  const allowAllRemoteImages = allowRemoteForMessage || senderAllowed;
  const allowedRemoteHostsForMessage = allowAllRemoteImages
    ? []
    : remoteImageHosts.filter((host) => allowedRemoteHostsSet.has(host));
  const remoteContentBlocked =
    previewMode === "html" &&
    Boolean(selectedEmail?.htmlBody) &&
    remoteImageHosts.length > 0 &&
    !allowAllRemoteImages &&
    allowedRemoteHostsForMessage.length < remoteImageHosts.length;

  const copyRawContent = async () => {
    if (!displayRawContent) return;
    try {
      await navigator.clipboard.writeText(displayRawContent);
      toast.success(t("toast.clipboard.copied"));
    } catch (error) {
      console.error("Failed to copy raw content:", error);
      toast.error(t("toast.clipboard.failed"));
    }
  };

  const downloadRawContent = async () => {
    if (!selectedEmailId) return;
    const filename = `email-${selectedEmailId}.eml`;
    const downloadText = async (text: string) => {
      const blob = new Blob([text], { type: "message/rfc822" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    try {
      if (displayRawContent) {
        await downloadText(displayRawContent);
        return;
      }

      const res = await fetch(`/api/emails/${selectedEmailId}/raw`);
      if (!res.ok) {
        toast.error(t("preview.raw.downloadFailed"));
        return;
      }
      const text = await res.text();
      await downloadText(text);
    } catch (error) {
      console.error("Failed to download raw content:", error);
      toast.error(t("preview.raw.downloadFailed"));
    }
  };

  return (
    <Card className="border-border/50 overflow-hidden flex flex-col h-full">
      <CardContent className="p-4 space-y-3 flex-1 overflow-auto">
	        {!selectedEmailId ? (
	          <EmptyState
	            icon={<Mail className="h-8 w-8 text-muted-foreground" />}
	            title={t("preview.empty.title")}
	            description={t("preview.empty.description")}
	          />
	        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              {loadingPreview ? (
                <Skeleton className="h-6 w-3/4" />
	              ) : selectedEmail ? (
	                <h2 className="text-lg font-semibold leading-tight flex-1">
	                  {selectedEmail.subject || t("email.noSubject")}
	                </h2>
	              ) : (
	                <h2 className="text-lg font-semibold leading-tight flex-1">{t("preview.emailNotFound")}</h2>
	              )}
              <div className="flex items-center gap-2 flex-shrink-0">
                <DkimStatusIndicator emailId={selectedEmailId} />
                {loadingPreview ? (
                  <Skeleton className="h-5 w-16 rounded-full" />
                ) : selectedEmail ? (
                  <Badge
                    variant={selectedEmail.status === "UNREAD" ? "default" : "secondary"}
                    className={cn(
                      selectedEmail.status === "UNREAD" &&
                        "bg-primary/10 text-primary border-primary/20"
                    )}
	                  >
	                    {selectedEmail.status === "UNREAD" ? t("email.status.new") : t("email.status.read")}
	                  </Badge>
	                ) : null}
              </div>
            </div>

            {loadingPreview ? (
              <div className="space-y-4">
                <div className="space-y-2">
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
	              <div className="text-sm text-muted-foreground">{t("preview.emailNotFound")}</div>
	            ) : (
              <>
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
	                    <p>{new Date(selectedEmail.receivedAt).toLocaleDateString(locale)}</p>
	                    <p>
	                      {new Date(selectedEmail.receivedAt).toLocaleTimeString(locale, {
	                        hour: "2-digit",
	                        minute: "2-digit",
	                      })}
	                    </p>
	                  </div>
                </div>

	                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
	                  <span>
	                    <span className="text-muted-foreground/60">{t("preview.to")}:</span>{" "}
	                    <span className="font-mono">{selectedEmail.toAddress}</span>
	                  </span>
	                  <span>
	                    <span className="text-muted-foreground/60">{t("preview.mailbox")}:</span>{" "}
	                    <span className="font-mono">{selectedEmail.mailbox.address}</span>
	                  </span>
	                </div>

                {selectedEmail.tags && selectedEmail.tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedEmail.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : null}

	                <div className="flex items-center gap-2">
	                  <Button
	                    size="sm"
	                    variant={previewMode === "text" ? "default" : "outline"}
	                    onClick={() => setManualPreviewMode("text")}
	                  >
	                    {t("preview.mode.text")}
	                  </Button>
	                  <Button
	                    size="sm"
	                    variant={previewMode === "html" ? "default" : "outline"}
	                    onClick={() => setManualPreviewMode("html")}
	                    disabled={!selectedEmail.htmlBody}
	                  >
	                    {t("preview.mode.html")}
	                  </Button>
	                  <Button
	                    size="sm"
	                    variant={previewMode === "raw" ? "default" : "outline"}
	                    onClick={handleRawClick}
	                    disabled={!hasRawContent}
	                  >
	                    {t("preview.mode.raw")}
	                  </Button>
	                </div>

                  {remoteContentBlocked ? (
                    <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <ImageOffIcon className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <p className="text-sm text-muted-foreground leading-snug">
                          {t("preview.remoteContent.blocked")}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" size="sm" variant="outline" className="flex-shrink-0">
                            {t("preview.remoteContent.actions.show")}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuLabel>{t("preview.remoteContent.menuTitle")}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              warnAboutRemoteResources();
                              setAllowRemoteForMessage(true);
                            }}
                          >
                            <ImageIcon />
                            {t("preview.remoteContent.actions.showOnce")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              if (!senderKey) return;
                              warnAboutRemoteResources();
                              setAllowedRemoteSenders((prev) => {
                                const next = new Set(prev);
                                next.add(senderKey);
                                return Array.from(next).sort((a, b) => a.localeCompare(b));
                              });
                            }}
                            disabled={!senderKey}
                          >
                            <Mail />
                            {t("preview.remoteContent.actions.allowSender")}
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger disabled={remoteImageHosts.length === 0}>
                              <Globe />
                              {t("preview.remoteContent.actions.allowDomain")}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                              {remoteImageHosts.length === 0 ? (
                                <DropdownMenuItem disabled>
                                  {t("preview.remoteContent.noDomains")}
                                </DropdownMenuItem>
                              ) : (
                                remoteImageHosts.map((host) => (
                                  <DropdownMenuCheckboxItem
                                    key={host}
                                    checked={allowedRemoteHostsSet.has(host)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(checked) => {
                                      warnAboutRemoteResources();
                                      setAllowedRemoteHosts((prev) => {
                                        const next = new Set(prev);
                                        if (checked) {
                                          next.add(host);
                                        } else {
                                          next.delete(host);
                                        }
                                        return Array.from(next).sort((a, b) => a.localeCompare(b));
                                      });
                                    }}
                                  >
                                    {host}
                                  </DropdownMenuCheckboxItem>
                                ))
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ) : null}

	                {previewMode === "html" && selectedEmail.htmlBody ? (
	                  <EmailHtmlPreview
                      html={selectedEmail.htmlBody}
                      allowRemoteResources={allowAllRemoteImages}
                      allowedRemoteImageHosts={allowAllRemoteImages ? undefined : allowedRemoteHostsForMessage}
                    />
		                ) : previewMode === "raw" ? (
                      <div className="rounded-md border bg-muted/30 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background/50">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("preview.mode.raw")}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => void copyRawContent()}
                              disabled={loadingRaw || !displayRawContent}
                              title={t("preview.raw.copy")}
                              aria-label={t("preview.raw.copy")}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => void downloadRawContent()}
                              disabled={loadingRaw || !hasRawContent}
                              title={t("preview.raw.download")}
                              aria-label={t("preview.raw.download")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {loadingRaw ? (
                          <div className="flex items-center justify-center min-h-[360px]">
                            <div className="text-sm text-muted-foreground">
                              {t("preview.raw.loading")}
                            </div>
                          </div>
                        ) : displayRawContent ? (
                          <pre className="whitespace-pre-wrap break-words text-xs font-mono p-4 overflow-auto max-h-[520px] text-foreground">
                            {displayRawContent}
                          </pre>
                        ) : (
                          <div className="flex items-center justify-center min-h-[360px]">
                            <div className="text-sm text-muted-foreground">
                              {t("preview.raw.unavailable")}
                            </div>
                          </div>
                        )}
                      </div>
		                ) : (
		                  <pre className="whitespace-pre-wrap break-words text-sm bg-muted/30 p-4 rounded-md border min-h-[360px]">
		                    {selectedEmail.textBody || t("preview.text.unavailable")}
		                  </pre>
		                )}

                {/* Attachments section */}
	                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
	                  <div className="rounded-md border bg-muted/30 p-3">
	                    <div className="flex items-center gap-2 text-sm font-medium mb-2">
	                      <Paperclip className="h-4 w-4" />
	                      <span>{t("preview.attachments", { count: selectedEmail.attachments.length })}</span>
	                    </div>
                    <div className="space-y-1">
                      {selectedEmail.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{attachment.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
