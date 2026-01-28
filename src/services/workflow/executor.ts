import { prisma } from "@/lib/prisma";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { isVercelDeployment } from "@/lib/deployment/server";
import type {
  WorkflowNode,
  ExecutionContext,
  MatchCondition,
  CompositeCondition,
  MatchField,
  MatchOperator,
  ConditionKeywordData,
  ConditionAiClassifierData,
  KeywordSet,
  EmailContentField,
  ActionSetTagsData,
  ActionAiRewriteData,
  ForwardTelegramBoundData,
  ForwardTelegramData,
} from "@/lib/workflow/types";
import { replaceTemplateVariables } from "@/lib/workflow/utils";
import { evaluateAiClassifier } from "@/lib/workflow/ai-classifier";
import { evaluateAiRewrite, getAiRewriteRequestedVariableKeys } from "@/lib/workflow/ai-rewrite";
import { getRestoreStatusForTrash } from "@/services/email-trash";
import { getTelegramBotToken, getTelegramForumGeneralTopicName, telegramCreateForumTopic } from "@/services/telegram/bot-api";
import { getSystemSettingValue } from "@/services/system-settings";
import { sendSmtpMail } from "@/services/smtp/mailer";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function sanitizeOutboundHeaders(headers: Record<string, string> | undefined) {
  const sanitized: Record<string, string> = {};
  if (!headers) return sanitized;
  for (const [name, value] of Object.entries(headers)) {
    const trimmedName = name.trim();
    if (!trimmedName) continue;
    if (HOP_BY_HOP_HEADERS.has(trimmedName.toLowerCase())) continue;
    sanitized[trimmedName] = String(value);
  }
  return sanitized;
}

function normalizeWebhookMethod(method: string | undefined): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" {
  const candidate = (method || "").trim().toUpperCase();
  if (candidate === "GET" || candidate === "POST" || candidate === "PUT" || candidate === "PATCH" || candidate === "DELETE") {
    return candidate;
  }
  return "POST";
}

export async function executeNode(
  node: WorkflowNode,
  context: ExecutionContext
): Promise<unknown> {
  const { type, data } = node;

  switch (type) {
    // Triggers (no-op in execution, just pass through)
    case "trigger:email":
    case "trigger:schedule":
    case "trigger:manual":
      return true;

    // Conditions
    case "condition:match":
      return evaluateMatch(
        data as { field: MatchField; operator: MatchOperator; value: string; caseSensitive?: boolean },
        context
      );

    case "condition:keyword":
      return evaluateKeywordCondition(data as ConditionKeywordData, context);

    case "condition:ai-classifier":
    case "condition:classifier":
      return evaluateAiClassifier(data as ConditionAiClassifierData, context);

    case "control:branch":
      return evaluateMatch(
        (data as { condition: MatchCondition }).condition,
        context
      );

    // Actions
    case "action:archive":
      return executeArchive(context);

    case "action:markRead":
      return executeMarkRead(context);

    case "action:markUnread":
      return executeMarkUnread(context);

    case "action:star":
      return executeStar(context);

    case "action:unstar":
      return executeUnstar(context);

    case "action:delete":
      return executeDelete(context);

    case "action:setVariable":
      return executeSetVariable(data as { name: string; value: string }, context);

    case "action:unsetVariable":
      return executeUnsetVariable(data as { name: string }, context);

    case "action:cloneVariable":
      return executeCloneVariable(data as { source: string; target: string }, context);

    case "action:rewriteEmail":
      return executeRewriteEmail(data as { subject?: string; textBody?: string; htmlBody?: string }, context);

    case "action:regexReplace":
      return executeRegexReplace(
        data as { field: EmailContentField; pattern: string; replacement: string; flags?: string },
        context
      );

    case "action:setTags":
      return executeSetTags(data as ActionSetTagsData, context);

    case "action:aiRewrite":
      return executeAiRewrite(data as ActionAiRewriteData, context);

    // Forwards
    case "forward:email":
      return executeForwardEmail(
        data as { to: string; template?: { subject?: string; body?: string; html?: string } },
        context
      );

    case "forward:telegram":
      return executeForwardTelegram(data as ForwardTelegramData, context);

    case "forward:telegram-bound":
      return executeForwardTelegramBound(data as ForwardTelegramBoundData, context);

    case "forward:discord":
      return executeForwardDiscord(
        data as { webhookUrl: string; template?: string; useEmbed?: boolean },
        context
      );

    case "forward:slack":
      return executeForwardSlack(
        data as { webhookUrl: string; template?: string; useBlocks?: boolean },
        context
      );

    case "forward:webhook":
      return executeForwardWebhook(
        data as { url: string; method: string; headers?: Record<string, string>; bodyTemplate?: string; contentType?: string },
        context
      );

    // Control flow
    case "control:delay":
      return executeDelay(data as { duration: number });

    case "control:end":
      return true;

    default:
      throw new Error(`Unknown node type: ${type}`);
  }
}

