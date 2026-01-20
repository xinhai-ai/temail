"use client";

import { useState } from "react";
import { useWorkflowStore, selectSelectedNode } from "@/lib/workflow/store";
import {
  NODE_DEFINITIONS,
  NodeType,
  MATCH_FIELD_LABELS,
  MATCH_OPERATOR_LABELS,
  VALUE_OPERATORS,
  DEFAULT_FORWARD_TEMPLATES,
  type CompositeCondition,
  type EmailContentField,
  type KeywordSet,
  type MatchField,
  type MatchOperator,
} from "@/lib/workflow/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Trash2, Play, FileText, Settings2, ChevronDown, ChevronRight, Plus, Pencil, GitBranch, Info, HelpCircle, Tag } from "lucide-react";
import { ConditionBuilder, SimpleConditionEditor } from "./ConditionBuilder";
import { ForwardTestButton, TemplateSelector } from "./ForwardTestPanel";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NodeManualDialog } from "../node-manuals/NodeManualDialog";

interface NodeConfigPanelProps {
  mailboxes?: { id: string; address: string }[];
  onClose?: () => void;
}

export function NodeConfigPanel({ mailboxes = [], onClose }: NodeConfigPanelProps) {
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const [manualOpen, setManualOpen] = useState(false);

  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-muted/30 p-4 flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground text-center">
          Select a node to configure
        </p>
      </div>
    );
  }

  const definition = NODE_DEFINITIONS[selectedNode.type as NodeType];
  const data = (selectedNode.data || {}) as Record<string, unknown>;

  const handleChange = (key: string, value: unknown) => {
    updateNodeData(selectedNode.id, { [key]: value });
  };

  const handleDelete = () => {
    deleteNode(selectedNode.id);
  };

  return (
    <div className="w-80 border-l bg-muted/30 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded"
            style={{ backgroundColor: definition?.color || "#666" }}
          >
            <div className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-sm">{definition?.label || "Node"}</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6"
                aria-label="Open node manual"
                onClick={() => setManualOpen(true)}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{selectedNode.type}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (onClose) {
              onClose();
              return;
            }
            setSelectedNodeId(null);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Config Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-4">
          {/* 通用标签 */}
          <div className="space-y-2">
            <Label htmlFor="label" className="text-xs font-medium">Display Name</Label>
            <Input
              id="label"
              value={(data.label as string) || ""}
              onChange={(e) => handleChange("label", e.target.value)}
              placeholder={definition?.label}
              className="h-8 text-sm"
            />
          </div>

          {/* 根据节点类型显示不同的配置项 */}
          {renderNodeConfig(selectedNode.id, selectedNode.type as NodeType, data, handleChange, mailboxes)}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t flex-shrink-0 space-y-2">
        {/* 为转发节点显示测试按钮 */}
        {selectedNode.type.startsWith("forward:") && (
          <ForwardTestButton
            nodeType={selectedNode.type as NodeType}
            nodeData={data as never}
          />
        )}
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Node
        </Button>
      </div>

      <NodeManualDialog
        nodeType={selectedNode.type as NodeType}
        open={manualOpen}
        onOpenChange={setManualOpen}
      />
    </div>
  );
}

