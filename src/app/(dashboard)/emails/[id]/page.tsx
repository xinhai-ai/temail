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
import { ArrowLeft, Star, Trash2, Mail } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

interface Email {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  rawContent?: string | null;
  messageId?: string | null;
  status: string;
  isStarred: boolean;
  receivedAt: string;
  mailbox: { address: string };
  headers?: Array<{ id: string; name: string; value: string }>;
  attachments?: Array<{ id: string; filename: string; contentType: string; size: number }>;
}

export default function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHtml, setShowHtml] = useState(true);

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
    if (!confirm("Delete this email?")) return;
    const res = await fetch(`/api/emails/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Email deleted");
      router.push("/emails");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p>Email not found</p>
        <Button className="mt-4" onClick={() => router.push("/emails")}>
          Back to Emails
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push("/emails")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
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
                {email.subject || "(No subject)"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                To: {email.mailbox.address}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DkimStatusIndicator emailId={email.id} />
              <Badge>{email.status}</Badge>
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
              <p>{format(new Date(email.receivedAt), "PPpp")}</p>
              <p>
                {formatDistanceToNow(new Date(email.receivedAt), {
                  addSuffix: true,
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
                HTML
              </Button>
              <Button
                variant={!showHtml ? "default" : "outline"}
                size="sm"
                onClick={() => setShowHtml(false)}
              >
                Text
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
                {email.textBody || "No content"}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium">Message-Id</span>
              <span className="font-mono text-xs break-all">{email.messageId || "-"}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Mailbox</span>
              <span className="font-mono text-xs break-all">{email.mailbox.address}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">From</span>
              <span className="font-mono text-xs break-all">{email.fromAddress}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">To</span>
              <span className="font-mono text-xs break-all">{email.toAddress}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Headers</span>
              <span>{email.headers?.length || 0}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Attachments</span>
              <span>{email.attachments?.length || 0}</span>
            </div>
          </div>

          {Boolean(email.headers?.length) && (
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Headers ({email.headers?.length})
              </summary>
              <div className="mt-3 max-h-[360px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
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

          {email.rawContent && (
            <details className="rounded-md border bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium">Raw content</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[520px]">
                {email.rawContent}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