// ==================== Condition Evaluators ====================

function getFieldValue(field: MatchField, context: ExecutionContext): string {
  if (!context.email) return "";

  switch (field) {
    case "subject":
      return context.email.subject || "";
    case "fromAddress":
      return context.email.fromAddress || "";
    case "fromName":
      return context.email.fromName || "";
    case "toAddress":
      return context.email.toAddress || "";
    case "textBody":
      return context.email.textBody || "";
    case "htmlBody":
      return context.email.htmlBody || "";
    case "messageId":
      return context.email.messageId || "";
    case "replyTo":
      return (context.email as { replyTo?: string }).replyTo || "";
    default:
      return "";
  }
}

function evaluateMatch(
  condition: { field: MatchField; operator: MatchOperator; value: string; caseSensitive?: boolean },
  context: ExecutionContext
): boolean {
  if (!context.email) return false;

  const { field, operator, caseSensitive } = condition;
  let { value } = condition;
  let fieldValue = getFieldValue(field, context);

  // Apply case sensitivity
  if (!caseSensitive) {
    fieldValue = fieldValue.toLowerCase();
    value = (value || "").toLowerCase();
  }

  switch (operator) {
    case "contains":
      return fieldValue.includes(value);
    case "notContains":
      return !fieldValue.includes(value);
    case "equals":
      return fieldValue === value;
    case "notEquals":
      return fieldValue !== value;
    case "startsWith":
      return fieldValue.startsWith(value);
    case "endsWith":
      return fieldValue.endsWith(value);
    case "regex":
      try {
        const regex = new RegExp(value, caseSensitive ? "" : "i");
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    case "isEmpty":
      return fieldValue.trim() === "";
    case "isNotEmpty":
      return fieldValue.trim() !== "";
    default:
      return false;
  }
}

// 评估复合条件
function evaluateCompositeCondition(
  condition: CompositeCondition,
  context: ExecutionContext
): boolean {
  switch (condition.kind) {
    case "and":
      return condition.conditions.every((c) => evaluateCompositeCondition(c, context));
    case "or":
      return condition.conditions.some((c) => evaluateCompositeCondition(c, context));
    case "not":
      return !evaluateCompositeCondition(condition.condition, context);
    case "match":
      return evaluateMatch(condition, context);
    default:
      return false;
  }
}

// 评估关键字条件 - 支持简单模式和高级复合条件
function evaluateKeywordCondition(
  data: ConditionKeywordData,
  context: ExecutionContext
): string | boolean {
  if (!context.email) return false;

  // Multi-classification mode
  const hasMultiMode =
    Array.isArray(data.categories) ||
    Array.isArray(data.keywordSets) ||
    typeof data.defaultCategory === "string";
  if (hasMultiMode) {
    return evaluateMultiKeywordClassification(data, context);
  }

  // 高级模式 - 使用复合条件
  if (data.conditions) {
    return evaluateCompositeCondition(data.conditions, context);
  }

  // 简单模式 - 关键字匹配
  return evaluateSimpleKeywordMatch(data, context);
}

function evaluateMultiKeywordClassification(
  data: ConditionKeywordData,
  context: ExecutionContext
): string {
  const defaultCategory = data.defaultCategory || "default";
  const keywordSets = (data.keywordSets || []) as KeywordSet[];

  for (const set of keywordSets) {
    if (!set.keywords?.length) continue;

    const fields = set.fields || data.fields || ["subject", "textBody"];
    const rawContent = fields.map((f) => getFieldValue(f, context)).join(" ");

    const caseSensitive = set.caseSensitive ?? data.caseSensitive ?? false;
    const content = caseSensitive ? rawContent : rawContent.toLowerCase();
    const keywords = caseSensitive ? set.keywords : set.keywords.map((k) => k.toLowerCase());

    const matchType = set.matchType || data.matchType || "any";
    const matched =
      matchType === "all"
        ? keywords.every((kw) => content.includes(kw))
        : keywords.some((kw) => content.includes(kw));

    if (matched) return set.category;
  }

  return defaultCategory;
}

function evaluateSimpleKeywordMatch(
  data: ConditionKeywordData,
  context: ExecutionContext
): boolean {
  const {
    keywords = [],
    matchType = "any",
    fields = ["subject", "textBody"],
    caseSensitive = false,
  } = data;

  // Backward-compatibility: empty keyword list means "match"
  if (keywords.length === 0) return true;

  const searchTexts = fields.map((field) => getFieldValue(field, context));
  const combinedText = caseSensitive
    ? searchTexts.join(" ")
    : searchTexts.join(" ").toLowerCase();
  const processedKeywords = caseSensitive ? keywords : keywords.map((kw) => kw.toLowerCase());

  if (matchType === "all") {
    return processedKeywords.every((kw) => combinedText.includes(kw));
  }
  return processedKeywords.some((kw) => combinedText.includes(kw));
}

// ==================== Action Executors ====================

async function executeArchive(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "ARCHIVED" },
  });

  return true;
}

