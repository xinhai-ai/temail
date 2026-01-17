"use client";

import { useState, useCallback } from "react";
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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Parentheses,
} from "lucide-react";
import type {
  CompositeCondition,
  MatchField,
  MatchOperator,
} from "@/lib/workflow/types";
import {
  MATCH_FIELD_LABELS,
  MATCH_OPERATOR_LABELS,
  VALUE_OPERATORS,
} from "@/lib/workflow/types";

interface ConditionBuilderProps {
  value?: CompositeCondition;
  onChange: (condition: CompositeCondition | undefined) => void;
  className?: string;
}

const EMPTY_MATCH: CompositeCondition = {
  kind: "match",
  field: "subject",
  operator: "contains",
  value: "",
  caseSensitive: false,
};

function createEmptyGroup(kind: "and" | "or"): CompositeCondition {
  return {
    kind,
    conditions: [{ ...EMPTY_MATCH }],
  };
}

// 单条匹配条件编辑器
interface MatchConditionEditorProps {
  condition: Extract<CompositeCondition, { kind: "match" }>;
  onChange: (condition: CompositeCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function MatchConditionEditor({
  condition,
  onChange,
  onRemove,
  canRemove,
}: MatchConditionEditorProps) {
  const needsValue = VALUE_OPERATORS.includes(condition.operator);

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2">
        <Select
          value={condition.field}
          onValueChange={(v) =>
            onChange({ ...condition, field: v as MatchField })
          }
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATCH_FIELD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={condition.operator}
          onValueChange={(v) =>
            onChange({ ...condition, operator: v as MatchOperator })
          }
        >
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATCH_OPERATOR_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive h-8 w-8"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {needsValue && (
        <Input
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder={
            condition.operator === "regex" ? "Regular expression" : "Value"
          }
          className="h-8 text-xs"
        />
      )}

      <div className="flex items-center gap-2">
        <Switch
          id="caseSensitive"
          checked={condition.caseSensitive || false}
          onCheckedChange={(v) => onChange({ ...condition, caseSensitive: v })}
          className="scale-75"
        />
        <Label htmlFor="caseSensitive" className="text-xs text-muted-foreground">
          Case sensitive
        </Label>
      </div>
    </div>
  );
}

// 条件组编辑器 (AND/OR)
interface ConditionGroupEditorProps {
  condition: Extract<CompositeCondition, { kind: "and" | "or" }>;
  onChange: (condition: CompositeCondition) => void;
  onRemove?: () => void;
  depth?: number;
}

function ConditionGroupEditor({
  condition,
  onChange,
  onRemove,
  depth = 0,
}: ConditionGroupEditorProps) {
  const [expanded, setExpanded] = useState(true);

  const handleConditionChange = (index: number, newCondition: CompositeCondition) => {
    const newConditions = [...condition.conditions];
    newConditions[index] = newCondition;
    onChange({ ...condition, conditions: newConditions });
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = condition.conditions.filter((_, i) => i !== index);
    if (newConditions.length === 0) {
      onRemove?.();
    } else {
      onChange({ ...condition, conditions: newConditions });
    }
  };

  const handleAddCondition = () => {
    onChange({
      ...condition,
      conditions: [...condition.conditions, { ...EMPTY_MATCH }],
    });
  };

  const handleAddGroup = (kind: "and" | "or") => {
    onChange({
      ...condition,
      conditions: [...condition.conditions, createEmptyGroup(kind)],
    });
  };

  const handleAddNot = () => {
    onChange({
      ...condition,
      conditions: [
        ...condition.conditions,
        { kind: "not", condition: { ...EMPTY_MATCH } },
      ],
    });
  };

  const toggleKind = () => {
    onChange({
      ...condition,
      kind: condition.kind === "and" ? "or" : "and",
    });
  };

  const borderColor = condition.kind === "and" ? "border-blue-500/50" : "border-amber-500/50";
  const bgColor = condition.kind === "and" ? "bg-blue-500/5" : "bg-amber-500/5";

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed p-2",
        borderColor,
        bgColor,
        depth > 0 && "ml-2"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-6 px-2 text-xs font-semibold",
            condition.kind === "and"
              ? "text-blue-600 border-blue-300 hover:bg-blue-50"
              : "text-amber-600 border-amber-300 hover:bg-amber-50"
          )}
          onClick={toggleKind}
        >
          {condition.kind.toUpperCase()}
        </Button>

        <span className="text-xs text-muted-foreground">
          {condition.conditions.length} condition{condition.conditions.length !== 1 && "s"}
        </span>

        <div className="flex-1" />

        {onRemove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive h-6 w-6"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="space-y-2">
          {condition.conditions.map((child, index) => (
            <div key={index}>
              {child.kind === "match" ? (
                <MatchConditionEditor
                  condition={child}
                  onChange={(newCond) => handleConditionChange(index, newCond)}
                  onRemove={() => handleRemoveCondition(index)}
                  canRemove={condition.conditions.length > 1}
                />
              ) : child.kind === "not" ? (
                <NotConditionEditor
                  condition={child}
                  onChange={(newCond) => handleConditionChange(index, newCond)}
                  onRemove={() => handleRemoveCondition(index)}
                  depth={depth + 1}
                />
              ) : (
                <ConditionGroupEditor
                  condition={child}
                  onChange={(newCond) => handleConditionChange(index, newCond)}
                  onRemove={() => handleRemoveCondition(index)}
                  depth={depth + 1}
                />
              )}
            </div>
          ))}

          <div className="flex gap-1 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddCondition}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Rule
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAddGroup("and")}
            >
              <Parentheses className="h-3 w-3 mr-1" />
              AND Group
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleAddGroup("or")}
            >
              <Parentheses className="h-3 w-3 mr-1" />
              OR Group
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleAddNot}
            >
              <CirclePlus className="h-3 w-3 mr-1" />
              NOT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// NOT 条件编辑器
