"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

export type ForwardConditionField = "subject" | "fromAddress" | "toAddress" | "textBody";
export type ForwardConditionOperator = "contains" | "equals" | "startsWith" | "endsWith" | "regex";

export type ForwardConditionNode =
  | { kind: "and"; conditions: ForwardConditionNode[] }
  | { kind: "or"; conditions: ForwardConditionNode[] }
  | { kind: "not"; condition: ForwardConditionNode }
  | {
      kind: "match";
      field: ForwardConditionField;
      operator: ForwardConditionOperator;
      value: string;
      caseSensitive?: boolean;
    };

export type ForwardConditionTree = Extract<ForwardConditionNode, { kind: "and" | "or" }>;

function createMatchCondition(): Extract<ForwardConditionNode, { kind: "match" }> {
  return { kind: "match", field: "subject", operator: "contains", value: "" };
}

function createGroupCondition(kind: "and" | "or"): Extract<ForwardConditionNode, { kind: "and" | "or" }> {
  return { kind, conditions: [createMatchCondition()] };
}

function createNotCondition(): Extract<ForwardConditionNode, { kind: "not" }> {
  return { kind: "not", condition: createMatchCondition() };
}

export function normalizeForwardConditionNode(node: ForwardConditionNode): ForwardConditionNode | null {
  switch (node.kind) {
    case "match": {
      const value = node.value.trim();
      if (!value) return null;
      return {
        kind: "match",
        field: node.field,
        operator: node.operator,
        value,
        ...(node.caseSensitive ? { caseSensitive: true } : {}),
      };
    }
    case "not": {
      const child = normalizeForwardConditionNode(node.condition);
      if (!child) return null;
      return { kind: "not", condition: child };
    }
    case "and":
    case "or": {
      const conditions = node.conditions
        .map(normalizeForwardConditionNode)
        .filter((c): c is ForwardConditionNode => Boolean(c));
      if (conditions.length === 0) return null;
      return { kind: node.kind, conditions };
    }
  }
}

export function countForwardMatchConditions(node: ForwardConditionNode | null | undefined): number {
  if (!node) return 0;
  switch (node.kind) {
    case "match":
      return node.value.trim() ? 1 : 0;
    case "not":
      return countForwardMatchConditions(node.condition);
    case "and":
    case "or":
      return node.conditions.reduce((acc, c) => acc + countForwardMatchConditions(c), 0);
  }
}

type NodeEditorProps = {
  depth: number;
  node: ForwardConditionNode;
  onChange: (next: ForwardConditionNode) => void;
  onRemove?: () => void;
};

function NodeEditor({ depth, node, onChange, onRemove }: NodeEditorProps) {
  if (node.kind === "and" || node.kind === "or") {
    return (
      <div className={cn("rounded-md border bg-background p-3 space-y-3", depth > 0 && "ml-4")}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Group</Label>
            <Select value={node.kind} onValueChange={(value) => onChange({ ...node, kind: value as "and" | "or" })}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="and">Match all (AND)</SelectItem>
                <SelectItem value="or">Match any (OR)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 justify-end flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...node, conditions: [...node.conditions, createMatchCondition()] })}
            >
              <Plus className="mr-2 h-3 w-3" />
              Condition
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...node, conditions: [...node.conditions, createGroupCondition("and")] })}
            >
              <Plus className="mr-2 h-3 w-3" />
              Group
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...node, conditions: [...node.conditions, createNotCondition()] })}
            >
              <Plus className="mr-2 h-3 w-3" />
              NOT
            </Button>
            {onRemove && (
              <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {node.conditions.length === 0 ? (
          <div className="text-xs text-muted-foreground">No conditions in this group.</div>
        ) : (
          <div className="space-y-3 border-l border-dashed pl-4">
            {node.conditions.map((child, index) => (
              <NodeEditor
                key={index}
                depth={depth + 1}
                node={child}
                onChange={(next) =>
                  onChange({
                    ...node,
                    conditions: node.conditions.map((c, i) => (i === index ? next : c)),
                  })
                }
                onRemove={() => onChange({ ...node, conditions: node.conditions.filter((_, i) => i !== index) })}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (node.kind === "not") {
    return (
      <div className={cn("rounded-md border bg-background p-3 space-y-3", depth > 0 && "ml-4")}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">NOT</div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onChange(node.condition)}>
              Remove NOT
            </Button>
            {onRemove && (
              <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="border-l border-dashed pl-4">
          <NodeEditor depth={depth + 1} node={node.condition} onChange={(next) => onChange({ ...node, condition: next })} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border bg-background p-3 space-y-3", depth > 0 && "ml-4")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Match</div>
        {onRemove && (
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-12">
        <div className="md:col-span-3 space-y-1">
          <Label className="text-xs text-muted-foreground">Field</Label>
          <Select value={node.field} onValueChange={(value) => onChange({ ...node, field: value as ForwardConditionField })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="subject">Subject</SelectItem>
              <SelectItem value="fromAddress">From</SelectItem>
              <SelectItem value="toAddress">To</SelectItem>
              <SelectItem value="textBody">Text</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-3 space-y-1">
          <Label className="text-xs text-muted-foreground">Operator</Label>
          <Select value={node.operator} onValueChange={(value) => onChange({ ...node, operator: value as ForwardConditionOperator })}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contains">contains</SelectItem>
              <SelectItem value="equals">equals</SelectItem>
              <SelectItem value="startsWith">startsWith</SelectItem>
              <SelectItem value="endsWith">endsWith</SelectItem>
              <SelectItem value="regex">regex</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-4 space-y-1">
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Input
            placeholder="Value"
            value={node.value}
            onChange={(e) => onChange({ ...node, value: e.target.value })}
          />
        </div>

        <div className="md:col-span-2 flex items-end">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={Boolean(node.caseSensitive)}
              onCheckedChange={(checked) => onChange({ ...node, caseSensitive: checked === true ? true : undefined })}
            />
            Case-sensitive
          </label>
        </div>
      </div>
    </div>
  );
}

type ForwardConditionTreeEditorProps = {
  value: ForwardConditionTree;
  onChange: (next: ForwardConditionTree) => void;
};

export function ForwardConditionTreeEditor({ value, onChange }: ForwardConditionTreeEditorProps) {
  return <NodeEditor depth={0} node={value} onChange={(next) => onChange(next as ForwardConditionTree)} />;
}

