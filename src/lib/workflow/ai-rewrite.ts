import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAiProviderSettingsFromValues } from "@/lib/workflow/ai-provider";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import type { ActionAiRewriteData, EmailContentField, ExecutionContext } from "@/lib/workflow/types";

const AiRewriteResultSchema = z.object({
  subject: z.string().nullable(),
  textBody: z.string().nullable(),
  htmlBody: z.string().nullable(),
  variables: z.record(z.string(), z.string().nullable()).nullable(),
  reasoning: z.string().nullable(),
});

export interface AiRewriteResult {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  variables?: Record<string, string | null> | null;
  reasoning?: string;
}

export interface AiRewriteConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  defaultPrompt: string;
}

export const DEFAULT_AI_REWRITE_PROMPT = `You are an email rewriting and extraction assistant.

Return a JSON object with this schema:
{
  "subject": string | null,
  "textBody": string | null,
  "htmlBody": string | null,
  "variables": object | null,
  "reasoning": string | null
}

Rules:
- If you don't want to change a field, return null for that field.
- If extracting data, put it into "variables" as a flat object of string values.
- The workflow node write target is: {{writeTarget}}
- Allowed email fields for rewriting (JSON array): {{allowedEmailFieldsJson}}
- If writeTarget is "variables", you MUST set subject/textBody/htmlBody to null.
- If writeTarget is "email", you MUST set variables to null.
- You MUST NOT invent variable keys. Only use keys explicitly requested by the user.
- Allowed variable keys (JSON array): {{requestedVariableKeysJson}}
- If the allowed key list is empty, set "variables" to null.
- Do not output additional keys under "variables" (no synonyms, no extra keys).
- Variable values must be plain strings (do not JSON-encode objects).
- Do not return additional keys.

Email Subject:
{{email.subject}}

Email Text Body:
{{email.textBody}}

Email HTML Body:
{{email.htmlBody}}

Existing Variables (JSON):
{{variablesJson}}

Instruction:
{{instruction}}`;

export async function getAiRewriteConfig(options?: { allowDisabled?: boolean }): Promise<AiRewriteConfig | null> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "ai_provider_base_url",
            "ai_provider_api_key",
            "ai_provider_models",
            "ai_rewrite_enabled",
            "ai_rewrite_model",
            "ai_rewrite_default_prompt",
            // Legacy (kept for backward compatibility)
            "ai_rewrite_base_url",
            "ai_rewrite_api_key",
          ],
        },
      },
    });

    const values = new Map(settings.map((s) => [s.key, s.value]));
    const provider = getAiProviderSettingsFromValues(values);

    const enabled = values.get("ai_rewrite_enabled") === "true";
    if (!enabled && !options?.allowDisabled) return null;

    const legacyBaseUrl = (values.get("ai_rewrite_base_url") || "").trim();
    const legacyApiKey = (values.get("ai_rewrite_api_key") || "").trim();
    const baseUrl = provider.baseUrl || legacyBaseUrl || "https://api.openai.com/v1";
    const apiKey = provider.apiKey || legacyApiKey || "";
    const selectedModel = (values.get("ai_rewrite_model") || "").trim();
    const model = selectedModel || provider.models[0] || "gpt-4o-mini";

    return {
      enabled,
      baseUrl,
      model,
      apiKey,
      defaultPrompt: values.get("ai_rewrite_default_prompt") || DEFAULT_AI_REWRITE_PROMPT,
    };
  } catch (error) {
    console.error("AI Rewrite: failed to load config:", error);
    return null;
  }
}