async function executeMarkRead(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "READ" },
  });

  return true;
}

async function executeMarkUnread(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "UNREAD" },
  });

  return true;
}

async function executeStar(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  await prisma.email.update({
    where: { id: context.email.id },
    data: { isStarred: true },
  });

  return true;
}

async function executeUnstar(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  await prisma.email.update({
    where: { id: context.email.id },
    data: { isStarred: false },
  });

  return true;
}

async function executeDelete(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  // 测试模式下跳过数据库操作
  if (context.isTestMode) {
    return true;
  }

  const email = await prisma.email.findUnique({
    where: { id: context.email.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!email) return false;

  if (email.status !== "DELETED") {
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: "DELETED",
        deletedAt: email.deletedAt ?? new Date(),
        restoreStatus: getRestoreStatusForTrash(email.status),
      },
    });
  }

  return true;
}

function executeSetVariable(
  data: { name: string; value: string },
  context: ExecutionContext
): boolean {
  // 支持模板变量替换
  const processedValue = replaceTemplateVariables(data.value, {
    email: context.email,
    variables: context.variables,
  });
  context.variables[data.name] = processedValue;
  return true;
}

function truncateForLog(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function cloneValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const globalClone = (globalThis as unknown as { structuredClone?: (v: unknown) => unknown }).structuredClone;
  if (typeof globalClone === "function") {
    try {
      return globalClone(value);
    } catch {
      // Fall through to other strategies
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.parse(JSON.stringify(value)) as unknown;
    } catch {
      return value;
    }
  }

  return value;
}

function executeUnsetVariable(
  data: { name: string },
  context: ExecutionContext
): { removed: boolean; name: string } {
  const name = (data.name || "").trim();
  if (!name) return { removed: false, name: "" };
  const removed = Object.prototype.hasOwnProperty.call(context.variables, name);
  delete context.variables[name];
  return { removed, name };
}

function executeCloneVariable(
  data: { source: string; target: string },
  context: ExecutionContext
): { cloned: boolean; source: string; target: string } {
  const source = (data.source || "").trim();
  const target = (data.target || "").trim();
  if (!source || !target) return { cloned: false, source, target };

  const value = context.variables[source];
  context.variables[target] = cloneValue(value);
  return { cloned: true, source, target };
}

function executeRewriteEmail(
  data: { subject?: string; textBody?: string; htmlBody?: string },
  context: ExecutionContext
): { updatedFields: EmailContentField[]; changes: Record<string, { before: string; after: string }> } {
  if (!context.email) return { updatedFields: [], changes: {} };

  const templateCtx = buildTemplateContext(context);
  const updatedFields: EmailContentField[] = [];
  const changes: Record<string, { before: string; after: string }> = {};

  const nextEmail = { ...context.email };

  const subjectTemplate = typeof data.subject === "string" ? data.subject : undefined;
  if (subjectTemplate?.trim()) {
    const before = context.email.subject || "";
    const after = replaceTemplateVariables(subjectTemplate, templateCtx);
    nextEmail.subject = after;
    updatedFields.push("subject");
    changes.subject = { before: truncateForLog(before, 80), after: truncateForLog(after, 80) };
  }

  const textTemplate = typeof data.textBody === "string" ? data.textBody : undefined;
  if (textTemplate?.trim()) {
    const before = context.email.textBody || "";
    const after = replaceTemplateVariables(textTemplate, templateCtx);
    nextEmail.textBody = after;
    updatedFields.push("textBody");
    changes.textBody = { before: truncateForLog(before, 80), after: truncateForLog(after, 80) };
  }

  const htmlTemplate = typeof data.htmlBody === "string" ? data.htmlBody : undefined;
  if (htmlTemplate?.trim()) {
    const before = context.email.htmlBody || "";
    const after = replaceTemplateVariables(htmlTemplate, templateCtx);
    nextEmail.htmlBody = after;
    updatedFields.push("htmlBody");
    changes.htmlBody = { before: truncateForLog(before, 80), after: truncateForLog(after, 80) };
  }

  context.email = nextEmail;
  return { updatedFields, changes };
}

