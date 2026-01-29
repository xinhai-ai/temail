"use client";

import { useState, useCallback, useEffect } from "react";

function parseAiProviderModels(raw: string | undefined): string[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const models: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const model = item.trim();
    if (!model) continue;
    if (models.includes(model)) continue;
    models.push(model);
  }

  return models;
}

type UseAiProviderModelsReturn = {
  models: string[];
  modelDraft: string;
  setModelDraft: (value: string) => void;
  addModel: () => void;
  removeModel: (model: string) => void;
  getModelsJson: () => string;
  syncFromValue: (rawValue: string) => void;
};

export function useAiProviderModels(
  initialValue?: string,
  onModelsChange?: (modelsJson: string) => void
): UseAiProviderModelsReturn {
  const [models, setModels] = useState<string[]>(() =>
    parseAiProviderModels(initialValue)
  );
  const [modelDraft, setModelDraft] = useState("");

  const addModel = useCallback(() => {
    const model = modelDraft.trim();
    if (!model) return;
    setModels((prev) => {
      if (prev.includes(model)) return prev;
      const next = [...prev, model];
      onModelsChange?.(JSON.stringify(next));
      return next;
    });
    setModelDraft("");
  }, [modelDraft, onModelsChange]);

  const removeModel = useCallback(
    (model: string) => {
      setModels((prev) => {
        const next = prev.filter((m) => m !== model);
        onModelsChange?.(JSON.stringify(next));
        return next;
      });
    },
    [onModelsChange]
  );

  const getModelsJson = useCallback(() => {
    return JSON.stringify(models);
  }, [models]);

  const syncFromValue = useCallback((rawValue: string) => {
    setModels(parseAiProviderModels(rawValue));
  }, []);

  return {
    models,
    modelDraft,
    setModelDraft,
    addModel,
    removeModel,
    getModelsJson,
    syncFromValue,
  };
}
