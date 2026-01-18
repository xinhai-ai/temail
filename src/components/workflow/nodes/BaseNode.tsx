"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import type { NodeType, NodeData } from "@/lib/workflow/types";
import {
  NODE_DEFINITIONS,
  isConditionalNode,
  MATCH_FIELD_LABELS,
  MATCH_OPERATOR_LABELS,
} from "@/lib/workflow/types";
import {
  Mail,
  Clock,
  Hand,
  Search,
  Tag,
  Brain,
  Code,
  Archive,
  CheckCircle,
  Circle,
  Star,
  Trash2,
  Variable,
  Send,
  MessageCircle,
  MessageSquare,
  Hash,
  Webhook,
  GitBranch,
  Timer,
  CircleStop,
  Zap,
  AlertCircle,
} from "lucide-react";

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail,
  Clock,
  Hand,
  Search,
  Tag,
  Brain,
  Code,
  Archive,
  CheckCircle,
  Circle,
  Star,
  StarOff: Star,
  Trash2,
  Variable,
  Send,
  MessageCircle,
  MessageSquare,
  Hash,
  Webhook,
  GitBranch,
  Timer,
  CircleStop,
};

interface BaseNodeProps extends NodeProps<NodeData> {
  type: NodeType;
}

function BaseNodeComponent({ id, type, data, selected }: BaseNodeProps) {
  const definition = NODE_DEFINITIONS[type];
  if (!definition) {
    return (
      <div className="p-4 bg-red-100 rounded-lg border-2 border-red-300">
        <AlertCircle className="w-4 h-4 text-red-500" />
        Unknown: {type}
      </div>
    );
  }

  const Icon = iconMap[definition.icon] || Circle;
  const isConditional = isConditionalNode(type);
  const keywordMultiMode =
    type === "condition:keyword" &&
    (Array.isArray((data as unknown as { categories?: unknown }).categories) ||
      Array.isArray((data as unknown as { keywordSets?: unknown }).keywordSets) ||
      typeof (data as unknown as { defaultCategory?: unknown }).defaultCategory === "string");
  const isTrigger = type.startsWith("trigger:");
  const label = data.label || definition.label;
  const preview = getNodePreview(type, data);
  const isConfigured = getIsConfigured(type, data);

  // 计算多路输出节点的动态宽度
  const categories = (data as unknown as { categories?: string[] }).categories || [];
  const isMultiOutput = definition.outputs === "multi" &&
    (type !== "condition:keyword" || keywordMultiMode);
  const categoryCount = isMultiOutput ? categories.length + 1 : 0; // +1 for default
  // 每个分类约70px宽度，最小200px，最大500px
  const dynamicWidth = isMultiOutput && categoryCount > 2
    ? Math.min(500, Math.max(200, categoryCount * 70))
    : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border-2 bg-card shadow-lg transition-all duration-200",
        !dynamicWidth && "min-w-[200px] max-w-[240px]",
        selected
          ? "border-primary ring-4 ring-primary/20 shadow-xl scale-[1.02]"
          : "border-border/60 hover:border-border hover:shadow-xl",
        !isConfigured && "border-dashed border-amber-400/60"
      )}
      style={dynamicWidth ? { width: dynamicWidth } : undefined}
    >
      {/* 输入 Handle */}
      {definition.inputs > 0 && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn(
            "!w-4 !h-4 !-top-2 !border-2 !border-background",
            "!bg-gradient-to-br !from-slate-400 !to-slate-500",
            "hover:!from-primary hover:!to-primary/80 transition-colors"
          )}
        />
      )}

      {/* 触发器特殊标记 */}
      {isTrigger && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-semibold rounded-full shadow-md">
            <Zap className="w-2.5 h-2.5" />
            TRIGGER
          </div>
        </div>
      )}

      {/* 节点头部 */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-t-[10px]"
        style={{
          background: `linear-gradient(135deg, ${definition.color}15 0%, ${definition.color}08 100%)`,
          borderBottom: `1px solid ${definition.color}20`,
        }}
      >
        <div
          className="p-2 rounded-lg shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${definition.color} 0%, ${definition.color}cc 100%)`,
          }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="font-semibold text-sm block truncate"
            title={label}
          >
            {label}
          </span>
          <span className="text-[10px] text-muted-foreground opacity-75">
            {definition.description.slice(0, 30)}
          </span>
        </div>
      </div>

      {/* 节点内容区域 */}
      <div className="px-3 py-2.5 min-h-[40px]">
        {!isConfigured ? (
          <div className="flex items-center gap-1.5 text-amber-600 text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Needs configuration</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {preview}
          </div>
        )}
      </div>

      {/* 输出 Handle - 单输出 */}
      {definition.outputs === 1 && (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn(
            "!w-4 !h-4 !-bottom-2 !border-2 !border-background",
            "!bg-gradient-to-br !from-slate-400 !to-slate-500",
            "hover:!from-primary hover:!to-primary/80 transition-colors"
          )}
        />
      )}

      {/* 条件节点的双输出 */}
      {(isConditional || (type === "condition:keyword" && !keywordMultiMode)) && (
        <div className="relative pb-8 nodrag">
          {/* 标签行 */}
          <div className="flex justify-between px-6 mb-1">
            <span className="text-[10px] font-medium text-green-600">Yes</span>
            <span className="text-[10px] font-medium text-red-600">No</span>
          </div>
          {/* Handle 使用绝对定位 */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            className={cn(
              "!w-4 !h-4 !cursor-crosshair !z-10",
              "!bg-gradient-to-br !from-green-400 !to-green-500",
              "!border-2 !border-background",
              "hover:!from-green-500 hover:!to-green-600 transition-colors"
            )}
            style={{ left: "20%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            className={cn(
              "!w-4 !h-4 !cursor-crosshair !z-10",
              "!bg-gradient-to-br !from-red-400 !to-red-500",
              "!border-2 !border-background",
              "hover:!from-red-500 hover:!to-red-600 transition-colors"
            )}
            style={{ left: "80%" }}
          />
        </div>
      )}

      {/* 多路分类输出 */}
      {definition.outputs === "multi" && type !== "condition:keyword" && (
        <MultiOutputHandles data={data as unknown as Record<string, unknown>} />
      )}
      {definition.outputs === "multi" && type === "condition:keyword" && keywordMultiMode && (
        <MultiOutputHandles data={data as unknown as Record<string, unknown>} />
      )}
    </div>
  );
}

