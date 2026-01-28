import { prisma } from "@/lib/prisma";

export interface AiProviderSettings {
  baseUrl: string | null;
  apiKey: string | null;
  models: string[];
}

function normalizeSettingValue(value: string | undefined): string | null {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : null;
}

export function parseAiProviderModels(raw: string | null | undefined): string[] {
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
    models.push(model);
  }

  return Array.from(new Set(models));
}

export function getAiProviderSettingsFromValues(values: Map<string, string>): AiProviderSettings {
  return {
    baseUrl: normalizeSettingValue(values.get("ai_provider_base_url")),
    apiKey: normalizeSettingValue(values.get("ai_provider_api_key")),
    models: parseAiProviderModels(values.get("ai_provider_models")),
  };
}

export async function getAiProviderSettings(): Promise<AiProviderSettings> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ["ai_provider_base_url", "ai_provider_api_key", "ai_provider_models"],
        },
      },
    });

    const values = new Map(settings.map((s) => [s.key, s.value]));
    return getAiProviderSettingsFromValues(values);
  } catch (error) {
    console.error("AI Provider: failed to load settings:", error);
    return { baseUrl: null, apiKey: null, models: [] };
  }
}

