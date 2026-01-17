import { prisma } from "@/lib/prisma";
import type {
  WorkflowNode,
  ExecutionContext,
  MatchCondition,
  CompositeCondition,
  MatchField,
  MatchOperator,
  ConditionKeywordData,
} from "@/lib/workflow/types";
import { replaceTemplateVariables } from "@/lib/workflow/utils";

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

    // Forwards
    case "forward:email":
      return executeForwardEmail(
        data as { to: string; template?: { subject?: string; body?: string; html?: string } },
        context
      );

    case "forward:telegram":
      return executeForwardTelegram(
        data as { token: string; chatId: string; template?: string; parseMode?: string },
        context
      );

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
): boolean {
  if (!context.email) return false;

  // 高级模式 - 使用复合条件
  if (data.conditions) {
    return evaluateCompositeCondition(data.conditions, context);
  }

  // 简单模式 - 关键字匹配
  const { keywords = [], matchType = "any", fields = ["subject", "textBody"], caseSensitive = false } = data;

  if (keywords.length === 0) return true;

  // 收集要搜索的文本
  const searchTexts: string[] = [];
  for (const field of fields) {
    const value = getFieldValue(field, context);
    searchTexts.push(caseSensitive ? value : value.toLowerCase());
  }
  const combinedText = searchTexts.join(" ");

  // 处理关键字
  const processedKeywords = keywords.map((kw) =>
    caseSensitive ? kw : kw.toLowerCase()
  );

  if (matchType === "all") {
    return processedKeywords.every((kw) => combinedText.includes(kw));
  } else {
    return processedKeywords.some((kw) => combinedText.includes(kw));
  }
}

// ==================== Action Executors ====================

async function executeArchive(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "ARCHIVED" },
  });

  return true;
}

async function executeMarkRead(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "READ" },
  });

  return true;
}

async function executeMarkUnread(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.update({
    where: { id: context.email.id },
    data: { status: "UNREAD" },
  });

  return true;
}

async function executeStar(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.update({
    where: { id: context.email.id },
    data: { isStarred: true },
  });

  return true;
}

async function executeUnstar(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.update({
    where: { id: context.email.id },
    data: { isStarred: false },
  });

  return true;
}

async function executeDelete(context: ExecutionContext): Promise<boolean> {
  if (!context.email?.id) return false;

  await prisma.email.delete({
    where: { id: context.email.id },
  });

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

// ==================== Forward Executors ====================

function buildTemplateContext(context: ExecutionContext) {
  return {
    email: context.email,
    variables: context.variables,
  };
}

async function executeForwardEmail(
  data: { to: string; template?: { subject?: string; body?: string; html?: string } },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  // TODO: Implement email forwarding via SMTP
  const templateCtx = buildTemplateContext(context);
  const subject = data.template?.subject
    ? replaceTemplateVariables(data.template.subject, templateCtx)
    : `[Forwarded] ${context.email.subject}`;
  const body = data.template?.body
    ? replaceTemplateVariables(data.template.body, templateCtx)
    : context.email.textBody;

  console.log("Forward email to:", data.to, "Subject:", subject);
  return true;
}

async function executeForwardTelegram(
  data: { token: string; chatId: string; template?: string; parseMode?: string },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  try {
    const templateCtx = buildTemplateContext(context);
    const template = data.template || `📧 New email: ${context.email.subject}`;
    const message = replaceTemplateVariables(template, templateCtx);

    const url = `https://api.telegram.org/bot${data.token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: data.chatId,
        text: message,
        parse_mode: data.parseMode || "Markdown",
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Telegram forward error:", error);
    return false;
  }
}

async function executeForwardDiscord(
  data: { webhookUrl: string; template?: string; useEmbed?: boolean },
  context: ExecutionContext
): Promise<boolean> {
  if (!context.email) return false;

  try {
    const templateCtx = buildTemplateContext(context);
    const template = data.template || `📧 New email: ${context.email.subject}`;

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

    const response = await fetch(data.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  try {
    const templateCtx = buildTemplateContext(context);
    const template = data.template || `📧 New email: ${context.email.subject}`;

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

    const response = await fetch(data.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  try {
    const templateCtx = buildTemplateContext(context);
    const contentType = data.contentType || "application/json";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      ...(data.headers || {}),
    };

    const options: RequestInit = {
      method: data.method || "POST",
      headers,
    };

    if (data.method !== "GET") {
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

    const response = await fetch(data.url, options);
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
