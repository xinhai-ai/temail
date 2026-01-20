"use client";

import { DragEvent, useState } from "react";
import { cn } from "@/lib/utils";
import { NODE_DEFINITIONS, NodeType } from "@/lib/workflow/types";
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
  ChevronDown,
  ChevronRight,
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

// 节点分类
const categories = [
  {
    id: "trigger",
    label: "Triggers",
    description: "Start your workflow",
    types: ["trigger:email", "trigger:schedule", "trigger:manual"] as NodeType[],
  },
  {
    id: "condition",
    label: "Conditions",
    description: "Add logic branches",
    types: ["condition:match", "condition:keyword", "condition:ai-classifier", "condition:custom"] as NodeType[],
  },
  {
    id: "action",
    label: "Actions",
    description: "Perform operations",
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
    label: "Forwards",
    description: "Send notifications",
    types: ["forward:email", "forward:telegram-bound", "forward:telegram", "forward:discord", "forward:slack", "forward:webhook"] as NodeType[],
  },
  {
    id: "control",
    label: "Control Flow",
    description: "Control execution",
    types: ["control:branch", "control:delay", "control:end"] as NodeType[],
  },
];

interface NodePaletteProps {
  collapsed?: boolean;
}

export function NodePalette({ collapsed = false }: NodePaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    trigger: true,
    condition: true,
    action: true,
    forward: true,
    control: true,
  });

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
        <h3 className="font-semibold text-sm">Nodes</h3>
        <p className="text-xs text-muted-foreground">Drag nodes to canvas</p>
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
