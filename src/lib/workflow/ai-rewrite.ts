import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import type { ActionAiRewriteData, EmailContentField, ExecutionContext } from "@/lib/workflow/types";

const AiRewriteResultSchema = z.object({
  subject: z.string().nullable(),
  textBody: z.string().nullable(),
  htmlBody: z.string().nullable(),
  variables: z.record(z.string(), z.string()).nullable(),
  reasoning: z.string().nullable(),
});

export interface AiRewriteResult {
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  variables?: Record<string, string>;
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
            "ai_rewrite_enabled",
            "ai_rewrite_base_url",
            "ai_rewrite_model",
            "ai_rewrite_api_key",
            "ai_rewrite_default_prompt",
          ],
        },
      },
    });

    const values = new Map(settings.map((s) => [s.key, s.value]));

    const enabled = values.get("ai_rewrite_enabled") === "true";
    if (!enabled && !options?.allowDisabled) return null;

    return {
      enabled,
      baseUrl: values.get("ai_rewrite_base_url") || "https://api.openai.com/v1",
      model: values.get("ai_rewrite_model") || "gpt-4o-mini",
      apiKey: values.get("ai_rewrite_api_key") || "",
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

  return replaceTemplateVariables(config.defaultPrompt, {
    email,
    variables: context.variables,
    variablesJson,
    instruction,
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
  const jsonSchema = {
    type: "object",
    properties: {
      subject: { type: ["string", "null"] },
      textBody: { type: ["string", "null"] },
      htmlBody: { type: ["string", "null"] },
      variables: {
        type: ["object", "null"],
        additionalProperties: { type: "string" },
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

  if ((data.writeTarget === "email" || data.writeTarget === "both") && email) {
    result.subject = email.subject ? `[AI] ${email.subject}` : "[AI] Rewritten subject";
    if (getFieldsForPrompt(data).includes("textBody")) {
      result.textBody = `AI rewrite (test mode)\n\n${email.textBody || ""}`.trim();
    }
    if (getFieldsForPrompt(data).includes("htmlBody")) {
      result.htmlBody = `<p><strong>AI rewrite (test mode)</strong></p>\n${email.htmlBody || ""}`.trim();
    }
  }

  if (data.writeTarget === "variables" || data.writeTarget === "both") {
    result.variables = {
      ai_summary: `TEST: ${email?.subject || ""}`.trim(),
    };
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
