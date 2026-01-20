import { z } from "zod";

// ==================== 基础类型 ====================

const matchFieldSchema = z.enum([
  "subject",
  "fromAddress",
  "fromName",
  "toAddress",
  "textBody",
  "htmlBody",
  "messageId",
  "replyTo",
]);
const matchOperatorSchema = z.enum([
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "regex",
  "isEmpty",
  "isNotEmpty",
]);

const matchConditionSchema = z.object({
  field: matchFieldSchema,
  operator: matchOperatorSchema,
  value: z.string().optional(),
  caseSensitive: z.boolean().optional(),
});

// ==================== 节点数据模式 ====================

// 触发器
const triggerEmailDataSchema = z.object({
  label: z.string().optional(),
  mailboxId: z.string().optional(),
  conditions: z.array(matchConditionSchema).optional(),
});

const triggerScheduleDataSchema = z.object({
  label: z.string().optional(),
  cron: z.string().min(1),
  timezone: z.string().optional(),
});

const triggerManualDataSchema = z.object({
  label: z.string().optional(),
});

// 条件判断
const conditionMatchDataSchema = z.object({
  label: z.string().optional(),
  field: matchFieldSchema,
  operator: matchOperatorSchema,
  value: z.string().optional(),
  caseSensitive: z.boolean().optional(),
});

// 复合条件 schema（递归）
const compositeConditionSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("and"),
      conditions: z.array(compositeConditionSchema),
    }),
    z.object({
      kind: z.literal("or"),
      conditions: z.array(compositeConditionSchema),
    }),
    z.object({
      kind: z.literal("not"),
      condition: compositeConditionSchema,
    }),
    z.object({
      kind: z.literal("match"),
      field: matchFieldSchema,
      operator: matchOperatorSchema,
      value: z.string().optional(),
      caseSensitive: z.boolean().optional(),
    }),
  ])
);

const keywordSetSchema = z.object({
  category: z.string().min(1),
  keywords: z.array(z.string()),
  matchType: z.enum(["any", "all"]).optional(),
  caseSensitive: z.boolean().optional(),
  fields: z.array(matchFieldSchema).optional(),
});

const conditionKeywordDataSchema = z.object({
  label: z.string().optional(),
  // multi-classification mode
  categories: z.array(z.string()).optional(),
  keywordSets: z.array(keywordSetSchema).optional(),
  defaultCategory: z.string().optional(),
  // legacy simple mode (boolean)
  keywords: z.array(z.string()).optional(),
  matchType: z.enum(["any", "all"]).optional(),
  fields: z.array(matchFieldSchema).optional(),
  caseSensitive: z.boolean().optional(),
  // advanced mode (boolean)
  conditions: compositeConditionSchema.optional(),
});

const conditionAiClassifierDataSchema = z.object({
  label: z.string().optional(),
  categories: z.array(z.string()),
  customPrompt: z.string().optional(),
  fields: z.array(matchFieldSchema).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  defaultCategory: z.string().optional(),
});

const conditionCustomDataSchema = z.object({
  label: z.string().optional(),
  adapterId: z.string(),
  config: z.record(z.string(), z.unknown()),
});

// 执行动作
const actionSimpleDataSchema = z.object({
  label: z.string().optional(),
});

const actionSetVariableDataSchema = z.object({
  label: z.string().optional(),
  name: z.string().min(1),
  value: z.string(),
});

const emailContentFieldSchema = z.enum(["subject", "textBody", "htmlBody"]);

const actionUnsetVariableDataSchema = z.object({
  label: z.string().optional(),
  name: z.string().min(1),
});

const actionCloneVariableDataSchema = z.object({
  label: z.string().optional(),
  source: z.string().min(1),
  target: z.string().min(1),
});

const actionRewriteEmailDataSchema = z.object({
  label: z.string().optional(),
  subject: z.string().optional(),
  textBody: z.string().optional(),
  htmlBody: z.string().optional(),
});

const actionRegexReplaceDataSchema = z.object({
  label: z.string().optional(),
  field: emailContentFieldSchema,
  pattern: z.string().min(1).max(2000),
  replacement: z.string().max(5000),
  flags: z.string().regex(/^[gimsuy]*$/).max(10).optional(),
});

const actionSetTagsDataSchema = z.object({
  label: z.string().optional(),
  mode: z.enum(["add", "remove", "set"]),
  tags: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
});

const actionAiRewriteDataSchema = z.object({
  label: z.string().optional(),
  writeTarget: z.enum(["email", "variables", "both"]),
  fields: z.array(emailContentFieldSchema).optional(),
  outputVariableKeys: z.array(z.string().min(1).max(100)).max(50).optional(),
  prompt: z.string().optional(),
  resultVariable: z.string().optional(),
});

// 转发
const forwardEmailDataSchema = z.object({
  label: z.string().optional(),
  to: z.string().email(),
  template: z.object({
    subject: z.string().optional(),
    body: z.string().optional(),
  }).optional(),
});