function renderNodeConfig(
  nodeId: string,
  type: NodeType,
  data: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void,
  mailboxes: { id: string; address: string }[]
) {
  switch (type) {
    case "trigger:email":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Mailbox Filter</Label>
            <Select
              value={(data.mailboxId as string) || "all"}
              onValueChange={(v) => onChange("mailboxId", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select mailbox" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mailboxes</SelectItem>
                {mailboxes.map((mb) => (
                  <SelectItem key={mb.id} value={mb.id}>
                    {mb.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Trigger when emails arrive at this mailbox
            </p>
          </div>
        </div>
      );

    case "trigger:schedule":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cron" className="text-xs font-medium">Cron Expression</Label>
            <Input
              id="cron"
              value={(data.cron as string) || ""}
              onChange={(e) => onChange("cron", e.target.value)}
              placeholder="0 * * * *"
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Examples: &quot;0 * * * *&quot; (hourly), &quot;0 9 * * *&quot; (daily at 9am)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-xs font-medium">Timezone</Label>
            <Input
              id="timezone"
              value={(data.timezone as string) || ""}
              onChange={(e) => onChange("timezone", e.target.value)}
              placeholder="UTC"
              className="h-8 text-sm"
            />
          </div>
        </div>
      );

    case "condition:match":
      return (
        <SimpleConditionEditor
          field={(data.field as MatchField) || "subject"}
          operator={(data.operator as MatchOperator) || "contains"}
          value={(data.value as string) || ""}
          caseSensitive={data.caseSensitive as boolean}
          onChange={(newData) => {
            onChange("field", newData.field);
            onChange("operator", newData.operator);
            onChange("value", newData.value);
            onChange("caseSensitive", newData.caseSensitive);
          }}
        />
      );

    case "condition:keyword": {
      const keywordMultiMode =
        Array.isArray(data.categories) ||
        Array.isArray(data.keywordSets) ||
        typeof data.defaultCategory === "string";
      if (keywordMultiMode) {
        return <KeywordMultiClassifierConfig data={data} onChange={onChange} />;
      }
      return <KeywordConditionConfig data={data} onChange={onChange} />;
    }

    case "condition:ai-classifier":
    case "condition:classifier":
      return <AiClassifierConfig data={data} onChange={onChange} />;

    case "forward:email":
      return <ForwardEmailConfig data={data} onChange={onChange} />;

    case "forward:telegram":
      return <ForwardTelegramConfig data={data} onChange={onChange} />;

    case "forward:discord":
      return <ForwardDiscordConfig data={data} onChange={onChange} />;

    case "forward:slack":
      return <ForwardSlackConfig data={data} onChange={onChange} />;

    case "forward:webhook":
      return <ForwardWebhookConfig data={data} onChange={onChange} />;

    case "control:delay":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-xs font-medium">Delay Duration</Label>
            <div className="flex gap-2">
              <Input
                id="duration"
                type="number"
                min={1}
                max={86400}
                value={(data.duration as number) || 60}
                onChange={(e) => onChange("duration", parseInt(e.target.value) || 60)}
                className="h-8 text-sm"
              />
              <span className="text-sm text-muted-foreground self-center">seconds</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Max: 86400 seconds (24 hours)
            </p>
          </div>
        </div>
      );

    case "action:setVariable":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-medium">Variable Name</Label>
            <Input
              id="name"
              value={(data.name as string) || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="myVariable"
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="value" className="text-xs font-medium">Value</Label>
            <Input
              id="value"
              value={(data.value as string) || ""}
              onChange={(e) => onChange("value", e.target.value)}
              placeholder="{{email.subject}}"
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{{email.field}}"} to reference email data
            </p>
          </div>
        </div>
      );

    case "action:unsetVariable":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-medium">Variable Name</Label>
            <Input
              id="name"
              value={(data.name as string) || ""}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="myVariable"
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Deletes the variable from the workflow context
            </p>
          </div>
        </div>
      );

    case "action:cloneVariable":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source" className="text-xs font-medium">Source Variable</Label>
            <Input
              id="source"
              value={(data.source as string) || ""}
              onChange={(e) => onChange("source", e.target.value)}
              placeholder="sourceVar"
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target" className="text-xs font-medium">Target Variable</Label>
            <Input
              id="target"
              value={(data.target as string) || ""}
              onChange={(e) => onChange("target", e.target.value)}
              placeholder="targetVar"
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
      );

    case "action:rewriteEmail":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-xs font-medium">Subject Template</Label>
            <Input
              id="subject"
              value={(data.subject as string) || ""}
              onChange={(e) => onChange("subject", e.target.value)}
              placeholder="Re: {{email.subject}}"
              className="h-8 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to keep the current subject
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="textBody" className="text-xs font-medium">Text Body Template</Label>
            <Textarea
              id="textBody"
              value={(data.textBody as string) || ""}
              onChange={(e) => onChange("textBody", e.target.value)}
              placeholder="{{email.textBody}}"
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="htmlBody" className="text-xs font-medium">HTML Body Template</Label>
            <Textarea
              id="htmlBody"
              value={(data.htmlBody as string) || ""}
              onChange={(e) => onChange("htmlBody", e.target.value)}
              placeholder="{{email.htmlBody}}"
              rows={6}
              className="font-mono text-sm"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Supports template variables like {"{{email.subject}}"} and {"{{variables.myVar}}"}
          </p>
        </div>
      );

    case "action:regexReplace": {
      const field = ((data.field as EmailContentField) || "textBody") as EmailContentField;
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Field</Label>
            <Select value={field} onValueChange={(v) => onChange("field", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subject">Subject</SelectItem>
                <SelectItem value="textBody">Body (Text)</SelectItem>
                <SelectItem value="htmlBody">Body (HTML)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pattern" className="text-xs font-medium">Pattern</Label>
            <Input
              id="pattern"
              value={(data.pattern as string) || ""}
              onChange={(e) => onChange("pattern", e.target.value)}
              placeholder="\\bfoo\\b"
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="flags" className="text-xs font-medium">Flags</Label>
            <Input
              id="flags"
              value={(data.flags as string) || "g"}
              onChange={(e) => onChange("flags", e.target.value)}
              placeholder="gim"
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Allowed: g i m s u y (default: g)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="replacement" className="text-xs font-medium">Replacement</Label>
            <Textarea
              id="replacement"
              value={(data.replacement as string) || ""}
              onChange={(e) => onChange("replacement", e.target.value)}
              placeholder=""
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Supports capture groups ($1) and template variables
            </p>
          </div>
        </div>
      );
    }

    case "action:setTags": {
      const mode = (data.mode as string) || "add";
      const tags = (data.tags as string[]) || [];
      const tagsText = tags.join("\n");

      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Mode</Label>
            <Select value={mode} onValueChange={(v) => onChange("mode", v)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add</SelectItem>
                <SelectItem value="remove">Remove</SelectItem>
                <SelectItem value="set">Set</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Add/remove/set tags on the current email
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags" className="text-xs font-medium">Tags</Label>
            <Textarea
              id="tags"
              value={tagsText}
              onChange={(e) => {
                const next = e.target.value
                  .split(/\n/)
                  .map((t) => t.trim())
                  .filter(Boolean);
                onChange("tags", next);
              }}
              placeholder={"urgent\nbilling"}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One per line. Supports template variables.
            </p>
          </div>
        </div>
      );
    }

    case "action:aiRewrite":
      return <AiRewriteActionConfig key={nodeId} data={data} onChange={onChange} />;

    case "control:branch":
      return (
        <SimpleConditionEditor
          field={((data.condition as { field?: MatchField })?.field) || "subject"}
          operator={((data.condition as { operator?: MatchOperator })?.operator) || "contains"}
          value={((data.condition as { value?: string })?.value) || ""}
          caseSensitive={(data.condition as { caseSensitive?: boolean })?.caseSensitive}
          onChange={(newData) => {
            onChange("condition", {
              field: newData.field,
              operator: newData.operator,
              value: newData.value,
              caseSensitive: newData.caseSensitive,
            });
          }}
        />
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          No additional configuration needed
        </p>
      );
  }
}

function parseOutputVariableKeys(text: string): string[] {
  return text
    .split(/[,\n，]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function AiRewriteActionConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const writeTarget = (data.writeTarget as string) || "variables";
  const fields = (data.fields as EmailContentField[]) || ["subject", "textBody"];
  const outputVariableKeys = (data.outputVariableKeys as string[]) || [];
  const canonicalOutputVariableKeysText = outputVariableKeys.join(", ");

  const [isEditingOutputVariableKeys, setIsEditingOutputVariableKeys] = useState(false);
  const [outputVariableKeysText, setOutputVariableKeysText] = useState(canonicalOutputVariableKeysText);

  const toggleField = (field: EmailContentField, checked: boolean) => {
    const next = new Set(fields);
    if (checked) next.add(field);
    else next.delete(field);
    onChange("fields", Array.from(next));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Write Target</Label>
        <Select value={writeTarget} onValueChange={(v) => onChange("writeTarget", v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select target" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="variables">Variables</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Prompt Fields</Label>
        <div className="space-y-2 rounded-md border bg-background p-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={fields.includes("subject")}
              onCheckedChange={(v) => toggleField("subject", Boolean(v))}
            />
            Subject
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={fields.includes("textBody")}
              onCheckedChange={(v) => toggleField("textBody", Boolean(v))}
            />
            Body (Text)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={fields.includes("htmlBody")}
              onCheckedChange={(v) => toggleField("htmlBody", Boolean(v))}
            />
            Body (HTML)
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Select which email fields are sent to the AI (large bodies are truncated)
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt" className="text-xs font-medium">Instruction</Label>
        <Textarea
          id="prompt"
          value={(data.prompt as string) || ""}
          onChange={(e) => onChange("prompt", e.target.value)}
          placeholder="Extract key points into variables, then rewrite subject and body."
          rows={6}
          className="font-mono text-sm"
        />
      </div>

      {(writeTarget === "variables" || writeTarget === "both") && (
        <div className="space-y-2">
          <Label htmlFor="outputVariableKeys" className="text-xs font-medium">Output Variable Keys (optional)</Label>
          <Input
            id="outputVariableKeys"
            value={isEditingOutputVariableKeys ? outputVariableKeysText : canonicalOutputVariableKeysText}
            onFocus={() => {
              setIsEditingOutputVariableKeys(true);
              setOutputVariableKeysText(canonicalOutputVariableKeysText);
            }}
            onChange={(e) => {
              const nextText = e.target.value;
              setOutputVariableKeysText(nextText);
              onChange("outputVariableKeys", parseOutputVariableKeys(nextText));
            }}
            onBlur={() => {
              const normalized = parseOutputVariableKeys(outputVariableKeysText).join(", ");
              setIsEditingOutputVariableKeys(false);
              setOutputVariableKeysText(normalized);
            }}
            placeholder="code, order_id"
            className="h-8 text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            When set, the AI must only write these keys (comma/newline separated). If empty, keys are inferred from the instruction (e.g. variables.code).
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="resultVariable" className="text-xs font-medium">Result Variable (optional)</Label>
        <Input
          id="resultVariable"
          value={(data.resultVariable as string) || ""}
          onChange={(e) => onChange("resultVariable", e.target.value)}
          placeholder="aiResult"
          className="h-8 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Stores the full JSON result into this workflow variable
        </p>
      </div>
    </div>
  );
}

// ==================== 关键字条件配置 ====================

function KeywordConditionConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [mode, setMode] = useState<"simple" | "advanced">(
    data.conditions ? "advanced" : "simple"
  );
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [tempConditions, setTempConditions] = useState<CompositeCondition | undefined>(
    data.conditions as CompositeCondition | undefined
  );

  const fields = (data.fields as MatchField[]) || ["subject", "textBody"];

  const handleAddField = (field: MatchField) => {
    if (!fields.includes(field)) {
      onChange("fields", [...fields, field]);
    }
    setShowFieldSelector(false);
  };

  const handleRemoveField = (field: MatchField) => {
    onChange("fields", fields.filter((f) => f !== field));
  };

  const handleModeChange = (newMode: "simple" | "advanced") => {
    setMode(newMode);
    if (newMode === "advanced" && !data.conditions) {
      // 初始化高级条件
      setTempConditions({
        kind: "and",
        conditions: [],
      });
    }
  };

  const handleOpenConditionModal = () => {
    setTempConditions(data.conditions as CompositeCondition | undefined);
    setShowConditionModal(true);
  };

  const handleSaveConditions = () => {
    onChange("conditions", tempConditions);
    setShowConditionModal(false);
  };

  const handleClearAdvanced = () => {
    onChange("conditions", undefined);
    setMode("simple");
  };

  // 获取条件摘要
  const getConditionSummary = (condition?: CompositeCondition): string => {
    if (!condition) return "No conditions";

    switch (condition.kind) {
      case "and":
        if (condition.conditions.length === 0) return "No conditions";
        return `${condition.conditions.length} conditions (AND)`;
      case "or":
        if (condition.conditions.length === 0) return "No conditions";
        return `${condition.conditions.length} conditions (OR)`;
      case "not":
        return `NOT (${getConditionSummary(condition.condition)})`;
      case "match":
        return `${MATCH_FIELD_LABELS[condition.field]} ${MATCH_OPERATOR_LABELS[condition.operator]} "${condition.value}"`;
      default:
        return "Unknown condition";
    }
  };

  // 计算条件数量
  const countConditions = (condition?: CompositeCondition): number => {
    if (!condition) return 0;
    switch (condition.kind) {
      case "and":
      case "or":
        return condition.conditions.reduce((sum, c) => sum + countConditions(c), 0);
      case "not":
        return countConditions(condition.condition);
      case "match":
        return 1;
      default:
        return 0;
    }
  };

  const conditionCount = countConditions(data.conditions as CompositeCondition);

  return (
    <>
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium">Need multiple categories?</p>
            <p className="text-xs text-muted-foreground">
              Switch this node to multi-category classification.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => {
              onChange("categories", []);
              onChange("keywordSets", []);
              onChange("defaultCategory", "default");
            }}
          >
            Enable Multi
          </Button>
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v) => handleModeChange(v as "simple" | "advanced")}>
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="simple" className="text-xs">Simple</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Keywords</Label>
            <Textarea
              value={((data.keywords as string[]) || []).join("\n")}
              onChange={(e) =>
                onChange(
                  "keywords",
                  e.target.value.split("\n").filter((k) => k.trim())
                )
              }
              placeholder="spam&#10;unsubscribe&#10;newsletter"
              rows={4}
              className="text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">One keyword per line</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Match Type</Label>
            <Select
              value={(data.matchType as string) || "any"}
              onValueChange={(v) => onChange("matchType", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Match Any Keyword</SelectItem>
                <SelectItem value="all">Match All Keywords</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Search In Fields</Label>
            <div className="flex flex-wrap gap-1">
              {fields.map((field) => (
                <Badge key={field} variant="secondary" className="text-xs gap-1">
                  {MATCH_FIELD_LABELS[field]}
                  <button
                    onClick={() => handleRemoveField(field)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowFieldSelector(!showFieldSelector)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Field
              </Button>
            </div>
            {showFieldSelector && (
              <div className="p-2 bg-muted rounded-md space-y-1">
                {Object.entries(MATCH_FIELD_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => handleAddField(key as MatchField)}
                    disabled={fields.includes(key as MatchField)}
                    className={cn(
                      "w-full text-left px-2 py-1 text-xs rounded hover:bg-background",
                      fields.includes(key as MatchField) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="keywordCaseSensitive"
              checked={(data.caseSensitive as boolean) || false}
              onCheckedChange={(v) => onChange("caseSensitive", v)}
            />
            <Label htmlFor="keywordCaseSensitive" className="text-xs">Case Sensitive</Label>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Composite Conditions</Label>
              {!!data.conditions && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={handleClearAdvanced}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* 条件预览卡片 */}
            <div
              className={cn(
                "p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                "hover:border-primary hover:bg-primary/5",
                data.conditions ? "border-primary/50 bg-primary/5" : "border-muted-foreground/30"
              )}
              onClick={handleOpenConditionModal}
            >
              {data.conditions ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {conditionCount} condition{conditionCount !== 1 ? "s" : ""} configured
                    </span>
                  </div>
                  <ConditionPreview condition={data.conditions as CompositeCondition} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
                  <GitBranch className="h-6 w-6" />
                  <span className="text-xs">Click to create conditions</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenConditionModal}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {data.conditions ? "Edit Conditions" : "Create Conditions"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Use AND, OR, NOT logic to create complex matching rules
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* 条件编辑模态框 */}
      <Dialog open={showConditionModal} onOpenChange={setShowConditionModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Advanced Condition Builder
            </DialogTitle>
            <DialogDescription>
              Build complex conditions using AND, OR, NOT operators
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="py-4">
              <ConditionBuilder
                value={tempConditions}
                onChange={setTempConditions}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConditionModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveConditions}>
              Save Conditions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ==================== 关键词多元分类配置 ====================

function KeywordMultiClassifierConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const categories = (data.categories as string[]) || [];
  const keywordSets = (data.keywordSets as KeywordSet[]) || [];
  const defaultCategory = (data.defaultCategory as string) || "default";
  const fields = (data.fields as MatchField[]) || ["subject", "textBody"];

  const [newCategory, setNewCategory] = useState("");
  const [keywordSetModalOpen, setKeywordSetModalOpen] = useState(false);
  const [keywordSetModalCategory, setKeywordSetModalCategory] = useState<string | null>(null);
  const [keywordSetKeywordsText, setKeywordSetKeywordsText] = useState("");
  const [keywordSetMatchType, setKeywordSetMatchType] = useState<"any" | "all">("any");
  const [keywordSetCaseSensitive, setKeywordSetCaseSensitive] = useState(false);

  const addCategory = () => {
    const category = newCategory.trim();
    if (!category) return;
    if (categories.includes(category)) {
      toast.error("Category already exists");
      return;
    }

    onChange("categories", [...categories, category]);
    onChange("keywordSets", [
      ...keywordSets,
      {
        category,
        keywords: [],
        matchType: "any" as const,
        caseSensitive: false,
      },
    ]);
    setNewCategory("");
  };

  const removeCategory = (category: string) => {
    onChange("categories", categories.filter((c) => c !== category));
    onChange("keywordSets", keywordSets.filter((s) => s.category !== category));
    if (defaultCategory === category) {
      onChange("defaultCategory", "default");
    }
  };

  const updateKeywordSet = (category: string, updates: Partial<KeywordSet>) => {
    const updated = keywordSets.map((set) =>
      set.category === category ? { ...set, ...updates } : set
    );
    onChange("keywordSets", updated);
  };

  const openKeywordSetModal = (category: string) => {
    const set =
      keywordSets.find((s) => s.category === category) || ({
        category,
        keywords: [],
        matchType: "any" as const,
        caseSensitive: false,
      } satisfies KeywordSet);

    setKeywordSetModalCategory(category);
    setKeywordSetKeywordsText(set.keywords.join(", "));
    setKeywordSetMatchType(set.matchType || "any");
    setKeywordSetCaseSensitive(Boolean(set.caseSensitive));
    setKeywordSetModalOpen(true);
  };

  const closeKeywordSetModal = () => {
    setKeywordSetModalOpen(false);
    setKeywordSetModalCategory(null);
  };

  const saveKeywordSetModal = () => {
    if (!keywordSetModalCategory) return;

    const keywords = keywordSetKeywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    updateKeywordSet(keywordSetModalCategory, {
      keywords,
      matchType: keywordSetMatchType,
      caseSensitive: keywordSetCaseSensitive,
    });
    closeKeywordSetModal();
  };

  const addField = (field: MatchField) => {
    if (!fields.includes(field)) {
      onChange("fields", [...fields, field]);
    }
  };

  const removeField = (field: MatchField) => {
    onChange("fields", fields.filter((f) => f !== field));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Mode</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={() => {
            onChange("categories", undefined);
            onChange("keywordSets", undefined);
            onChange("defaultCategory", undefined);
          }}
        >
          Use Boolean Mode
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Categories</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add category (e.g., urgent)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            className="h-8 text-sm"
          />
          <Button onClick={addCategory} size="sm" className="h-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {categories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <button
                type="button"
                onClick={() => removeCategory(category)}
                className="ml-0.5 hover:text-destructive"
                aria-label={`Remove category ${category}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add at least one category to create output handles.
            </p>
          )}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs font-medium">Match Fields</Label>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <Badge key={field} variant="outline" className="gap-1 text-[10px]">
              {MATCH_FIELD_LABELS[field]}
              <button
                type="button"
                onClick={() => removeField(field)}
                className="ml-0.5 hover:text-destructive"
                aria-label={`Remove field ${MATCH_FIELD_LABELS[field]}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Select onValueChange={(v) => addField(v as MatchField)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Add field" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MATCH_FIELD_LABELS) as MatchField[])
              .filter((f) => !fields.includes(f))
              .map((f) => (
                <SelectItem key={f} value={f}>
                  {MATCH_FIELD_LABELS[f]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs font-medium">Keywords per Category</Label>
        {categories.map((category) => {
          const set =
            keywordSets.find((s) => s.category === category) || ({
              category,
              keywords: [],
              matchType: "any" as const,
              caseSensitive: false,
            } satisfies KeywordSet);

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{category}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => openKeywordSetModal(category)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Keywords (comma-separated)</Label>
                  <Textarea
                    placeholder="urgent, asap, important"
                    value={set.keywords.join(", ")}
                    onChange={(e) => {
                      const keywords = e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean);
                      updateKeywordSet(category, { keywords });
                    }}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Match Type</Label>
                    <Select
                      value={set.matchType || "any"}
                      onValueChange={(value) =>
                        updateKeywordSet(category, { matchType: value as "any" | "all" })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any keyword</SelectItem>
                        <SelectItem value="all">All keywords</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={Boolean(set.caseSensitive)}
                        onCheckedChange={(checked) =>
                          updateKeywordSet(category, { caseSensitive: checked })
                        }
                      />
                      <Label className="text-xs">Case sensitive</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs font-medium">Default Category</Label>
        <Select
          value={defaultCategory}
          onValueChange={(value) => onChange("defaultCategory", value)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select default category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">default (no match)</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used when no keywords match
        </p>
      </div>

      <Dialog
        open={keywordSetModalOpen}
        onOpenChange={(open) => (open ? setKeywordSetModalOpen(true) : closeKeywordSetModal())}
      >
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Keyword Set
              {keywordSetModalCategory ? `: ${keywordSetModalCategory}` : ""}
            </DialogTitle>
            <DialogDescription>
              Edit keywords and matching rules for this category.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Keywords</Label>
                <Textarea
                  value={keywordSetKeywordsText}
                  onChange={(e) => setKeywordSetKeywordsText(e.target.value)}
                  placeholder="urgent, asap, important"
                  rows={6}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Separate keywords with commas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Match Type</Label>
                  <Select
                    value={keywordSetMatchType}
                    onValueChange={(value) => setKeywordSetMatchType(value as "any" | "all")}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any keyword</SelectItem>
                      <SelectItem value="all">All keywords</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={keywordSetCaseSensitive}
                      onCheckedChange={setKeywordSetCaseSensitive}
                    />
                    <Label className="text-xs">Case sensitive</Label>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={closeKeywordSetModal}
            >
              Cancel
            </Button>
            <Button onClick={saveKeywordSetModal} disabled={!keywordSetModalCategory}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== AI 分类器配置 ====================

function AiClassifierConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const categories = (data.categories as string[]) || [];
  const customPrompt = (data.customPrompt as string) || "";
  const fields = (data.fields as MatchField[]) || ["subject", "textBody"];
  const confidenceThreshold = (data.confidenceThreshold as number) ?? 0.7;
  const defaultCategory = (data.defaultCategory as string) || "default";

  const [newCategory, setNewCategory] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const addCategory = () => {
    const category = newCategory.trim();
    if (!category) return;
    if (categories.includes(category)) {
      toast.error("Category already exists");
      return;
    }
    onChange("categories", [...categories, category]);
    setNewCategory("");
  };

  const removeCategory = (category: string) => {
    onChange("categories", categories.filter((c) => c !== category));
    if (defaultCategory === category) {
      onChange("defaultCategory", "default");
    }
  };

  const addField = (field: MatchField) => {
    if (!fields.includes(field)) {
      onChange("fields", [...fields, field]);
    }
  };

  const removeField = (field: MatchField) => {
    onChange("fields", fields.filter((f) => f !== field));
  };

  const updateThreshold = (value: number) => {
    const normalized = Math.max(0, Math.min(1, value));
    onChange("confidenceThreshold", normalized);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-medium">Categories</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add category (e.g., work, personal, spam)"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCategory()}
            className="h-8 text-sm"
          />
          <Button onClick={addCategory} size="sm" className="h-8">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          {categories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <button
                type="button"
                onClick={() => removeCategory(category)}
                className="ml-0.5 hover:text-destructive"
                aria-label={`Remove category ${category}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs font-medium">Fields to Analyze</Label>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <Badge key={field} variant="outline" className="gap-1 text-[10px]">
              {MATCH_FIELD_LABELS[field]}
              <button
                type="button"
                onClick={() => removeField(field)}
                className="ml-0.5 hover:text-destructive"
                aria-label={`Remove field ${MATCH_FIELD_LABELS[field]}`}
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Select onValueChange={(v) => addField(v as MatchField)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Add field" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MATCH_FIELD_LABELS) as MatchField[])
              .filter((f) => !fields.includes(f))
              .map((f) => (
                <SelectItem key={f} value={f}>
                  {MATCH_FIELD_LABELS[f]}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs font-medium">Default Category</Label>
        <Select
          value={defaultCategory}
          onValueChange={(value) => onChange("defaultCategory", value)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select default category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">default (fallback)</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Used when confidence is too low or AI fails
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Confidence Threshold</Label>
          <span className="text-xs text-muted-foreground">
            {confidenceThreshold.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={confidenceThreshold}
          onChange={(e) => updateThreshold(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <Input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={confidenceThreshold}
          onChange={(e) => updateThreshold(parseFloat(e.target.value) || 0)}
          className="h-8 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Minimum confidence to accept classification result
        </p>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Custom Prompt (Optional)</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => setShowPromptEditor(!showPromptEditor)}
          >
            {showPromptEditor ? "Hide" : "Show"}
          </Button>
        </div>

        {showPromptEditor && (
          <>
            <Textarea
              placeholder="Leave empty to use global default prompt from admin settings"
              value={customPrompt}
              onChange={(e) => onChange("customPrompt", e.target.value)}
              rows={6}
              className="text-sm font-mono"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Template variables:</p>
              <ul className="list-disc list-inside pl-2 space-y-0.5">
                <li>
                  <code>{"{{categories}}"}</code> - List of categories
                </li>
                <li>
                  <code>{"{{email.subject}}"}</code> - Email subject
                </li>
                <li>
                  <code>{"{{email.fromAddress}}"}</code> - Sender email
                </li>
                <li>
                  <code>{"{{email.fromName}}"}</code> - Sender name
                </li>
                <li>
                  <code>{"{{email.textBody}}"}</code> - Email body (text)
                </li>
                <li>
                  <code>{"{{email.htmlBody}}"}</code> - Email body (HTML)
                </li>
                <li>
                  <code>{"{{email.previewUrl}}"}</code> - Public preview link
                </li>
              </ul>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5" />
          <div className="text-xs text-blue-900 space-y-1">
            <p className="font-medium">AI Classifier Configuration</p>
            <p>
              Configure base URL, model and API key in Admin Settings to enable AI classification.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 条件预览组件
function ConditionPreview({ condition, depth = 0 }: { condition: CompositeCondition; depth?: number }) {
  if (depth > 2) {
    return <span className="text-xs text-muted-foreground">...</span>;
  }

  switch (condition.kind) {
    case "and":
    case "or":
      if (condition.conditions.length === 0) {
        return <span className="text-xs text-muted-foreground italic">Empty group</span>;
      }
      return (
        <div className="text-xs space-y-1">
          <span className="font-semibold text-primary uppercase">{condition.kind}</span>
          <div className="pl-2 border-l-2 border-primary/30 space-y-1">
            {condition.conditions.slice(0, 3).map((c, i) => (
              <ConditionPreview key={i} condition={c} depth={depth + 1} />
            ))}
            {condition.conditions.length > 3 && (
              <span className="text-muted-foreground">+{condition.conditions.length - 3} more</span>
            )}
          </div>
        </div>
      );
    case "not":
      return (
        <div className="text-xs">
          <span className="font-semibold text-red-500">NOT</span>{" "}
          <ConditionPreview condition={condition.condition} depth={depth + 1} />
        </div>
      );
    case "match":
      return (
        <div className="text-xs flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {MATCH_FIELD_LABELS[condition.field]}
          </Badge>
          <span className="text-muted-foreground">
            {MATCH_OPERATOR_LABELS[condition.operator]?.toLowerCase()}
          </span>
          <span className="font-mono bg-muted px-1 rounded truncate max-w-[100px]">
            &quot;{condition.value}&quot;
          </span>
        </div>
      );
    default:
      return null;
  }
}

// ==================== 邮件转发配置 ====================

function ForwardEmailConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const template = (data.template as { subject?: string; body?: string; html?: string }) || {};

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="to" className="text-xs font-medium">Recipient Email</Label>
        <Input
          id="to"
          type="email"
          value={(data.to as string) || ""}
          onChange={(e) => onChange("to", e.target.value)}
          placeholder="recipient@example.com"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="subjectTemplate" className="text-xs font-medium">Subject</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange("template", {
              ...template,
              subject: DEFAULT_FORWARD_TEMPLATES.email.subject,
            })}
          >
            <FileText className="h-3 w-3 mr-1" />
            Default
          </Button>
        </div>
        <Input
          id="subjectTemplate"
          value={template.subject || ""}
          onChange={(e) =>
            onChange("template", { ...template, subject: e.target.value })
          }
          placeholder="[Forwarded] {{email.subject}}"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bodyTemplate" className="text-xs font-medium">Body Template</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange("template", {
              ...template,
              body: DEFAULT_FORWARD_TEMPLATES.email.body,
            })}
          >
            <FileText className="h-3 w-3 mr-1" />
            Default
          </Button>
        </div>
        <Textarea
          id="bodyTemplate"
          value={template.body || ""}
          onChange={(e) =>
            onChange("template", { ...template, body: e.target.value })
          }
          placeholder="Original email content..."
          rows={4}
          className="text-xs font-mono"
        />
      </div>

      <VariableHelpText />
    </div>
  );
}

// ==================== Telegram 转发配置 ====================

function ForwardTelegramConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    const templates = DEFAULT_FORWARD_TEMPLATES.telegram;
    const template = templates[preset as keyof typeof templates];
    if (template) {
      onChange("template", template);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Switch
          id="useAppBot"
          checked={(data.useAppBot as boolean) || false}
          onCheckedChange={(v) => onChange("useAppBot", v)}
        />
        <Label htmlFor="useAppBot" className="text-xs">Use App Bot</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses the admin-configured app bot token (<span className="font-mono">telegram_bot_token</span> or <span className="font-mono">TELEGRAM_BOT_TOKEN</span>).
      </p>

      <div className="space-y-2">
        <Label htmlFor="token" className="text-xs font-medium">Bot Token</Label>
        <Input
          id="token"
          type="password"
          value={(data.token as string) || ""}
          onChange={(e) => onChange("token", e.target.value)}
          placeholder="123456:ABC-DEF..."
          className="h-8 text-sm font-mono"
          disabled={(data.useAppBot as boolean) || false}
        />
        <p className="text-xs text-muted-foreground">
          Get from @BotFather on Telegram
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="chatId" className="text-xs font-medium">Chat ID</Label>
        <Input
          id="chatId"
          value={(data.chatId as string) || ""}
          onChange={(e) => onChange("chatId", e.target.value)}
          placeholder="-100123456789"
          className="h-8 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Use @userinfobot to get your chat ID
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="messageThreadId" className="text-xs font-medium">Topic ID (optional)</Label>
        <Input
          id="messageThreadId"
          value={typeof data.messageThreadId === "number" ? String(data.messageThreadId) : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange("messageThreadId", raw ? Number.parseInt(raw, 10) : undefined);
          }}
          placeholder="1234"
          className="h-8 text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Telegram <span className="font-mono">message_thread_id</span> for Topics (forum threads).
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium">Parse Mode</Label>
        <Select
          value={(data.parseMode as string) || "Markdown"}
          onValueChange={(v) => onChange("parseMode", v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">None</SelectItem>
            <SelectItem value="Markdown">Markdown</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="HTML">HTML</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select <span className="font-mono">None</span> to omit <span className="font-mono">parse_mode</span> in the Telegram API request.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="template" className="text-xs font-medium">Message Template</Label>
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="w-[100px] h-6 text-xs">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="template"
          value={(data.template as string) || ""}
          onChange={(e) => onChange("template", e.target.value)}
          placeholder="📧 New email from {{email.fromAddress}}"
          rows={5}
          className="text-xs font-mono"
        />
      </div>

      <VariableHelpText />
    </div>
  );
}

// ==================== Discord 转发配置 ====================

function ForwardDiscordConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    const templates = DEFAULT_FORWARD_TEMPLATES.discord;
    const template = templates[preset as keyof typeof templates];
    if (template) {
      onChange("template", template);
      onChange("useEmbed", preset === "embed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="webhookUrl" className="text-xs font-medium">Webhook URL</Label>
        <Input
          id="webhookUrl"
          value={(data.webhookUrl as string) || ""}
          onChange={(e) => onChange("webhookUrl", e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="h-8 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Server Settings → Integrations → Webhooks
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="useEmbed"
          checked={(data.useEmbed as boolean) || false}
          onCheckedChange={(v) => onChange("useEmbed", v)}
        />
        <Label htmlFor="useEmbed" className="text-xs">Use Rich Embed</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="template" className="text-xs font-medium">Message Template</Label>
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="w-[100px] h-6 text-xs">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="embed">Rich Embed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="template"
          value={(data.template as string) || ""}
          onChange={(e) => onChange("template", e.target.value)}
          placeholder="📧 New email notification"
          rows={5}
          className="text-xs font-mono"
        />
      </div>

      <VariableHelpText />
    </div>
  );
}

// ==================== Slack 转发配置 ====================

function ForwardSlackConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    const templates = DEFAULT_FORWARD_TEMPLATES.slack;
    const template = templates[preset as keyof typeof templates];
    if (template) {
      onChange("template", template);
      onChange("useBlocks", preset === "blocks");
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="webhookUrl" className="text-xs font-medium">Webhook URL</Label>
        <Input
          id="webhookUrl"
          value={(data.webhookUrl as string) || ""}
          onChange={(e) => onChange("webhookUrl", e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="h-8 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Apps → Incoming Webhooks → Add New Webhook
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="useBlocks"
          checked={(data.useBlocks as boolean) || false}
          onCheckedChange={(v) => onChange("useBlocks", v)}
        />
        <Label htmlFor="useBlocks" className="text-xs">Use Block Kit</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="template" className="text-xs font-medium">Message Template</Label>
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="w-[100px] h-6 text-xs">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="blocks">Block Kit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="template"
          value={(data.template as string) || ""}
          onChange={(e) => onChange("template", e.target.value)}
          placeholder="📧 New email notification"
          rows={5}
          className="text-xs font-mono"
        />
      </div>

      <VariableHelpText />
    </div>
  );
}

// ==================== Webhook 转发配置 ====================

function ForwardWebhookConfig({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [showHeaders, setShowHeaders] = useState(false);
  const headers = (data.headers as Record<string, string>) || {};

  const handlePresetSelect = (preset: string) => {
    setSelectedPreset(preset);
    const templates = DEFAULT_FORWARD_TEMPLATES.webhook;
    const template = templates[preset as keyof typeof templates];
    if (template) {
      onChange("bodyTemplate", template);
    }
  };

  const handleHeaderChange = (key: string, value: string) => {
    onChange("headers", { ...headers, [key]: value });
  };

  const handleHeaderRemove = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    onChange("headers", newHeaders);
  };

  const handleHeaderAdd = () => {
    onChange("headers", { ...headers, "": "" });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url" className="text-xs font-medium">Webhook URL</Label>
        <Input
          id="url"
          value={(data.url as string) || ""}
          onChange={(e) => onChange("url", e.target.value)}
          placeholder="https://api.example.com/webhook"
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium">Method</Label>
          <Select
            value={(data.method as string) || "POST"}
            onValueChange={(v) => onChange("method", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium">Content-Type</Label>
          <Select
            value={(data.contentType as string) || "application/json"}
            onValueChange={(v) => onChange("contentType", v)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="application/json">JSON</SelectItem>
              <SelectItem value="application/x-www-form-urlencoded">Form</SelectItem>
              <SelectItem value="text/plain">Plain Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Headers Section */}
      <div className="space-y-2">
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="flex items-center gap-1 text-xs font-medium hover:text-foreground"
        >
          {showHeaders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Custom Headers ({Object.keys(headers).length})
        </button>
        {showHeaders && (
          <div className="space-y-2 p-2 bg-muted/50 rounded-md">
            {Object.entries(headers).map(([key, value], index) => (
              <div key={index} className="flex gap-1">
                <Input
                  value={key}
                  onChange={(e) => {
                    const newHeaders = { ...headers };
                    delete newHeaders[key];
                    newHeaders[e.target.value] = value;
                    onChange("headers", newHeaders);
                  }}
                  placeholder="Header name"
                  className="h-7 text-xs flex-1"
                />
                <Input
                  value={value}
                  onChange={(e) => handleHeaderChange(key, e.target.value)}
                  placeholder="Value"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleHeaderRemove(key)}
                  className="h-7 w-7 text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleHeaderAdd}
              className="w-full h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Header
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bodyTemplate" className="text-xs font-medium">Body Template</Label>
          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
            <SelectTrigger className="w-[100px] h-6 text-xs">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">Standard</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="full">Full Data</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          id="bodyTemplate"
          value={(data.bodyTemplate as string) || ""}
          onChange={(e) => onChange("bodyTemplate", e.target.value)}
          placeholder='{"email": "{{email.subject}}"}'
          rows={6}
          className="text-xs font-mono"
        />
      </div>

      <VariableHelpText />
    </div>
  );
}

// ==================== 变量帮助文本 ====================

function VariableHelpText() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pt-2 border-t">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Available Variables
      </button>
      {expanded && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1 font-mono">
          <p>{"{{email.subject}}"}</p>
          <p>{"{{email.fromAddress}}"}</p>
          <p>{"{{email.fromName}}"}</p>
          <p>{"{{email.toAddress}}"}</p>
          <p>{"{{email.textBody}}"}</p>
          <p>{"{{email.htmlBody}}"}</p>
          <p>{"{{email.previewUrl}}"}</p>
          <p>{"{{email.receivedAt}}"}</p>
          <p>{"{{email.messageId}}"}</p>
          <p>{"{{mailbox.address}}"}</p>
          <p>{"{{variables.yourVar}}"}</p>
        </div>
      )}
    </div>
  );
}
