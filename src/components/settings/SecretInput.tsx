"use client";

import * as React from "react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SecretInputProps = {
  label: string;
  value: string;
  masked: boolean;
  placeholder?: string;
  maskedPlaceholder?: string;
  onChange: (value: string) => void;
  id?: string;
};

export function SecretInput({
  label,
  value,
  masked,
  placeholder,
  maskedPlaceholder = "••••••••（configured）",
  onChange,
  id,
}: SecretInputProps) {
  const [focused, setFocused] = useState(false);

  const displayPlaceholder =
    masked && !value && !focused ? maskedPlaceholder : placeholder;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        placeholder={displayPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