const forwardTelegramDataSchema = z
  .object({
    label: z.string().optional(),
    token: z.string().min(1).optional(),
    useAppBot: z.boolean().optional(),
    chatId: z.string().min(1),
    messageThreadId: z.coerce.number().int().positive().optional(),
    template: z.string().optional(),
    parseMode: z.enum(["Markdown", "MarkdownV2", "HTML", "None"]).optional(),
  })
  .superRefine((value, ctx) => {
    const useAppBot = Boolean(value.useAppBot);
    if (!useAppBot && !value.token) {
      ctx.addIssue({
        code: "custom",
        path: ["token"],
        message: "Telegram token is required (or enable Use App Bot)",
      });
    }
  });

const forwardDiscordDataSchema = z.object({
  label: z.string().optional(),
  webhookUrl: z.string().url(),
  template: z.string().optional(),
});

const forwardSlackDataSchema = z.object({
  label: z.string().optional(),
  webhookUrl: z.string().url(),
  template: z.string().optional(),
});

const forwardWebhookDataSchema = z.object({
  label: z.string().optional(),
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT"]),
  headers: z.record(z.string(), z.string()).optional(),
  bodyTemplate: z.string().optional(),
});

// 流程控制
const controlBranchDataSchema = z.object({
  label: z.string().optional(),
  condition: matchConditionSchema,
});

const controlDelayDataSchema = z.object({
  label: z.string().optional(),
  duration: z.number().min(1).max(86400), // 最长 24 小时
});

const controlEndDataSchema = z.object({
  label: z.string().optional(),
});

// ==================== 节点类型映射 ====================

const nodeTypeToDataSchema: Record<string, z.ZodType> = {
  "trigger:email": triggerEmailDataSchema,
  "trigger:schedule": triggerScheduleDataSchema,
  "trigger:manual": triggerManualDataSchema,
  "condition:match": conditionMatchDataSchema,
  "condition:keyword": conditionKeywordDataSchema,
  "condition:ai-classifier": conditionAiClassifierDataSchema,
  // backward compatibility
  "condition:classifier": conditionAiClassifierDataSchema,
  "condition:custom": conditionCustomDataSchema,
  "action:archive": actionSimpleDataSchema,
  "action:markRead": actionSimpleDataSchema,
  "action:markUnread": actionSimpleDataSchema,
  "action:star": actionSimpleDataSchema,
  "action:unstar": actionSimpleDataSchema,
  "action:delete": actionSimpleDataSchema,
  "action:setVariable": actionSetVariableDataSchema,
  "action:unsetVariable": actionUnsetVariableDataSchema,
  "action:cloneVariable": actionCloneVariableDataSchema,
  "action:rewriteEmail": actionRewriteEmailDataSchema,
  "action:regexReplace": actionRegexReplaceDataSchema,
  "action:setTags": actionSetTagsDataSchema,
  "action:aiRewrite": actionAiRewriteDataSchema,
  "forward:email": forwardEmailDataSchema,
  "forward:telegram": forwardTelegramDataSchema,
  "forward:discord": forwardDiscordDataSchema,
  "forward:slack": forwardSlackDataSchema,
  "forward:webhook": forwardWebhookDataSchema,
  "control:branch": controlBranchDataSchema,
  "control:delay": controlDelayDataSchema,
  "control:end": controlEndDataSchema,
};

// ==================== 节点和边模式 ====================

const nodeTypeSchema = z.enum([
  "trigger:email",
  "trigger:schedule",
  "trigger:manual",
  "condition:match",
  "condition:keyword",
  "condition:ai-classifier",
  "condition:classifier",
  "condition:custom",
  "action:archive",
  "action:markRead",
  "action:markUnread",
  "action:star",
  "action:unstar",
  "action:delete",
  "action:setVariable",
  "action:unsetVariable",
  "action:cloneVariable",
  "action:rewriteEmail",
  "action:regexReplace",
  "action:setTags",
  "action:aiRewrite",
  "forward:email",
  "forward:telegram",
  "forward:discord",
  "forward:slack",
  "forward:webhook",
  "control:branch",
  "control:delay",
  "control:end",
]);

const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.string(), z.unknown()),
}).refine((node) => {
  const schema = nodeTypeToDataSchema[node.type];
  if (!schema) return false;
  return schema.safeParse(node.data).success;
}, {
  message: "Invalid node data for the specified type",
});

const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

// ==================== 工作流配置模式 ====================

export const workflowConfigSchema = z.object({
  version: z.literal(1),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().min(0.1).max(2),
  }).optional(),
});

// ==================== API 模式 ====================

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  mailboxId: z.string().optional(),
  config: workflowConfigSchema.optional(),
});

export const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).optional(),
  mailboxId: z.string().nullable().optional(),
  config: workflowConfigSchema.optional(),
});

export const executeWorkflowSchema = z.object({
  emailId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
});

// ==================== 验证函数 ====================

export function validateWorkflowConfig(config: unknown) {
  return workflowConfigSchema.safeParse(config);
}

export function validateNodeData(type: string, data: unknown) {
  const schema = nodeTypeToDataSchema[type];
  if (!schema) {
    return { success: false, error: new Error(`Unknown node type: ${type}`) };
  }
  return schema.safeParse(data);
}

// ==================== 导出子模式 ====================

export {
  matchConditionSchema,
  workflowNodeSchema,
  workflowEdgeSchema,
  nodeTypeSchema,
};