function truncateText(text: string | undefined, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function getFieldsForPrompt(data: ActionAiRewriteData): EmailContentField[] {
  if (Array.isArray(data.fields) && data.fields.length > 0) {
    return data.fields;
  }
  return ["subject", "textBody"];
}

function getAllowedEmailFields(data: ActionAiRewriteData): EmailContentField[] {
  return getFieldsForPrompt(data);
}

function extractRequestedVariableKeys(instruction: string): string[] {
  const keys = new Set<string>();
  const text = instruction || "";

  const dot = /variables\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  for (const match of text.matchAll(dot)) {
    if (match[1]) keys.add(match[1]);
  }

  const bracket = /variables\[['"]([^'"]+)['"]\]/g;
  for (const match of text.matchAll(bracket)) {
    const candidate = (match[1] || "").trim();
    if (candidate) keys.add(candidate);
  }

  const mustache = /\{\{\s*variables\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  for (const match of text.matchAll(mustache)) {
    if (match[1]) keys.add(match[1]);
  }

  return Array.from(keys);
}

export function getAiRewriteRequestedVariableKeys(data: ActionAiRewriteData): string[] {
  const explicit = Array.isArray(data.outputVariableKeys)
    ? data.outputVariableKeys
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter((k) => k.length > 0)
    : [];

  if (explicit.length > 0) {
    return Array.from(new Set(explicit));
  }

  const instruction = (data.prompt || "").trim();
  return extractRequestedVariableKeys(instruction);
}

function buildPrompt(data: ActionAiRewriteData, context: ExecutionContext, config: AiRewriteConfig): string {
  const email = context.email
    ? {
        ...context.email,
        subject: getFieldsForPrompt(data).includes("subject") ? (context.email.subject || "") : "",
        textBody: getFieldsForPrompt(data).includes("textBody") ? truncateText(context.email.textBody, 2000) : "",
        htmlBody: getFieldsForPrompt(data).includes("htmlBody") ? truncateText(context.email.htmlBody, 2000) : "",
      }
    : undefined;

  const variablesJson = JSON.stringify(context.variables || {}, null, 2);
  const instruction = (data.prompt || "").trim();
  const writeTarget = data.writeTarget;
  const allowedEmailFieldsJson = JSON.stringify(getAllowedEmailFields(data));
  const requestedVariableKeysJson = JSON.stringify(getAiRewriteRequestedVariableKeys(data));

  return replaceTemplateVariables(config.defaultPrompt, {
    email,
    variables: context.variables,
    variablesJson,
    instruction,
    writeTarget,
    allowedEmailFieldsJson,
    requestedVariableKeysJson,
  });
}

function buildMessages(prompt: string) {
  return [
    { role: "system" as const, content: prompt },
    { role: "user" as const, content: "Rewrite and/or extract from this email." },
  ];
}

function normalizeResult(raw: z.infer<typeof AiRewriteResultSchema>): AiRewriteResult {
  const result: AiRewriteResult = {};

  if (typeof raw.subject === "string" && raw.subject.trim()) result.subject = raw.subject;
  if (typeof raw.textBody === "string" && raw.textBody.trim()) result.textBody = raw.textBody;
  if (typeof raw.htmlBody === "string" && raw.htmlBody.trim()) result.htmlBody = raw.htmlBody;
  if (raw.variables && Object.keys(raw.variables).length > 0) result.variables = raw.variables;
  if (typeof raw.reasoning === "string" && raw.reasoning.trim()) result.reasoning = raw.reasoning;

  return result;
}

async function callOpenAiStructured(
  data: ActionAiRewriteData,
  context: ExecutionContext,
  config: AiRewriteConfig
): Promise<AiRewriteResult> {
  const requestedVariableKeys = getAiRewriteRequestedVariableKeys(data);
  const allowsVariables = data.writeTarget === "variables" || data.writeTarget === "both";
  const allowsEmail = data.writeTarget === "email" || data.writeTarget === "both";
  const allowedEmailFields = getAllowedEmailFields(data);
  const variableProperties = allowsVariables
    ? Object.fromEntries(requestedVariableKeys.map((key) => [key, { type: ["string", "null"] }]))
    : {};

  const subjectSchema = allowsEmail && allowedEmailFields.includes("subject") ? { type: ["string", "null"] } : { type: "null" };
  const textBodySchema = allowsEmail && allowedEmailFields.includes("textBody") ? { type: ["string", "null"] } : { type: "null" };
  const htmlBodySchema = allowsEmail && allowedEmailFields.includes("htmlBody") ? { type: ["string", "null"] } : { type: "null" };

  const jsonSchema = {
    type: "object",
    properties: {
      subject: subjectSchema,
      textBody: textBodySchema,
      htmlBody: htmlBodySchema,
      variables: {
        ...(allowsVariables && requestedVariableKeys.length > 0
          ? {
              type: ["object", "null"],
              properties: variableProperties,
              required: requestedVariableKeys,
              additionalProperties: false,
            }
          : { type: "null" }),
      },
      reasoning: { type: ["string", "null"] },
    },
    // Some OpenAI-compatible providers require every property to be listed here.
    required: ["subject", "textBody", "htmlBody", "variables", "reasoning"],
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
      messages: buildMessages(buildPrompt(data, context, config)),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "email_rewrite",
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
    throw new Error(`AI Rewrite: upstream error ${res.status} ${text}`);
  }

  const json: unknown = await res.json();
  const content = (json as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI Rewrite: empty response content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`AI Rewrite: invalid JSON content (${String(error)})`);
  }

  const validated = AiRewriteResultSchema.parse(parsed);
  return normalizeResult(validated);
}

function chooseTestModeResult(data: ActionAiRewriteData, context: ExecutionContext): AiRewriteResult {
  const email = context.email;
  const result: AiRewriteResult = { reasoning: "test mode" };
  const allowedEmailFields = getAllowedEmailFields(data);

  if ((data.writeTarget === "email" || data.writeTarget === "both") && email) {
    if (allowedEmailFields.includes("subject")) {
      result.subject = email.subject ? `[AI] ${email.subject}` : "[AI] Rewritten subject";
    }
    if (allowedEmailFields.includes("textBody")) {
      result.textBody = `AI rewrite (test mode)\n\n${email.textBody || ""}`.trim();
    }
    if (allowedEmailFields.includes("htmlBody")) {
      result.htmlBody = `<p><strong>AI rewrite (test mode)</strong></p>\n${email.htmlBody || ""}`.trim();
    }
  }

  if (data.writeTarget === "variables" || data.writeTarget === "both") {
    const keys = getAiRewriteRequestedVariableKeys(data);
    if (keys.length > 0) {
      result.variables = Object.fromEntries(keys.map((key) => [key, `TEST:${key}`]));
    } else {
      result.variables = null;
    }
  }

  return result;
}

export async function evaluateAiRewrite(
  data: ActionAiRewriteData,
  context: ExecutionContext
): Promise<AiRewriteResult> {
  if (!context.email) return {};

  const config = await getAiRewriteConfig({ allowDisabled: Boolean(context.isTestMode) });
  if (!config || !config.apiKey) {
    if (context.isTestMode) {
      return chooseTestModeResult(data, context);
    }
    if (!config) return {};
    console.warn("AI Rewrite: missing API key, skipping");
    return {};
  }

  try {
    return await callOpenAiStructured(data, context, config);
  } catch (error) {
    console.error("AI Rewrite error:", error);
    if (context.isTestMode) {
      return chooseTestModeResult(data, context);
    }
    return {};
  }
}
