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
  type MatchField,
  type MatchOperator,
} from "@/lib/workflow/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { X, Trash2, Play, FileText, Settings2, ChevronDown, ChevronRight, Plus, Pencil, GitBranch } from "lucide-react";
import { ConditionBuilder, SimpleConditionEditor } from "./ConditionBuilder";
import { ForwardTestButton, TemplateSelector } from "./ForwardTestPanel";
import { cn } from "@/lib/utils";

interface NodeConfigPanelProps {
  mailboxes?: { id: string; address: string }[];
}

export function NodeConfigPanel({ mailboxes = [] }: NodeConfigPanelProps) {
  const selectedNode = useWorkflowStore(selectSelectedNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);

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
            <h3 className="font-semibold text-sm">{definition?.label || "Node"}</h3>
            <p className="text-xs text-muted-foreground">{selectedNode.type}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSelectedNodeId(null)}
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
          {renderNodeConfig(selectedNode.type as NodeType, data, handleChange, mailboxes)}
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
    </div>
  );
}

function renderNodeConfig(
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
              Examples: "0 * * * *" (hourly), "0 9 * * *" (daily at 9am)
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

    case "condition:keyword":
      return <KeywordConditionConfig data={data} onChange={onChange} />;

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
            "{condition.value}"
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
      <div className="space-y-2">
        <Label htmlFor="token" className="text-xs font-medium">Bot Token</Label>
        <Input
          id="token"
          type="password"
          value={(data.token as string) || ""}
          onChange={(e) => onChange("token", e.target.value)}
          placeholder="123456:ABC-DEF..."
          className="h-8 text-sm font-mono"
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
        <Label className="text-xs font-medium">Parse Mode</Label>
        <Select
          value={(data.parseMode as string) || "Markdown"}
          onValueChange={(v) => onChange("parseMode", v)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Markdown">Markdown</SelectItem>
            <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
            <SelectItem value="HTML">HTML</SelectItem>
          </SelectContent>
        </Select>
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
          <p>{"{{email.receivedAt}}"}</p>
          <p>{"{{email.messageId}}"}</p>
          <p>{"{{mailbox.address}}"}</p>
          <p>{"{{variables.yourVar}}"}</p>
        </div>
      )}
    </div>
  );
}