function normalizeRegexFlags(flags: string | undefined): string {
  const trimmed = (flags || "").trim();
  return trimmed ? trimmed : "g";
}

function executeRegexReplace(
  data: { field: EmailContentField; pattern: string; replacement: string; flags?: string },
  context: ExecutionContext
): { changed: boolean; field: EmailContentField; before?: string; after?: string } {
  if (!context.email) return { changed: false, field: data.field };

  const templateCtx = buildTemplateContext(context);
  const pattern = replaceTemplateVariables(data.pattern || "", templateCtx);
  const replacement = replaceTemplateVariables(data.replacement || "", templateCtx);

  if (!pattern) return { changed: false, field: data.field };

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, normalizeRegexFlags(data.flags));
  } catch (error) {
    console.error("Regex Replace: invalid regex:", error);
    return { changed: false, field: data.field };
  }

  const before = context.email[data.field] || "";
  const after = before.replace(regex, replacement);
  context.email = { ...context.email, [data.field]: after };

  const changed = before !== after;
  return {
    changed,
    field: data.field,
    before: changed ? truncateForLog(before, 80) : undefined,
    after: changed ? truncateForLog(after, 80) : undefined,
  };
}

async function executeSetTags(
  data: ActionSetTagsData,
  context: ExecutionContext
): Promise<{ mode: string; tags: string[]; emailId?: string; updatedTagCount?: number }> {
  const emailId = context.email?.id;
  if (!emailId) return { mode: data.mode, tags: [] };

  const templateCtx = buildTemplateContext(context);
  const rawTags = Array.isArray(data.tags) ? data.tags : [];
  const tags = Array.from(
    new Set(
      rawTags
        .map((t) => replaceTemplateVariables(String(t || ""), templateCtx).trim())
        .filter(Boolean)
    )
  );
  const mode = (data.mode || "add") as string;

  if (context.isTestMode) {
    return { mode, tags, emailId, updatedTagCount: tags.length };
  }

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: { mailbox: { select: { userId: true } } },
  });
  const userId = email?.mailbox?.userId;
  if (!userId) {
    return { mode, tags, emailId };
  }

  const updatedTagCount = await prisma.$transaction(async (tx) => {
    if (mode === "remove") {
      const existing = await tx.tag.findMany({
        where: { userId, name: { in: tags } },
        select: { id: true },
      });
      const tagIds = existing.map((t) => t.id);
      if (tagIds.length > 0) {
        const deleted = await tx.emailTag.deleteMany({
          where: { emailId, tagId: { in: tagIds } },
        });
        return deleted.count;
      }
      return 0;
    }

    if (mode === "set" && tags.length === 0) {
      await tx.emailTag.deleteMany({ where: { emailId } });
      return 0;
    }

    const ensured = await Promise.all(
      tags.map((name) =>
        tx.tag.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name },
          update: {},
          select: { id: true },
        })
      )
    );
    const ensuredIds = Array.from(new Set(ensured.map((t) => t.id)));

    if (mode === "set") {
      await tx.emailTag.deleteMany({ where: { emailId } });
    }

    if (ensuredIds.length > 0) {
      if (mode === "set") {
        const created = await tx.emailTag.createMany({
          data: ensuredIds.map((tagId) => ({ emailId, tagId })),
        });
        return created.count;
      }

      const existing = await tx.emailTag.findMany({
        where: { emailId, tagId: { in: ensuredIds } },
        select: { tagId: true },
      });
      const existingIds = new Set(existing.map((row) => row.tagId));
      const toCreate = ensuredIds.filter((tagId) => !existingIds.has(tagId));
      if (toCreate.length > 0) {
        const created = await tx.emailTag.createMany({
          data: toCreate.map((tagId) => ({ emailId, tagId })),
        });
        return created.count;
      }
      return 0;
    }

    return 0;
  });

  return { mode, tags, emailId, updatedTagCount };
}

