"use client";

import { DragEvent, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, NodeType } from "@/lib/workflow/types";
import { useTranslations } from "next-intl";
import { isVercelDeployment } from "@/lib/deployment/public";
import {
  Mail,
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
  Bell,
  GitBranch,
  Timer,
  CircleStop,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// 图标映射
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail,
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
  Bell,
  GitBranch,
  Timer,
  CircleStop,
};

// 节点分类
const categoryTypes = [
  {
    id: "trigger",
    types: ["trigger:email"] as NodeType[],
  },
  {
    id: "condition",
    types: ["condition:match", "condition:keyword", "condition:ai-classifier", "condition:custom"] as NodeType[],
  },
  {
    id: "action",
    types: [
      "action:archive",
      "action:markRead",
      "action:markUnread",
      "action:star",
      "action:unstar",
      "action:delete",
      "action:setVariable",
      "action:unsetVariable",
      "action:cloneVariable",
      "action:rewriteEmail",
      "action:regexReplace",
      "action:setTags",
      "action:aiRewrite",
    ] as NodeType[],
  },
  {
    id: "forward",
    types: [
      "forward:email",
      "forward:telegram-bound",
      "forward:telegram",
      "forward:discord",
      "forward:slack",
      "forward:webhook",
      "forward:feishu",
      "forward:serverchan",
    ] as NodeType[],
  },
  {
    id: "control",
    types: ["control:branch", "control:delay", "control:end"] as NodeType[],
  },
] as const;

interface NodePaletteProps {
  collapsed?: boolean;
}

type UserGroupInfo = {
  userGroup: {
    telegramEnabled: boolean;
    workflowForwardEmailEnabled: boolean;
    workflowForwardWebhookEnabled: boolean;
  } | null;
};

let cachedUserGroup: UserGroupInfo["userGroup"] | null | undefined;
let cachedUserGroupPromise: Promise<UserGroupInfo["userGroup"] | null> | null = null;

async function getCachedUserGroup(): Promise<UserGroupInfo["userGroup"] | null> {
  if (cachedUserGroup !== undefined) return cachedUserGroup;
  if (!cachedUserGroupPromise) {
    cachedUserGroupPromise = fetch("/api/users/me/usergroup")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || typeof data !== "object") {
          cachedUserGroup = null;
          return null;
        }
        const userGroup = (data as UserGroupInfo).userGroup ?? null;
        cachedUserGroup = userGroup;
        return userGroup;
      })
      .catch(() => {
        cachedUserGroup = null;
        return null;
      })
      .finally(() => {
        cachedUserGroupPromise = null;
      });
  }
  return cachedUserGroupPromise;
}

export function NodePalette({ collapsed = false }: NodePaletteProps) {
  const t = useTranslations("workflows");
  const vercelMode = isVercelDeployment();
  const [userGroup, setUserGroup] = useState<UserGroupInfo["userGroup"] | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    trigger: true,
    condition: true,
    action: true,
    forward: true,
    control: true,
  });

  useEffect(() => {
    getCachedUserGroup().then((value) => setUserGroup(value));
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const onDragStart = (event: DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const disabledNodeTypes = new Set<NodeType>();
  if (vercelMode) disabledNodeTypes.add("forward:email");
  if (userGroup && !userGroup.workflowForwardEmailEnabled) disabledNodeTypes.add("forward:email");
  if (userGroup && !userGroup.workflowForwardWebhookEnabled) {
    disabledNodeTypes.add("forward:webhook");
    disabledNodeTypes.add("forward:feishu");
    disabledNodeTypes.add("forward:serverchan");
  }
  if (userGroup && !userGroup.telegramEnabled) {
    disabledNodeTypes.add("forward:telegram");
    disabledNodeTypes.add("forward:telegram-bound");
  }

  const categories = categoryTypes.map((c) => ({
    ...c,
    types: c.types.filter((type) => !disabledNodeTypes.has(type)),
    label: t(`nodePalette.categories.${c.id}`),
  }));

  if (collapsed) {
    return (
      <div className="w-12 border-r bg-muted/30 py-2 h-full overflow-y-auto">
        <div className="space-y-1 px-1">
            {categories.flatMap((category) =>
              category.types.map((type) => {
                const def = NODE_DEFINITIONS[type];
                const Icon = iconMap[def.icon] || Circle;
                return (
                  <div
                    key={type}
                    draggable
                    onDragStart={(e) => onDragStart(e, type)}
                    className="p-2 rounded cursor-grab hover:bg-muted active:cursor-grabbing"
                    title={def.label}
                    style={{ color: def.color }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                );
              })
            )}
          </div>
      </div>
    );
  }

  return (
    <div className="w-56 border-r bg-muted/30 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b flex-shrink-0">
        <h3 className="font-semibold text-sm">{t("nodePalette.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("nodePalette.subtitle")}</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
          {categories.map((category) => {
            const isExpanded = expandedCategories[category.id];
            return (
              <div key={category.id}>
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-muted rounded text-sm font-medium transition-colors"
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.label}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="mt-1 space-y-1">
                    {category.types.map((type) => {
                      const def = NODE_DEFINITIONS[type];
                      const Icon = iconMap[def.icon] || Circle;
                      return (
                        <div
                          key={type}
                          draggable
                          onDragStart={(e) => onDragStart(e, type)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded cursor-grab",
                            "hover:bg-muted active:cursor-grabbing",
                            "transition-colors"
                          )}
                        >
                          <div
                            className="p-1 rounded"
                            style={{
                              backgroundColor: `${def.color}20`,
                              color: def.color,
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{def.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
