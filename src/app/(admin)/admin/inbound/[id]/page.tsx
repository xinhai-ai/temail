"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { isVercelDeployment } from "@/lib/deployment/public";

interface InboundEmail {
  id: string;
  sourceType: string;
  messageId?: string | null;
  fromAddress?: string | null;
  fromName?: string | null;
  toAddress: string;
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: boolean | null;
  rawContentPath?: string | null;
  receivedAt: string;
  domain: { id: string; name: string };
  mailbox?: { id: string; address: string; userId: string } | null;
}

export default function AdminInboundEmailDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const t = useTranslations("admin");
  const vercelMode = isVercelDeployment();

  const [inboundEmail, setInboundEmail] = useState<InboundEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [rawExpanded, setRawExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/admin/inbound/${id}`);
        if (res.ok) {
          const data = await res.json();
          setInboundEmail(data);
        }
      } catch (error) {
        console.error("Failed to fetch inbound email:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleRawExpand = async () => {
    const newExpanded = !rawExpanded;
    setRawExpanded(newExpanded);

    if (!newExpanded || rawContent || loadingRaw) return;

    // Lazy load raw content from API
    if (inboundEmail?.rawContent || inboundEmail?.rawContentPath) {
      setLoadingRaw(true);
      try {
        const res = await fetch(`/api/admin/inbound/${id}/raw`);
        if (res.ok) {
          const text = await res.text();
          setRawContent(text);
        } else {
          toast.error(t("inbound.detail.raw.loadFailed"));
        }
      } catch (error) {
        console.error("Failed to load raw content:", error);
        toast.error(t("inbound.detail.raw.loadFailed"));
      } finally {
        setLoadingRaw(false);
      }
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm(t("inbound.actions.deleteConfirm"))) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/inbound/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || t("inbound.actions.deleteFailed"));
        return;
      }
      toast.success(t("inbound.actions.deleted"));
      router.push("/admin/inbound");
      router.refresh();
    } catch {
      toast.error(t("inbound.actions.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">{t("common.loading")}</div>;
  }

  if (!inboundEmail) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p>{t("inbound.detail.notFound")}</p>
        <Button className="mt-4" asChild>
          <Link href="/admin/inbound">{t("common.back")}</Link>
        </Button>
      </div>
    );
  }

  const hasRawContent = !vercelMode && (inboundEmail.rawContent || inboundEmail.rawContentPath);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">{t("inbound.detail.title")}</h1>
          <p className="text-muted-foreground break-all">{inboundEmail.id}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/inbound">{t("common.back")}</Link>
          </Button>
          <Button
            variant="outline"
            disabled={deleting}
            onClick={handleDelete}
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.delete")}
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{inboundEmail.sourceType}</Badge>
          <Badge variant="secondary">{inboundEmail.domain.name}</Badge>
          {inboundEmail.mailbox ? (
            <Badge>{inboundEmail.mailbox.address}</Badge>
          ) : (
            <Badge variant="secondary">{t("common.unmatched")}</Badge>
          )}
        </div>
        <div className="space-y-1 text-sm">
          <div>
            <span className="font-medium">{t("inbound.detail.fields.received")}:</span>{" "}
            {format(new Date(inboundEmail.receivedAt), "PPpp")}
          </div>
          <div>
            <span className="font-medium">{t("inbound.detail.fields.from")}:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.fromAddress || "-"}</span>
          </div>
          <div>
            <span className="font-medium">{t("inbound.detail.fields.to")}:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.toAddress}</span>
          </div>
          <div>
            <span className="font-medium">{t("inbound.detail.fields.subject")}:</span> {inboundEmail.subject}
          </div>
          <div>
            <span className="font-medium">{t("inbound.detail.fields.messageId")}:</span>{" "}
            <span className="font-mono text-xs">{inboundEmail.messageId || "-"}</span>
          </div>
        </div>
      </Card>

      {inboundEmail.textBody && (
        <Card className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">{t("inbound.detail.sections.textBody")}</h2>
          <pre className="whitespace-pre-wrap break-words text-sm">{inboundEmail.textBody}</pre>
        </Card>
      )}

      {inboundEmail.htmlBody && (
        <Card className="p-6 space-y-2">
          <h2 className="text-lg font-semibold">{t("inbound.detail.sections.htmlBody")}</h2>
          <pre className="whitespace-pre-wrap break-words text-sm">{inboundEmail.htmlBody}</pre>
        </Card>
      )}

      {hasRawContent && (
        <Card className="p-6 space-y-2">
          <details open={rawExpanded} onToggle={handleRawExpand}>
            <summary className="cursor-pointer text-lg font-semibold">{t("inbound.detail.sections.raw")}</summary>
            {loadingRaw ? (
              <div className="mt-3 flex items-center justify-center h-[200px] bg-slate-950 rounded-md">
                <div className="text-slate-400">{t("inbound.detail.raw.loading")}</div>
              </div>
            ) : rawContent ? (
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[520px]">
                {rawContent}
              </pre>
            ) : (
              <div className="mt-3 flex items-center justify-center h-[200px] bg-slate-950 rounded-md">
                <div className="text-slate-400">{t("inbound.detail.raw.clickToLoad")}</div>
              </div>
            )}
          </details>
        </Card>
      )}
    </div>
  );
}