async function executeAiRewrite(
  data: ActionAiRewriteData,
  context: ExecutionContext
): Promise<{ appliedEmailFields: EmailContentField[]; variablesWritten: number; resultVariable?: string }> {
  const resultVariable = (data.resultVariable || "").trim() || undefined;
  const requestedVariableKeys = getAiRewriteRequestedVariableKeys(data);

  if (!context.email) {
    return { appliedEmailFields: [], variablesWritten: 0, resultVariable };
  }

  const result = await evaluateAiRewrite(data, context);

  const appliedEmailFields: EmailContentField[] = [];
  let variablesWritten = 0;

  const wantsEmail = data.writeTarget === "email" || data.writeTarget === "both";
  const wantsVariables = data.writeTarget === "variables" || data.writeTarget === "both";

  if (wantsEmail) {
    const nextEmail = { ...context.email };

    if (typeof result.subject === "string" && result.subject.trim()) {
      nextEmail.subject = result.subject;
      appliedEmailFields.push("subject");
    }
    if (typeof result.textBody === "string" && result.textBody.trim()) {
      nextEmail.textBody = result.textBody;
      appliedEmailFields.push("textBody");
    }
    if (typeof result.htmlBody === "string" && result.htmlBody.trim()) {
      nextEmail.htmlBody = result.htmlBody;
      appliedEmailFields.push("htmlBody");
    }

    context.email = nextEmail;
  }

  if (wantsVariables && result.variables) {
    for (const [key, value] of Object.entries(result.variables)) {
      const name = key.trim();
      if (!name) continue;
      context.variables[name] = value;
      variablesWritten += 1;
    }
  }

  if (resultVariable) {
    const reserved = new Set<string>(requestedVariableKeys);
    for (const key of Object.keys(result.variables || {})) reserved.add(key);

    if (!reserved.has(resultVariable)) {
      context.variables[resultVariable] = JSON.stringify(result);
    }
  }

  return { appliedEmailFields, variablesWritten, resultVariable };
}

// ==================== Forward Executors ====================

function buildTemplateContext(context: ExecutionContext) {
  return {
    email: context.email,
    variables: context.variables,
  };
}

function parseBoolean(value: string | null | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

async function isWorkflowEmailForwardingEnabled(): Promise<boolean> {
  const raw = await getSystemSettingValue("workflow_forward_email_enabled");
  if (raw === null) return true;
  return parseBoolean(raw);
}

async function executeForwardEmail(
  data: { to: string; template?: { subject?: string; body?: string; html?: string } },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;
  if (isVercelDeployment()) {
    throw new Error("SMTP forwarding is disabled in Vercel deployment mode");
  }

  const enabled = await isWorkflowEmailForwardingEnabled();
  if (!enabled) {
    console.warn("[workflow] Email forwarding is disabled by admin");
    return true;
  }

  const templateCtx = buildTemplateContext(context);
  const subject = data.template?.subject
    ? replaceTemplateVariables(data.template.subject, templateCtx)
    : `[Forwarded] ${context.email.subject}`;
  const textBody = data.template?.body
    ? replaceTemplateVariables(data.template.body, templateCtx)
    : context.email.textBody;
  const htmlBody = data.template?.html
    ? replaceTemplateVariables(data.template.html, templateCtx)
    : context.email.htmlBody;

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would forward email to:", data.to, "Subject:", subject);
    return true;
  }

  await sendSmtpMail({
    to: data.to,
    subject,
    text: textBody,
    html: htmlBody,
  });
  return true;
}

