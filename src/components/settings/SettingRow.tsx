"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SettingRowBaseProps = {
  label: string;
  description?: string;
  htmlFor?: string;
  className?: string;
};

type SettingRowSwitchProps = SettingRowBaseProps & {
  type: "switch";
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

type SettingRowInputProps = SettingRowBaseProps & {
  type?: "text" | "password" | "email" | "number";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type SettingRowTextareaProps = SettingRowBaseProps & {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
};

type SettingRowCustomProps = SettingRowBaseProps & {
  type: "custom";
  children: React.ReactNode;
};

export type SettingRowProps =
  | SettingRowSwitchProps
  | SettingRowInputProps
  | SettingRowTextareaProps
  | SettingRowCustomProps;

export function SettingRow(props: SettingRowProps) {
  const { label, description, htmlFor, className } = props;

  if (props.type === "switch") {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <div className="space-y-0.5">
          <Label htmlFor={htmlFor}>{label}</Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Switch
          id={htmlFor}
          checked={props.checked}
          onCheckedChange={props.onCheckedChange}
          disabled={props.disabled}
        />
      </div>
    );
  }

  if (props.type === "textarea") {
    return (
      <div className={cn("space-y-2", className)}>
        <Label htmlFor={htmlFor}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <Textarea
          id={htmlFor}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 4}
          disabled={props.disabled}
          className="font-mono text-sm"
        />
      </div>
    );
  }

  if (props.type === "custom") {
    return (
      <div className={cn("space-y-2", className)}>
        <Label htmlFor={htmlFor}>{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {props.children}
      </div>
    );
  }

  // Default: input
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <Input
        id={htmlFor}
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
    </div>
  );
}