const multiColorClasses = [
  {
    text: "text-blue-600",
    from: "!from-blue-400",
    to: "!to-blue-500",
    hoverFrom: "hover:!from-blue-500",
    hoverTo: "hover:!to-blue-600",
  },
  {
    text: "text-green-600",
    from: "!from-green-400",
    to: "!to-green-500",
    hoverFrom: "hover:!from-green-500",
    hoverTo: "hover:!to-green-600",
  },
  {
    text: "text-purple-600",
    from: "!from-purple-400",
    to: "!to-purple-500",
    hoverFrom: "hover:!from-purple-500",
    hoverTo: "hover:!to-purple-600",
  },
  {
    text: "text-orange-600",
    from: "!from-orange-400",
    to: "!to-orange-500",
    hoverFrom: "hover:!from-orange-500",
    hoverTo: "hover:!to-orange-600",
  },
  {
    text: "text-pink-600",
    from: "!from-pink-400",
    to: "!to-pink-500",
    hoverFrom: "hover:!from-pink-500",
    hoverTo: "hover:!to-pink-600",
  },
  {
    text: "text-cyan-600",
    from: "!from-cyan-400",
    to: "!to-cyan-500",
    hoverFrom: "hover:!from-cyan-500",
    hoverTo: "hover:!to-cyan-600",
  },
  {
    text: "text-amber-700",
    from: "!from-amber-400",
    to: "!to-amber-500",
    hoverFrom: "hover:!from-amber-500",
    hoverTo: "hover:!to-amber-600",
  },
  {
    text: "text-rose-600",
    from: "!from-rose-400",
    to: "!to-rose-500",
    hoverFrom: "hover:!from-rose-500",
    hoverTo: "hover:!to-rose-600",
  },
  {
    text: "text-indigo-600",
    from: "!from-indigo-400",
    to: "!to-indigo-500",
    hoverFrom: "hover:!from-indigo-500",
    hoverTo: "hover:!to-indigo-600",
  },
  {
    text: "text-teal-600",
    from: "!from-teal-400",
    to: "!to-teal-500",
    hoverFrom: "hover:!from-teal-500",
    hoverTo: "hover:!to-teal-600",
  },
] as const;