async function executeForwardTelegram(
  data: ForwardTelegramData,
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  const templateCtx = buildTemplateContext(context);
  const template = data.template || `📧 New email: ${context.email.subject}`;
  const message = replaceTemplateVariables(template, templateCtx);
  const topicRouting = (data.topicRouting || "explicit") satisfies NonNullable<ForwardTelegramData["topicRouting"]>;

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would send to Telegram:", message);
    return true;
  }

  const token = Boolean(data.useAppBot) ? await getTelegramBotToken() : (data.token || "").trim();
  if (!token) {
    throw new Error(Boolean(data.useAppBot) ? "Telegram app bot token is not configured" : "Telegram bot token is required");
  }

  const requiresTopicRouting = topicRouting === "mailboxTopic" || topicRouting === "generalTopic";
  if (requiresTopicRouting && !Boolean(data.useAppBot)) {
    throw new Error("Telegram topic routing requires Use App Bot");
  }

  const isTopicDeletedError = (description: string) => description.toUpperCase().includes("TOPIC_DELETED");

  const parsePositiveInt = (value: string | null | undefined) => {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const buildScopeKey = (params: { chatId: string; mailboxId: string | null; mode: "MANAGE" | "NOTIFY" }) => {
    const mailboxPart = params.mailboxId ? params.mailboxId : "all";
    return `chat:${params.chatId}|mailbox:${mailboxPart}|mode:${params.mode}`;
  };

  let resolvedThreadId = typeof data.messageThreadId === "number" ? data.messageThreadId : undefined;
  let routingUserId: string | null = null;
  let routingMailboxId: string | null = null;
  let routingMailboxAddress: string | null = null;

  if (Boolean(data.useAppBot)) {
    const email = await prisma.email.findUnique({
      where: { id: context.email.id },
      select: {
        mailboxId: true,
        mailbox: { select: { userId: true, address: true } },
      },
    });
    const userId = email?.mailbox?.userId;
    const mailboxId = email?.mailboxId;
    const mailboxAddress = email?.mailbox?.address;
    if (!userId || !mailboxId) {
      throw new Error("Cannot resolve workflow userId/mailboxId for Telegram routing");
    }
    routingUserId = userId;
    routingMailboxId = mailboxId;
    routingMailboxAddress = mailboxAddress || null;

    const forumBinding = await prisma.telegramChatBinding.findFirst({
      where: { userId, enabled: true, mode: "MANAGE", chatId: data.chatId },
      select: { id: true, threadId: true },
      orderBy: { updatedAt: "desc" },
    });

    if (topicRouting === "generalTopic") {
      if (!forumBinding) {
        throw new Error("Telegram group is not bound/enabled for this account");
      }
      const forumThreadId = parsePositiveInt(forumBinding.threadId);
      if (!forumThreadId) {
        throw new Error("Telegram General topic is not configured for this binding");
      }
      resolvedThreadId = forumThreadId;
    } else if (topicRouting === "mailboxTopic") {
      if (!forumBinding) {
        throw new Error("Telegram group is not bound/enabled for this account");
      }

      const existing = await prisma.telegramChatBinding.findFirst({
        where: {
          userId,
          enabled: true,
          mode: "NOTIFY",
          chatId: data.chatId,
          mailboxId,
        },
        select: { id: true, threadId: true },
        orderBy: { updatedAt: "desc" },
      });

      const existingThread = parsePositiveInt(existing?.threadId);
      if (existing && existingThread) {
        resolvedThreadId = existingThread;
      } else {
        const topicName = (mailboxAddress || mailboxId).trim().slice(0, 120) || `Mailbox ${mailboxId.slice(0, 8)}`;
        const created = await telegramCreateForumTopic({ token, chatId: data.chatId, name: topicName });
        resolvedThreadId = created.messageThreadId;

        const scopeKey = buildScopeKey({ chatId: data.chatId, mailboxId, mode: "NOTIFY" });
        const stored = await prisma.telegramChatBinding.upsert({
          where: { userId_scopeKey: { userId, scopeKey } },
          update: {
            enabled: true,
            mode: "NOTIFY",
            chatId: data.chatId,
            threadId: String(resolvedThreadId),
            mailboxId,
          },
          create: {
            userId,
            scopeKey,
            enabled: true,
            mode: "NOTIFY",
            chatId: data.chatId,
            threadId: String(resolvedThreadId),
            mailboxId,
          },
          select: { id: true },
        });

        await prisma.telegramChatBinding.deleteMany({
          where: {
            userId,
            chatId: data.chatId,
            mode: "NOTIFY",
            mailboxId,
            id: { not: stored.id },
          },
        });
      }
    } else {
      // explicit
      if (typeof data.messageThreadId === "number") {
        const threadId = String(data.messageThreadId);
        const binding = await prisma.telegramChatBinding.findFirst({
          where: {
            userId,
            enabled: true,
            chatId: data.chatId,
            OR: [{ mode: "MANAGE", threadId }, { mode: "NOTIFY", threadId }],
          },
          select: { id: true },
        });
        if (!binding) {
          throw new Error("Telegram destination is not bound/enabled for this account");
        }
      } else {
        if (!forumBinding) {
          throw new Error("Telegram destination is not bound/enabled for this account");
        }
      }
    }
  }

  const parseMode = !data.parseMode ? "Markdown" : data.parseMode;

  const sendMessage = async (threadId: number | undefined) => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const requestBody: Record<string, unknown> = {
      chat_id: data.chatId,
      text: message,
      ...(typeof threadId === "number" ? { message_thread_id: threadId } : {}),
    };
    if (parseMode !== "None") {
      requestBody.parse_mode = parseMode;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let payload: unknown;
    try {
      payload = responseText ? JSON.parse(responseText) : undefined;
    } catch {
      payload = undefined;
    }

    const telegramOk = Boolean(
      response.ok &&
        payload &&
        typeof payload === "object" &&
        "ok" in payload &&
        (payload as { ok?: unknown }).ok === true
    );

    if (telegramOk) return { ok: true as const };

    const description =
      payload &&
      typeof payload === "object" &&
      "description" in payload &&
      typeof (payload as { description?: unknown }).description === "string"
        ? (payload as { description: string }).description
        : responseText || response.statusText || "Telegram API error";
    const errorCode =
      payload && typeof payload === "object" && "error_code" in payload
        ? Number((payload as { error_code?: unknown }).error_code)
        : undefined;

    return { ok: false as const, status: response.status, description, errorCode };
  };

  const throwTelegramError = (failure: { status: number; description: string; errorCode?: number }) => {
    const errorCodeSuffix = Number.isFinite(failure.errorCode) ? `, error_code=${failure.errorCode}` : "";
    throw new Error(`Telegram API error (HTTP ${failure.status}${errorCodeSuffix}): ${failure.description}`);
  };

  const recoverDeletedTopicAndGetThreadId = async (): Promise<number | undefined> => {
    if (!routingUserId || !routingMailboxId) return undefined;

    if (topicRouting === "generalTopic") {
      const topicName = await getTelegramForumGeneralTopicName();
      const created = await telegramCreateForumTopic({ token, chatId: data.chatId, name: topicName });
      const newThreadId = created.messageThreadId;

      await prisma.telegramChatBinding.updateMany({
        where: { userId: routingUserId, enabled: true, mode: "MANAGE", chatId: data.chatId },
        data: { threadId: String(newThreadId) },
      });

      return newThreadId;
    }

    if (topicRouting === "mailboxTopic") {
      const topicName =
        (routingMailboxAddress || routingMailboxId).trim().slice(0, 120) ||
        `Mailbox ${routingMailboxId.slice(0, 8)}`;
      const created = await telegramCreateForumTopic({ token, chatId: data.chatId, name: topicName });
      const newThreadId = created.messageThreadId;

      const scopeKey = buildScopeKey({ chatId: data.chatId, mailboxId: routingMailboxId, mode: "NOTIFY" });
      const stored = await prisma.telegramChatBinding.upsert({
        where: { userId_scopeKey: { userId: routingUserId, scopeKey } },
        update: {
          enabled: true,
          mode: "NOTIFY",
          chatId: data.chatId,
          threadId: String(newThreadId),
          mailboxId: routingMailboxId,
        },
        create: {
          userId: routingUserId,
          scopeKey,
          enabled: true,
          mode: "NOTIFY",
          chatId: data.chatId,
          threadId: String(newThreadId),
          mailboxId: routingMailboxId,
        },
        select: { id: true },
      });

      await prisma.telegramChatBinding.deleteMany({
        where: {
          userId: routingUserId,
          chatId: data.chatId,
          mode: "NOTIFY",
          mailboxId: routingMailboxId,
          id: { not: stored.id },
        },
      });

      return newThreadId;
    }

    return undefined;
  };

  const first = await sendMessage(resolvedThreadId);
  if (!first.ok) {
    const canRecover =
      Boolean(data.useAppBot) &&
      typeof resolvedThreadId === "number" &&
      (topicRouting === "mailboxTopic" || topicRouting === "generalTopic") &&
      isTopicDeletedError(first.description);

    if (!canRecover) {
      throwTelegramError(first);
    }

    const recoveredThreadId = await recoverDeletedTopicAndGetThreadId();
    if (!recoveredThreadId) {
      throwTelegramError(first);
    }

    const second = await sendMessage(recoveredThreadId);
    if (!second.ok) {
      throwTelegramError(second);
    }
  }

  return true;
}

