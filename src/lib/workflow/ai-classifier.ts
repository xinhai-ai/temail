import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import type { ConditionAiClassifierData, ExecutionContext } from "@/lib/workflow/types";

const ClassificationResultSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

export interface AiClassifierConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  defaultPrompt: string;
}

export const DEFAULT_AI_CLASSIFIER_PROMPT = `You are an email classification assistant. Analyze the email content and classify it into one of the following categories:

{{categories}}

Return your result in JSON.

Email Subject: {{email.subject}}
Email From: {{email.fromAddress}}
Email Body: {{email.textBody}}`;

export async function getAiClassifierConfig(): Promise<AiClassifierConfig | null> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "ai_classifier_enabled",
            "ai_classifier_base_url",
            "ai_classifier_model",
            "ai_classifier_api_key",
            "ai_classifier_default_prompt",
          ],
        },
      },
    });

    const values = new Map(settings.map((s) => [s.key, s.value]));

    const enabled = values.get("ai_classifier_enabled") === "true";
    if (!enabled) return null;

    return {
      enabled,
      baseUrl: values.get("ai_classifier_base_url") || "https://api.openai.com/v1",
      model: values.get("ai_classifier_model") || "gpt-4o-mini",
      apiKey: values.get("ai_classifier_api_key") || "",
      defaultPrompt: values.get("ai_classifier_default_prompt") || DEFAULT_AI_CLASSIFIER_PROMPT,
    };
  } catch (error) {
    console.error("AI Classifier: failed to load config:", error);
    return null;
  }
}

function truncateText(text: string | undefined, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildMessages(
  data: ConditionAiClassifierData,
  context: ExecutionContext,
  config: AiClassifierConfig
) {
  const defaultPrompt = data.customPrompt || config.defaultPrompt;
  const categoriesForModel = Array.from(new Set([...data.categories, "default"])).filter(
    (c) => c.trim().length > 0
  );
  const categoriesList = categoriesForModel.map((c) => `- ${c}`).join("\n");

  const email = context.email
    ? {
        ...context.email,
        textBody: truncateText(context.email.textBody, 1000),
        htmlBody: truncateText(context.email.htmlBody, 1000),
      }
    : undefined;

  const prompt = replaceTemplateVariables(defaultPrompt, {
    categories: categoriesList,
    email,
    variables: context.variables,
  });

  return [
    { role: "system" as const, content: prompt },
    { role: "user" as const, content: "Classify this email." },
  ];
}

async function callOpenAiStructured(
  data: ConditionAiClassifierData,
  context: ExecutionContext,
  config: AiClassifierConfig
): Promise<ClassificationResult> {
  const categoriesForModel = Array.from(new Set([...data.categories, "default"])).filter(
    (c) => c.trim().length > 0
  );
  const jsonSchema = {
    type: "object",
    properties: {
      category: { type: "string", enum: categoriesForModel },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      reasoning: { type: "string" },
    },
    // Some OpenAI-compatible providers require every property to be listed here.
    required: ["category", "confidence", "reasoning"],
    additionalProperties: false,
  };

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildMessages(data, context, config),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_classification",
          strict: true,
          schema: jsonSchema,
        },
      },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI Classifier: upstream error ${res.status} ${text}`);
  }

  const json: unknown = await res.json();
  const content = (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI Classifier: empty response content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`AI Classifier: invalid JSON content (${String(error)})`);
  }

  return ClassificationResultSchema.parse(parsed);
}

function chooseTestModeCategory(data: ConditionAiClassifierData, context: ExecutionContext): string {
  const categories = data.categories || [];
  const defaultCategory = data.defaultCategory || "default";
  if (categories.length === 0) return defaultCategory;

  const content = `${context.email?.subject || ""}\n${context.email?.textBody || ""}`.toLowerCase();
  for (const category of categories) {
    if (content.includes(category.toLowerCase())) return category;
  }
  return categories[0];
}

export async function evaluateAiClassifier(
  data: ConditionAiClassifierData,
  context: ExecutionContext
): Promise<string> {
  const defaultCategory = data.defaultCategory || "default";

  if (!data.categories?.length) {
    return defaultCategory;
  }

  const config = await getAiClassifierConfig();
  if (!config || !config.apiKey) {
    if (context.isTestMode) {
      return chooseTestModeCategory(data, context);
    }
    if (!config) return defaultCategory;
    console.warn("AI Classifier: missing API key, using default category");
    return defaultCategory;
  }

  try {
    const result = await callOpenAiStructured(data, context, config);
    const threshold = data.confidenceThreshold ?? 0.7;

    if (result.confidence < threshold) {
      return defaultCategory;
    }

    const categoriesForModel = Array.from(new Set([...data.categories, "default"])).filter(
      (c) => c.trim().length > 0
    );
    if (!categoriesForModel.includes(result.category)) {
      return defaultCategory;
    }

    return result.category;
  } catch (error) {
    console.error("AI Classifier error:", error);
    if (context.isTestMode) {
      return chooseTestModeCategory(data, context);
    }
    return defaultCategory;
  }
}