function MultiOutputHandles({ data }: { data: Record<string, unknown> }) {
  const categories = (data.categories as string[]) || [];

  if (categories.length === 0) {
    return (
      <div className="relative pb-8 nodrag">
        <div className="flex justify-center px-4 mb-1">
          <span className="text-[9px] font-medium text-gray-600">default</span>
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="default"
          className={cn(
            "!w-4 !h-4 !cursor-crosshair !z-10",
            "!bg-gradient-to-br !from-gray-400 !to-gray-500",
            "!border-2 !border-background",
            "hover:!from-gray-500 hover:!to-gray-600 transition-colors"
          )}
          style={{ left: "50%" }}
        />
      </div>
    );
  }

  // 包含所有分类 + default
  const allHandles = [...categories, "default"];
  const handleCount = allHandles.length;

  return (
    <div className="relative pb-8 nodrag">
      {/* 标签行 - 使用flex均匀分布 */}
      <div className="flex justify-around px-2 mb-1">
        {allHandles.map((category, index) => {
          const style = category === "default"
            ? null
            : multiColorClasses[index % multiColorClasses.length];
          return (
            <span
              key={category}
              className={cn(
                "text-[9px] font-medium truncate max-w-[60px] text-center",
                style?.text || "text-gray-600"
              )}
              title={category}
            >
              {category}
            </span>
          );
        })}
      </div>
      {/* Handle 使用绝对定位，通过left百分比分布 */}
      {allHandles.map((category, index) => {
        const style = category === "default"
          ? null
          : multiColorClasses[index % multiColorClasses.length];
        // 计算每个Handle的水平位置百分比
        const leftPercent = ((index + 0.5) / handleCount) * 100;
        return (
          <Handle
            key={category}
            type="source"
            position={Position.Bottom}
            id={category}
            className={cn(
              "!w-4 !h-4 !cursor-crosshair !z-10",
              "!bg-gradient-to-br",
              style?.from || "!from-gray-400",
              style?.to || "!to-gray-500",
              "!border-2 !border-background",
              style?.hoverFrom || "hover:!from-gray-500",
              style?.hoverTo || "hover:!to-gray-600",
              "transition-colors"
            )}
            style={{ left: `${leftPercent}%` }}
          />
        );
      })}
    </div>
  );
}

// 检查节点是否已配置
function getIsConfigured(type: NodeType, data: NodeData): boolean {
  const d = data as Record<string, unknown>;
  switch (type) {
    case "trigger:email":
    case "trigger:manual":
    case "action:archive":
    case "action:markRead":
    case "action:markUnread":
    case "action:star":
    case "action:unstar":
    case "action:delete":
    case "control:end":
      return true;
    case "trigger:schedule":
      return !!(d.cron as string);
    case "condition:match":
      return !!(d.value as string);
    case "condition:keyword":
      return (
        ((d.keywords as string[])?.length > 0) ||
        ((d.categories as string[])?.length > 0) ||
        !!(d.conditions)
      );
    case "condition:ai-classifier":
    case "condition:classifier":
      return ((d.categories as string[])?.length > 0);
    case "forward:email":
      return !!(d.to as string);
    case "forward:telegram":
      return !!(d.token as string) && !!(d.chatId as string);
    case "forward:discord":
    case "forward:slack":
      return !!(d.webhookUrl as string);
    case "forward:webhook":
      return !!(d.url as string);
    case "control:delay":
      return (d.duration as number) > 0;
    case "action:setVariable":
      return !!(d.name as string);
    case "action:unsetVariable":
      return !!(d.name as string);
    case "action:cloneVariable":
      return !!(d.source as string) && !!(d.target as string);
    case "action:rewriteEmail":
      return !!((d.subject as string)?.trim()) || !!((d.textBody as string)?.trim()) || !!((d.htmlBody as string)?.trim());
    case "action:regexReplace":
      return !!((d.pattern as string)?.trim());
    case "action:setTags":
      return ((d.tags as string[])?.length ?? 0) > 0;
    case "action:aiRewrite":
      return typeof d.writeTarget === "string" && ((d.fields as string[])?.length ?? 0) > 0;
    case "control:branch":
      return !!((d.condition as { value?: string })?.value);
    default:
      return true;
  }
}

