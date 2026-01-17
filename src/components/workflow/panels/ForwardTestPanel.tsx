"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { NodeType, ForwardEmailData, ForwardTelegramData, ForwardDiscordData, ForwardSlackData, ForwardWebhookData } from "@/lib/workflow/types";
import { DEFAULT_FORWARD_TEMPLATES } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

// 示例邮件数据
const SAMPLE_EMAIL = {
  id: "sample-email-123",
  messageId: "<sample@example.com>",
  fromAddress: "sender@example.com",
  fromName: "John Doe",
  toAddress: "you@yourdomain.com",
  replyTo: "sender@example.com",
  subject: "Test Email Subject",
  textBody: "This is a test email body content.\n\nBest regards,\nJohn",
  htmlBody: "<p>This is a test email body content.</p><p>Best regards,<br/>John</p>",
  receivedAt: new Date().toISOString(),
};

interface ForwardTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeType: NodeType;
  nodeData: ForwardEmailData | ForwardTelegramData | ForwardDiscordData | ForwardSlackData | ForwardWebhookData;
}

export function ForwardTestDialog({
  open,
  onOpenChange,
  nodeType,
  nodeData,
}: ForwardTestDialogProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await fetch("/api/workflows/test-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: nodeType,
          config: nodeData,
          email: SAMPLE_EMAIL,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || "Test successful!",
          details: data.details,
        });
        toast.success("Test completed successfully");
      } else {
        setResult({
          success: false,
          message: data.error || "Test failed",
          details: data.details,
        });
        toast.error(data.error || "Test failed");
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Test failed",
      });
      toast.error("Failed to run test");
    } finally {
      setTesting(false);
    }
  };

  const getConfigSummary = () => {
    switch (nodeType) {
      case "forward:email":
        return `To: ${(nodeData as ForwardEmailData).to || "Not configured"}`;
      case "forward:telegram":
        return `Chat ID: ${(nodeData as ForwardTelegramData).chatId || "Not configured"}`;
      case "forward:discord":
        return `Webhook: ${(nodeData as ForwardDiscordData).webhookUrl ? "Configured" : "Not configured"}`;
      case "forward:slack":
        return `Webhook: ${(nodeData as ForwardSlackData).webhookUrl ? "Configured" : "Not configured"}`;
      case "forward:webhook":
        return `URL: ${(nodeData as ForwardWebhookData).url || "Not configured"}`;
      default:
        return "Unknown type";
    }
  };

  const isConfigured = () => {
    switch (nodeType) {
      case "forward:email":
        return !!(nodeData as ForwardEmailData).to;
      case "forward:telegram":
        return !!(nodeData as ForwardTelegramData).token && !!(nodeData as ForwardTelegramData).chatId;
      case "forward:discord":
        return !!(nodeData as ForwardDiscordData).webhookUrl;
      case "forward:slack":
        return !!(nodeData as ForwardSlackData).webhookUrl;
      case "forward:webhook":
        return !!(nodeData as ForwardWebhookData).url;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Test Forward</DialogTitle>
          <DialogDescription>
            Send a test message using the sample email data below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
            <p className="font-medium">Target Configuration</p>
            <p className="text-muted-foreground">{getConfigSummary()}</p>
          </div>

          <div className="space-y-2">
            <Label>Sample Email Data</Label>
            <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 font-mono">
              <p><span className="text-muted-foreground">From:</span> {SAMPLE_EMAIL.fromName} &lt;{SAMPLE_EMAIL.fromAddress}&gt;</p>
              <p><span className="text-muted-foreground">To:</span> {SAMPLE_EMAIL.toAddress}</p>
              <p><span className="text-muted-foreground">Subject:</span> {SAMPLE_EMAIL.subject}</p>
              <p className="text-muted-foreground pt-1 truncate">Body: {SAMPLE_EMAIL.textBody.slice(0, 50)}...</p>
            </div>
          </div>

          {result && (
            <div
              className={cn(
                "p-3 rounded-lg flex items-start gap-2",
                result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              )}
            >
              {result.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              <div className="text-sm">
                <p className="font-medium">{result.message}</p>
                {result.details && (
                  <p className="mt-1 text-xs opacity-75">{result.details}</p>
                )}
              </div>
            </div>
          )}

          {!isConfigured() && (
            <div className="p-3 rounded-lg bg-amber-50 text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm">
                Please configure all required fields before testing.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleTest}
            disabled={testing || !isConfigured()}
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 模板选择器组件
interface TemplateSelectorProps {
  type: "telegram" | "discord" | "slack" | "webhook";
  value: string;
  onChange: (template: string) => void;
}

export function TemplateSelector({ type, value, onChange }: TemplateSelectorProps) {
  const templates = DEFAULT_FORWARD_TEMPLATES[type];
  const templateOptions = Object.entries(templates) as [string, string][];

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    const template = templates[templateKey as keyof typeof templates];
    if (template) {
      onChange(template);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Template</Label>
        <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
          <SelectTrigger className="w-[140px] h-7 text-xs">
            <SelectValue placeholder="Load template" />
          </SelectTrigger>
          <SelectContent>
            {templateOptions.map(([key]) => (
              <SelectItem key={key} value={key} className="text-xs">
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter message template..."
        rows={4}
        className="text-xs font-mono"
      />
      <p className="text-xs text-muted-foreground">
        Available variables: {"{{email.subject}}"}, {"{{email.fromAddress}}"}, {"{{email.fromName}}"}, {"{{email.toAddress}}"}, {"{{email.textBody}}"}, {"{{email.receivedAt}}"}
      </p>
    </div>
  );
}

// 测试按钮组件
interface TestButtonProps {
  nodeType: NodeType;
  nodeData: ForwardEmailData | ForwardTelegramData | ForwardDiscordData | ForwardSlackData | ForwardWebhookData;
}

export function ForwardTestButton({ nodeType, nodeData }: TestButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="w-full"
      >
        <Play className="h-3.5 w-3.5 mr-2" />
        Test Forward
      </Button>
      <ForwardTestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        nodeType={nodeType}
        nodeData={nodeData}
      />
    </>
  );
}