interface NotConditionEditorProps {
  condition: Extract<CompositeCondition, { kind: "not" }>;
  onChange: (condition: CompositeCondition) => void;
  onRemove: () => void;
  depth: number;
}

function NotConditionEditor({
  condition,
  onChange,
  onRemove,
  depth,
}: NotConditionEditorProps) {
  const handleInnerChange = (newCondition: CompositeCondition) => {
    onChange({ kind: "not", condition: newCondition });
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed p-2 border-red-500/50 bg-red-500/5",
        depth > 0 && "ml-2"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-red-600 px-2 py-0.5 bg-red-100 rounded">
          NOT
        </span>
        <span className="text-xs text-muted-foreground">Negate the following condition</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive h-6 w-6"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {condition.condition.kind === "match" ? (
        <MatchConditionEditor
          condition={condition.condition}
          onChange={handleInnerChange}
          onRemove={onRemove}
          canRemove={false}
        />
      ) : condition.condition.kind === "not" ? (
        <NotConditionEditor
          condition={condition.condition}
          onChange={handleInnerChange}
          onRemove={onRemove}
          depth={depth + 1}
        />
      ) : (
        <ConditionGroupEditor
          condition={condition.condition}
          onChange={handleInnerChange}
          onRemove={onRemove}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

// 主组件
export function ConditionBuilder({
  value,
  onChange,
  className,
}: ConditionBuilderProps) {
  const handleCreateCondition = () => {
    onChange(createEmptyGroup("and"));
  };

  if (!value) {
    return (
      <div className={cn("space-y-2", className)}>
        <Label className="text-xs text-muted-foreground">
          No conditions configured
        </Label>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleCreateCondition}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Conditions
        </Button>
      </div>
    );
  }

  const handleChange = (newCondition: CompositeCondition) => {
    onChange(newCondition);
  };

  const handleRemove = () => {
    onChange(undefined);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value.kind === "match" ? (
        <div className="space-y-2">
          <MatchConditionEditor
            condition={value}
            onChange={handleChange}
            onRemove={handleRemove}
            canRemove={true}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() =>
              onChange({
                kind: "and",
                conditions: [value, { ...EMPTY_MATCH }],
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Another Condition
          </Button>
        </div>
      ) : value.kind === "not" ? (
        <NotConditionEditor
          condition={value}
          onChange={handleChange}
          onRemove={handleRemove}
          depth={0}
        />
      ) : (
        <ConditionGroupEditor
          condition={value}
          onChange={handleChange}
          onRemove={handleRemove}
          depth={0}
        />
      )}
    </div>
  );
}

// 简单条件编辑器 - 用于单个 match 条件的场景
interface SimpleConditionEditorProps {
  field: MatchField;
  operator: MatchOperator;
  value: string;
  caseSensitive?: boolean;
  onChange: (data: {
    field: MatchField;
    operator: MatchOperator;
    value: string;
    caseSensitive?: boolean;
  }) => void;
}

export function SimpleConditionEditor({
  field,
  operator,
  value,
  caseSensitive,
  onChange,
}: SimpleConditionEditorProps) {
  const needsValue = VALUE_OPERATORS.includes(operator);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Field</Label>
        <Select
          value={field}
          onValueChange={(v) => onChange({ field: v as MatchField, operator, value, caseSensitive })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATCH_FIELD_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Operator</Label>
        <Select
          value={operator}
          onValueChange={(v) => onChange({ field, operator: v as MatchOperator, value, caseSensitive })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATCH_OPERATOR_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {needsValue && (
        <div className="space-y-2">
          <Label htmlFor="conditionValue">Value</Label>
          <Input
            id="conditionValue"
            value={value}
            onChange={(e) => onChange({ field, operator, value: e.target.value, caseSensitive })}
            placeholder={operator === "regex" ? "Regular expression" : "Enter value"}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch
          id="simpleCaseSensitive"
          checked={caseSensitive || false}
          onCheckedChange={(v) => onChange({ field, operator, value, caseSensitive: v })}
        />
        <Label htmlFor="simpleCaseSensitive">Case Sensitive</Label>
      </div>
    </div>
  );
}