// 获取节点预览文本
function getNodePreview(type: NodeType, data: NodeData): React.ReactNode {
  const d = data as Record<string, unknown>;

  switch (type) {
    case "trigger:email":
      return d.mailboxId ? (
        <span className="text-blue-600 font-medium">Specific mailbox</span>
      ) : (
        "All incoming emails"
      );

    case "trigger:schedule":
      const cron = d.cron as string;
      if (!cron) return "No schedule set";
      return (
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">
          {cron}
        </span>
      );

    case "trigger:manual":
      return "Manual execution only";

    case "condition:match":
      const field = d.field as string;
      const operator = d.operator as string;
      const value = d.value as string;
      if (!value) return null;
      return (
        <div className="space-y-0.5">
          <div className="font-medium text-foreground">
            {MATCH_FIELD_LABELS[field as keyof typeof MATCH_FIELD_LABELS] || field}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">
              {MATCH_OPERATOR_LABELS[operator as keyof typeof MATCH_OPERATOR_LABELS]?.toLowerCase() || operator}
            </span>
            <span className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] truncate max-w-[100px]">
              &quot;{value}&quot;
            </span>
          </div>
        </div>
      );

    case "condition:keyword":
      const kwCategories = d.categories as string[] | undefined;
      if (kwCategories && kwCategories.length > 0) {
        return (
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">
              {kwCategories.length} categories
            </div>
            <div className="flex flex-wrap gap-1">
              {kwCategories.slice(0, 3).map((cat, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]"
                >
                  {cat}
                </span>
              ))}
              {kwCategories.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{kwCategories.length - 3}
                </span>
              )}
            </div>
          </div>
        );
      }

      const keywords = d.keywords as string[];
      const conditions = d.conditions;
      if (conditions) {
        return <span className="text-amber-600 font-medium">Advanced conditions</span>;
      }
      if (!keywords?.length) return null;
      return (
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 3).map((kw, i) => (
            <span
              key={i}
              className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-medium"
            >
              {kw}
            </span>
          ))}
          {keywords.length > 3 && (
            <span className="text-muted-foreground text-[10px]">
              +{keywords.length - 3} more
            </span>
          )}
        </div>
      );

    case "condition:ai-classifier":
    case "condition:classifier":
      const aiCategories = d.categories as string[] | undefined;
      if (!aiCategories?.length) return null;
      return (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">
            AI Classification
          </div>
          <div className="flex flex-wrap gap-1">
            {aiCategories.slice(0, 3).map((cat, i) => (
              <span
                key={i}
                className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]"
              >
                {cat}
              </span>
            ))}
            {aiCategories.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{aiCategories.length - 3}
              </span>
            )}
          </div>
        </div>
      );

    case "forward:email":
      const to = d.to as string;
      return to ? (
        <span className="font-mono text-[11px] truncate block">{to}</span>
      ) : null;

    case "forward:telegram":
      const chatId = d.chatId as string;
      return chatId ? (
        <span className="font-mono text-[11px]">Chat: {chatId}</span>
      ) : null;

    case "forward:discord":
    case "forward:slack":
      const webhookUrl = d.webhookUrl as string;
      return webhookUrl ? (
        <span className="text-green-600 font-medium flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Webhook configured
        </span>
      ) : null;

    case "forward:webhook":
      const url = d.url as string;
      const method = (d.method as string) || "POST";
      if (!url) return null;
      return (
        <div className="space-y-0.5">
          <span className="inline-block bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
            {method}
          </span>
          <div className="font-mono text-[10px] truncate opacity-75">
            {url.replace(/^https?:\/\//, "")}
          </div>
        </div>
      );

    case "control:delay":
      const duration = (d.duration as number) || 0;
      const formatted = formatDuration(duration);
      return (
        <span className="flex items-center gap-1">
          <Timer className="w-3 h-3 text-indigo-500" />
          <span className="font-medium text-indigo-600">{formatted}</span>
        </span>
      );

    case "action:setVariable":
      const varName = d.name as string;
      const varValue = d.value as string;
      if (!varName) return null;
      return (
        <div className="font-mono text-[11px]">
          <span className="text-green-600">{varName}</span>
          <span className="text-muted-foreground"> = </span>
          <span className="truncate">{varValue?.slice(0, 20) || "..."}</span>
        </div>
      );

    case "action:unsetVariable":
      const unsetName = d.name as string;
      if (!unsetName) return null;
      return (
        <div className="font-mono text-[11px]">
          <span className="text-red-600">unset</span>
          <span className="text-muted-foreground"> </span>
          <span className="text-green-600">{unsetName}</span>
        </div>
      );

    case "action:cloneVariable":
      const source = d.source as string;
      const target = d.target as string;
      if (!source || !target) return null;
      return (
        <div className="font-mono text-[11px]">
          <span className="text-green-600">{source}</span>
          <span className="text-muted-foreground"> → </span>
          <span className="text-green-600">{target}</span>
        </div>
      );

    case "action:rewriteEmail": {
      const fields: string[] = [];
      if ((d.subject as string)?.trim()) fields.push("subject");
      if ((d.textBody as string)?.trim()) fields.push("text");
      if ((d.htmlBody as string)?.trim()) fields.push("html");
      if (fields.length === 0) return <span className="text-muted-foreground text-[11px]">No fields set</span>;
      return (
        <span className="text-muted-foreground text-[11px]">
          {fields.join(", ")}
        </span>
      );
    }

    case "action:regexReplace": {
      const field = d.field as string;
      const pattern = d.pattern as string;
      if (!pattern) return null;
      return (
        <div className="space-y-0.5">
          <div className="text-[11px] text-muted-foreground">{field || "field"}</div>
          <div className="font-mono bg-muted px-1 py-0.5 rounded text-[10px] truncate max-w-[120px]">
            /{pattern}/
          </div>
        </div>
      );
    }

    case "action:setTags": {
      const mode = String(d.mode || "add");
      const tags = (d.tags as string[]) || [];
      if (tags.length === 0) return null;
      return (
        <div className="space-y-1">
          <div className="text-[11px] text-muted-foreground">{mode}</div>
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px]"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{tags.length - 3}
              </span>
            )}
          </div>
        </div>
      );
    }

    case "action:aiRewrite": {
      const writeTarget = (d.writeTarget as string) || "variables";
      const fields = (d.fields as string[]) || [];
      return (
        <div className="space-y-0.5">
          <div className="text-[11px] text-muted-foreground">{writeTarget}</div>
          {fields.length > 0 && (
            <div className="text-[10px] text-muted-foreground truncate">
              {fields.join(", ")}
            </div>
          )}
        </div>
      );
    }

    case "control:branch":
      const condition = d.condition as { field?: string; operator?: string; value?: string };
      if (!condition?.value) return null;
      return (
        <div className="text-[11px]">
          <span className="text-muted-foreground">if </span>
          <span className="font-medium">
            {MATCH_FIELD_LABELS[condition.field as keyof typeof MATCH_FIELD_LABELS] || condition.field}
          </span>
          <span className="text-muted-foreground">
            {" "}
            {MATCH_OPERATOR_LABELS[condition.operator as keyof typeof MATCH_OPERATOR_LABELS]?.toLowerCase()}
          </span>
        </div>
      );

    case "action:archive":
      return <span className="text-orange-600">Archive email</span>;
    case "action:markRead":
      return <span className="text-green-600">Mark as read</span>;
    case "action:markUnread":
      return <span className="text-blue-600">Mark as unread</span>;
    case "action:star":
      return <span className="text-yellow-600">Add star</span>;
    case "action:unstar":
      return <span className="text-slate-600">Remove star</span>;
    case "action:delete":
      return <span className="text-red-600">Delete email</span>;
    case "control:end":
      return <span className="text-slate-500">Stop workflow</span>;

    default:
      return NODE_DEFINITIONS[type]?.description || "";
  }
}

// 格式化持续时间
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export const BaseNode = memo(BaseNodeComponent);