async function executeForwardTelegramBound(
  data: ForwardTelegramBoundData,
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would send to bound Telegram group");
    return true;
  }

  const email = await prisma.email.findUnique({
    where: { id: context.email.id },
    select: { mailbox: { select: { userId: true } } },
  });
  const userId = email?.mailbox?.userId;
  if (!userId) {
    throw new Error("Cannot resolve workflow userId for Telegram forwarding");
  }

  const binding = await prisma.telegramChatBinding.findFirst({
    where: { userId, enabled: true, mode: "MANAGE" },
    select: { chatId: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!binding) {
    throw new Error("No bound Telegram forum group found. Bind a group first in Telegram settings.");
  }

  const defaultTemplate = `📧 New email\nFrom: {{email.fromAddress}}\nTo: {{email.toAddress}}\nSubject: {{email.subject}}\nTime: {{email.receivedAt}}\n\nPreview: {{email.previewUrl}}`;
  const template = (data.template || "").trim() ? String(data.template) : defaultTemplate;
  const parseMode = data.parseMode || "None";

  return executeForwardTelegram(
    {
      useAppBot: true,
      chatId: binding.chatId,
      topicRouting: "mailboxTopic",
      parseMode,
      template,
    },
    context
  );
}

async function executeForwardDiscord(
  data: { webhookUrl: string; template?: string; useEmbed?: boolean },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  const templateCtx = buildTemplateContext(context);
  const template = data.template || `📧 New email: ${context.email.subject}`;

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would send to Discord:", replaceTemplateVariables(template, templateCtx));
    return true;
  }

  try {
    const validated = await validateEgressUrl(data.webhookUrl);
    if (!validated.ok) {
      console.error("Discord forward error:", validated.error);
      return false;
    }

    let body: Record<string, unknown>;

    if (data.useEmbed && data.template) {
      // 尝试解析为 JSON embed
      try {
        body = JSON.parse(replaceTemplateVariables(data.template, templateCtx));
      } catch {
        body = { content: replaceTemplateVariables(template, templateCtx) };
      }
    } else {
      body = { content: replaceTemplateVariables(template, templateCtx) };
    }

    const response = await fetch(validated.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    return response.ok || response.status === 204;
  } catch (error) {
    console.error("Discord forward error:", error);
    return false;
  }
}

async function executeForwardSlack(
  data: { webhookUrl: string; template?: string; useBlocks?: boolean },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  const templateCtx = buildTemplateContext(context);
  const template = data.template || `📧 New email: ${context.email.subject}`;

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would send to Slack:", replaceTemplateVariables(template, templateCtx));
    return true;
  }

  try {
    const validated = await validateEgressUrl(data.webhookUrl);
    if (!validated.ok) {
      console.error("Slack forward error:", validated.error);
      return false;
    }

    let body: Record<string, unknown>;

    if (data.useBlocks && data.template) {
      // 尝试解析为 JSON blocks
      try {
        body = JSON.parse(replaceTemplateVariables(data.template, templateCtx));
      } catch {
        body = { text: replaceTemplateVariables(template, templateCtx) };
      }
    } else {
      body = { text: replaceTemplateVariables(template, templateCtx) };
    }

    const response = await fetch(validated.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    return response.ok;
  } catch (error) {
    console.error("Slack forward error:", error);
    return false;
  }
}

async function executeForwardWebhook(
  data: { url: string; method: string; headers?: Record<string, string>; bodyTemplate?: string; contentType?: string },
  context: ExecutionContext
): Promise<boolean> {
  const templateCtx = buildTemplateContext(context);

  // 测试模式下跳过实际发送
  if (context.isTestMode) {
    console.log("[TEST MODE] Would call webhook:", data.url, data.method);
    return true;
  }

  try {
    const validated = await validateEgressUrl(data.url);
    if (!validated.ok) {
      console.error("Webhook forward error:", validated.error);
      return false;
    }

    const contentType = data.contentType || "application/json";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      ...sanitizeOutboundHeaders(data.headers),
    };

    const method = normalizeWebhookMethod(data.method);
    const options: RequestInit = {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(DEFAULT_EGRESS_TIMEOUT_MS),
    };

    if (method !== "GET") {
      if (data.bodyTemplate) {
        options.body = replaceTemplateVariables(data.bodyTemplate, templateCtx);
      } else {
        // 默认发送完整邮件数据
        options.body = JSON.stringify({
          id: context.email?.id,
          messageId: context.email?.messageId,
          from: context.email?.fromAddress,
          fromName: context.email?.fromName,
          to: context.email?.toAddress,
          subject: context.email?.subject,
          text: context.email?.textBody,
          html: context.email?.htmlBody,
          receivedAt: context.email?.receivedAt,
        });
      }
    }

    const response = await fetch(validated.url, options);
    return response.ok;
  } catch (error) {
    console.error("Webhook forward error:", error);
    return false;
  }
}

// ==================== Control Flow Executors ====================

async function executeDelay(data: { duration: number }): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, data.duration * 1000));
  return true;
}
