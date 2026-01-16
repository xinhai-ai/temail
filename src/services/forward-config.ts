import { z } from "zod";

export const forwardTypeSchema = z.enum(["EMAIL", "TELEGRAM", "DISCORD", "SLACK", "WEBHOOK"]);
export type ForwardType = z.infer<typeof forwardTypeSchema>;

const recordStringSchema = z.record(z.string(), z.string()).default({});

const legacyEmailDestinationSchema = z
  .object({
    to: z.string().trim().min(1, "Email recipient is required"),
  })
  .strict();

const legacyTelegramDestinationSchema = z
  .object({
    token: z.string().trim().min(1, "Telegram token is required"),
    chatId: z.string().trim().min(1, "Telegram chatId is required"),
  })
  .strict();

const legacyWebhookDestinationSchema = z
  .object({
    url: z.string().trim().url("Webhook URL is invalid"),
    headers: recordStringSchema,
  })
  .strict();

const forwardDestinationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("EMAIL"),
      to: z.string().trim().min(1, "Email recipient is required"),
    })
    .strict(),
  z
    .object({
      type: z.literal("TELEGRAM"),
      token: z.string().trim().min(1, "Telegram token is required"),
      chatId: z.string().trim().min(1, "Telegram chatId is required"),
    })
    .strict(),
  z
    .object({
      type: z.literal("DISCORD"),
      url: z.string().trim().url("Discord webhook URL is invalid"),
      headers: recordStringSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("SLACK"),
      url: z.string().trim().url("Slack webhook URL is invalid"),
      headers: recordStringSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("WEBHOOK"),
      url: z.string().trim().url("Webhook URL is invalid"),
      headers: recordStringSchema,
    })
    .strict(),
]);

export type ForwardDestination = z.infer<typeof forwardDestinationSchema>;

const forwardMatchOperatorSchema = z.enum(["contains", "equals", "startsWith", "endsWith", "regex"]);
export type ForwardMatchOperator = z.infer<typeof forwardMatchOperatorSchema>;

const forwardMatchFieldSchema = z.enum(["subject", "fromAddress", "toAddress", "textBody"]);
export type ForwardMatchField = z.infer<typeof forwardMatchFieldSchema>;

export type ForwardCondition =
  | { kind: "and"; conditions: ForwardCondition[] }
  | { kind: "or"; conditions: ForwardCondition[] }
  | { kind: "not"; condition: ForwardCondition }
  | {
      kind: "match";
      field: ForwardMatchField;
      operator: ForwardMatchOperator;
      value: string;
      caseSensitive?: boolean;
    };

const forwardConditionSchema: z.ZodType<ForwardCondition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("and"),
        conditions: z.array(forwardConditionSchema).default([]),
      })
      .strict(),
    z
      .object({
        kind: z.literal("or"),
        conditions: z.array(forwardConditionSchema).default([]),
      })
      .strict(),
    z
      .object({
        kind: z.literal("not"),
        condition: forwardConditionSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("match"),
        field: forwardMatchFieldSchema,
        operator: forwardMatchOperatorSchema,
        value: z.string().max(2000, "Match value is too long"),
        caseSensitive: z.boolean().optional(),
      })
      .strict(),
  ])
);

const forwardTemplateSchema = z
  .object({
    subject: z.string().max(500).optional(),
    text: z.string().max(50_000).optional(),
    html: z.string().max(100_000).optional(),
    webhookBody: z.string().max(100_000).optional(),
    contentType: z.string().max(200).optional(),
  })
  .strict();

export type ForwardTemplate = z.infer<typeof forwardTemplateSchema>;

export const forwardRuleConfigV2Schema = z
  .object({
    version: z.literal(2),
    destination: forwardDestinationSchema,
    conditions: forwardConditionSchema.optional(),
    template: forwardTemplateSchema.optional(),
  })
  .strict();

export type ForwardRuleConfigV2 = z.infer<typeof forwardRuleConfigV2Schema>;

export const forwardRuleConfigV3Schema = z
  .object({
    version: z.literal(3),
    conditions: forwardConditionSchema.optional(),
    template: forwardTemplateSchema.optional(),
  })
  .strict();

export type ForwardRuleConfigV3 = z.infer<typeof forwardRuleConfigV3Schema>;

function parseConfigJson(rawConfig: string) {
  try {
    return { ok: true as const, value: JSON.parse(rawConfig) };
  } catch {
    return { ok: false as const, error: "Forward config must be valid JSON" };
  }
}

export function parseForwardRuleConfig(rawConfig: string): { ok: true; config: ForwardRuleConfigV2 | ForwardRuleConfigV3 } | { ok: false; error: string } {
  const json = parseConfigJson(rawConfig);
  if (!json.ok) return json;

  const candidate = json.value;
  if (!candidate || typeof candidate !== "object" || !("version" in candidate)) {
    return { ok: false, error: "Forward config must include a version" };
  }

  const version = (candidate as { version?: unknown }).version;
  if (version === 2) {
    const parsed = forwardRuleConfigV2Schema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid forward config" };
    }
    return { ok: true, config: parsed.data };
  }
  if (version === 3) {
    const parsed = forwardRuleConfigV3Schema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid forward config" };
    }
    return { ok: true, config: parsed.data };
  }

  return { ok: false, error: "Unsupported forward config version" };
}

export function normalizeForwardTargetConfig(
  type: ForwardType,
  rawConfig: string
): { ok: true; destination: ForwardDestination } | { ok: false; error: string } {
  const json = parseConfigJson(rawConfig);
  if (!json.ok) return json;

  const parsed = forwardDestinationSchema.safeParse(json.value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Invalid forward target config" };
  }
  if (parsed.data.type !== type) {
    return { ok: false, error: "Forward target type does not match rule target type" };
  }
  return { ok: true, destination: parsed.data };
}

function wrapLegacyDestination(type: ForwardType, value: unknown): ForwardRuleConfigV2 {
  switch (type) {
    case "EMAIL": {
      const parsed = legacyEmailDestinationSchema.parse(value);
      return { version: 2, destination: { type: "EMAIL", to: parsed.to } };
    }
    case "TELEGRAM": {
      const parsed = legacyTelegramDestinationSchema.parse(value);
      return {
        version: 2,
        destination: { type: "TELEGRAM", token: parsed.token, chatId: parsed.chatId },
      };
    }
    case "DISCORD":
    case "SLACK":
    case "WEBHOOK": {
      const parsed = legacyWebhookDestinationSchema.parse(value);
      return {
        version: 2,
        destination: { type, url: parsed.url, headers: parsed.headers },
      };
    }
  }
}

export function normalizeForwardRuleConfig(type: ForwardType, rawConfig: string): {
  ok: true;
  config: ForwardRuleConfigV2;
} | { ok: false; error: string } {
  const json = parseConfigJson(rawConfig);
  if (!json.ok) return json;

  const candidate = json.value;
  if (candidate && typeof candidate === "object" && "version" in candidate) {
    const parsed = forwardRuleConfigV2Schema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid forward config" };
    }
    if (parsed.data.destination.type !== type) {
      return { ok: false, error: "Forward destination type does not match rule type" };
    }
    return { ok: true, config: parsed.data };
  }

  try {
    const normalized = wrapLegacyDestination(type, candidate);
    return { ok: true, config: normalized };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { ok: false, error: error.issues[0]?.message || "Invalid forward config" };
    }
    return { ok: false, error: "Invalid forward config" };
  }
}

export function stringifyForwardRuleConfig(config: ForwardRuleConfigV2) {
  return JSON.stringify(config);
}
