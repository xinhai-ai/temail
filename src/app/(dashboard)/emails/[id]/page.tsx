"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailHtmlPreview } from "@/components/email/EmailHtmlPreview";
import { DkimStatusIndicator } from "@/components/email/DkimStatusIndicator";
import { ArrowLeft, Star, Trash2, Mail, Paperclip, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { isVercelDeployment } from "@/lib/deployment/public";

interface Email {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: string | boolean | null;  // true = available via /raw API, string = inline content
  rawContentPath?: string | null;
  messageId?: string | null;
  status: string;
  isStarred: boolean;
  receivedAt: string;
  mailbox: { address: string };
  headers?: Array<{ id: string; name: string; value: string }>;
  attachments?: Array<{ id: string; filename: string; contentType: string; size: number }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("emailDetail");
  const tCommon = useTranslations("common");
  const tInbox = useTranslations("inbox");
  const vercelMode = isVercelDeployment();
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHtml, setShowHtml] = useState(true);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);

  useEffect(() => {
    const fetchEmail = async () => {
      const res = await fetch(`/api/emails/${id}`);
      if (res.ok) {
        const data = await res.json();
        setEmail(data);
      }
      setLoading(false);
    };
    fetchEmail();
  }, [id]);

  const handleStar = async () => {
    if (!email) return;
    await fetch(`/api/emails/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStarred: !email.isStarred }),
    });
    setEmail({ ...email, isStarred: !email.isStarred });
  };

  const handleDelete = async () => {
    if (!confirm(t("confirm.moveToTrash"))) return;
    const res = await fetch(`/api/emails/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("toasts.movedToTrash"));
      router.push("/inbox");
    }
  };

  const handleRawExpand = async () => {
    const newExpanded = !rawExpanded;
    setRawExpanded(newExpanded);

    // If already have content or not expanding, skip
    if (!newExpanded || rawContent) return;

    // If rawContent is a string (inline content from legacy), use it directly
    if (typeof email?.rawContent === "string") {
      setRawContent(email.rawContent);
      return;
    }

    // Lazy load raw content from API (for both rawContentPath and rawContent=true cases)
    if (email?.rawContentPath || email?.rawContent === true) {
      setLoadingRaw(true);
      try {
        const res = await fetch(`/api/emails/${id}/raw`);
        if (res.ok) {
          const text = await res.text();
          setRawContent(text);
        } else {
          toast.error(tInbox("preview.raw.loadFailed"));
        }
      } catch (error) {
        console.error("Failed to load raw content:", error);
        toast.error(tInbox("preview.raw.loadFailed"));
      } finally {
        setLoadingRaw(false);
      }
    }
  };

  const handleDownloadAttachment = (attachmentId: string, filename: string) => {
    const url = `/api/emails/${id}/attachments/${attachmentId}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return <div className="flex justify-center p-8">{tCommon("loading")}</div>;
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p>{tInbox("preview.emailNotFound")}</p>
        <Button className="mt-4" onClick={() => router.push("/inbox")}>
          {t("actions.backToInbox")}
        </Button>
      </div>
    );
  }

  const hasRawContent = !vercelMode && (email.rawContent || email.rawContentPath);
  const displayRawContent = rawContent || (typeof email.rawContent === "string" ? email.rawContent : null);
  const distanceLocale = locale === "zh" ? zhCN : enUS;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/inbox")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("actions.back")}
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" onClick={handleStar}>
          <Star
            className={`h-4 w-4 ${
              email.isStarred ? "fill-yellow-400 text-yellow-400" : ""
            }`}
          />
        </Button>
        <Button variant="ghost" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">
                {email.subject || tInbox("email.noSubject")}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {tInbox("preview.to")}: {email.mailbox.address}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!vercelMode ? <DkimStatusIndicator emailId={email.id} /> : null}
              <Badge variant={email.status === "UNREAD" ? "default" : "secondary"}>
                {email.status === "UNREAD" ? tInbox("email.status.new") : tInbox("email.status.read")}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {email.fromName || email.fromAddress}
              </p>
              {email.fromName && (
                <p className="text-sm text-muted-foreground">
                  {email.fromAddress}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{new Date(email.receivedAt).toLocaleString(locale)}</p>
              <p>
                {formatDistanceToNow(new Date(email.receivedAt), {
                  addSuffix: true,
                  locale: distanceLocale,
                })}
              </p>
            </div>
          </div>

          <Separator />

          {email.htmlBody && email.textBody && (
            <div className="flex gap-2">
              <Button
                variant={showHtml ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHtml(true)}
              >
                {tInbox("preview.mode.html")}
              </Button>
              <Button
                variant={!showHtml ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHtml(false)}
              >
                {tInbox("preview.mode.text")}
              </Button>
            </div>
          )}

          <div className="min-h-[300px] rounded border bg-white overflow-hidden">
            {showHtml && email.htmlBody ? (
              <EmailHtmlPreview
                html={email.htmlBody}
                className="w-full h-[600px] border-0"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans p-4">
                {email.textBody || tInbox("preview.text.unavailable")}
              </pre>
            )}
          </div>

          {/* Attachments section */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-3">
                <Paperclip className="h-4 w-4" />
                <span>{tInbox("preview.attachments", { count: email.attachments.length })}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between gap-2 py-2 px-3 rounded border bg-background"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} - {attachment.contentType}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadAttachment(attachment.id, attachment.filename)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("metadata.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.messageId")}</span>
              <span className="font-mono text-xs break-all">{email.messageId || "-"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.mailbox")}</span>
              <span className="font-mono text-xs break-all">{email.mailbox.address}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.from")}</span>
              <span className="font-mono text-xs break-all">{email.fromAddress}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.to")}</span>
              <span className="font-mono text-xs break-all">{email.toAddress}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.headers")}</span>
              <span>{email.headers?.length || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("metadata.fields.attachments")}</span>
              <span>{email.attachments?.length || 0}</span>
            </div>
          </div>

          {Boolean(email.headers?.length) && (
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("metadata.headersSummary", { count: email.headers?.length || 0 })}
              </summary>
              <div className="mt-3 max-h-[360px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("metadata.table.name")}</TableHead>
                      <TableHead>{t("metadata.table.value")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(email.headers || []).map((header) => (
                      <TableRow key={header.id}>
                        <TableCell className="font-mono text-xs whitespace-normal break-words align-top">
                          {header.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-normal break-words align-top">
                          {header.value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          )}

          {hasRawContent && (
            <details className="rounded-md border bg-muted/30 p-3" open={rawExpanded} onToggle={handleRawExpand}>
              <summary className="cursor-pointer text-sm font-medium">{t("metadata.rawSummary")}</summary>
              {loadingRaw ? (
                <div className="mt-3 flex items-center justify-center h-[200px] bg-slate-950 rounded-md">
                  <div className="text-slate-400">{tInbox("preview.raw.loading")}</div>
                </div>
              ) : displayRawContent ? (
                <pre className="mt-3 whitespace-pre-wrap break-words text-xs bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[520px]">
                  {displayRawContent}
                </pre>
              ) : (
                <div className="mt-3 flex items-center justify-center h-[200px] bg-slate-950 rounded-md">
                  <div className="text-slate-400">{tInbox("preview.raw.unavailable")}</div>
                </div>
              )}
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
