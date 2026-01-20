// ==================== 工作流配置类型 ====================

export interface WorkflowConfig {
  version: 1;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// ==================== 节点类型 ====================

export type NodeType =
  // 触发器
  | "trigger:email"
  | "trigger:schedule"
  | "trigger:manual"
  // 条件判断
  | "condition:match"
  | "condition:keyword"
  | "condition:ai-classifier"
  | "condition:classifier" // legacy alias for ai-classifier
  | "condition:custom"
  // 执行动作
  | "action:archive"
  | "action:markRead"
  | "action:markUnread"
  | "action:star"
  | "action:unstar"
  | "action:delete"
  | "action:setVariable"
  | "action:unsetVariable"
  | "action:cloneVariable"
  | "action:rewriteEmail"
  | "action:regexReplace"
  | "action:setTags"
  | "action:aiRewrite"
  // 转发
  | "forward:email"
  | "forward:telegram-bound"
  | "forward:telegram"
  | "forward:discord"
  | "forward:slack"
  | "forward:webhook"
  // 流程控制
  | "control:branch"
  | "control:delay"
  | "control:end";

// ==================== 节点数据类型 ====================

export type NodeData =
  | TriggerEmailData
  | TriggerScheduleData
  | TriggerManualData
  | ConditionMatchData
  | ConditionKeywordData
  | ConditionAiClassifierData
  | ConditionCustomData
  | ActionArchiveData
  | ActionMarkReadData
  | ActionMarkUnreadData
  | ActionStarData
  | ActionUnstarData
  | ActionDeleteData
  | ActionSetVariableData
  | ActionUnsetVariableData
  | ActionCloneVariableData
  | ActionRewriteEmailData
  | ActionRegexReplaceData
  | ActionSetTagsData
  | ActionAiRewriteData
  | ForwardEmailData
  | ForwardTelegramBoundData
  | ForwardTelegramData
  | ForwardDiscordData
  | ForwardSlackData
  | ForwardWebhookData
  | ControlBranchData
  | ControlDelayData
  | ControlEndData;

// ==================== 触发器数据 ====================

export interface TriggerEmailData {
  label?: string;
  mailboxId?: string;
  conditions?: MatchCondition[];
}

export interface TriggerScheduleData {
  label?: string;
  cron: string;
  timezone?: string;
}

export interface TriggerManualData {
  label?: string;
}

// ==================== 条件判断数据 ====================

export type MatchField = "subject" | "fromAddress" | "fromName" | "toAddress" | "textBody" | "htmlBody" | "messageId" | "replyTo";
export type MatchOperator = "contains" | "notContains" | "equals" | "notEquals" | "startsWith" | "endsWith" | "regex" | "isEmpty" | "isNotEmpty";

export interface MatchCondition {
  field: MatchField;
  operator: MatchOperator;
  value: string;
  caseSensitive?: boolean;
}

// 复合条件类型 - 支持 AND/OR/NOT 逻辑
export type CompositeCondition =
  | { kind: "and"; conditions: CompositeCondition[] }
  | { kind: "or"; conditions: CompositeCondition[] }
  | { kind: "not"; condition: CompositeCondition }
  | {
      kind: "match";
      field: MatchField;
      operator: MatchOperator;
      value: string;
      caseSensitive?: boolean;
    };

export interface ConditionMatchData {
  label?: string;
  field: MatchField;
  operator: MatchOperator;
  value: string;
  caseSensitive?: boolean;
}

export interface ConditionKeywordData {
  label?: string;
  // 多元分类模式（新）
  categories?: string[];
  keywordSets?: KeywordSet[];
  defaultCategory?: string;
  // 向后兼容的简单模式（boolean）
  keywords?: string[];
  matchType?: "any" | "all";
  fields?: MatchField[];
  caseSensitive?: boolean;
  // 高级复合条件模式（boolean，向后兼容）
  conditions?: CompositeCondition;
}

export interface KeywordSet {
  category: string;
  keywords: string[];
  matchType?: "any" | "all";
  caseSensitive?: boolean;
  fields?: MatchField[];
}

export interface ConditionAiClassifierData {
  label?: string;
  categories: string[];
  customPrompt?: string;
  fields?: MatchField[];
  confidenceThreshold?: number;
  defaultCategory?: string;
}

// Backward compatibility: old name used in schema/UI previously
export type ConditionClassifierData = ConditionAiClassifierData;

export interface ConditionCustomData {
  label?: string;
  adapterId: string;
  config: Record<string, unknown>;
}

// ==================== 执行动作数据 ====================

export interface ActionArchiveData {
  label?: string;
}

export interface ActionMarkReadData {
  label?: string;
}

export interface ActionMarkUnreadData {
  label?: string;
}

export interface ActionStarData {
  label?: string;
}

export interface ActionUnstarData {
  label?: string;
}

export interface ActionDeleteData {
  label?: string;
}

export interface ActionSetVariableData {
  label?: string;
  name: string;
  value: string;
}

export interface ActionUnsetVariableData {
  label?: string;
  name: string;
}

export interface ActionCloneVariableData {
  label?: string;
  source: string;
  target: string;
}

export type EmailContentField = "subject" | "textBody" | "htmlBody";

export interface ActionRewriteEmailData {
  label?: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
}

export interface ActionRegexReplaceData {
  label?: string;
  field: EmailContentField;
  pattern: string;
  replacement: string;
  flags?: string;
}

export type SetTagsMode = "add" | "remove" | "set";

export interface ActionSetTagsData {
  label?: string;
  mode: SetTagsMode;
  tags: string[];
}

export type AiRewriteWriteTarget = "email" | "variables" | "both";

export interface ActionAiRewriteData {
  label?: string;
  writeTarget: AiRewriteWriteTarget;
  fields?: EmailContentField[];
  outputVariableKeys?: string[];
  prompt?: string;
  resultVariable?: string;
}

// ==================== 转发数据 ====================

export interface ForwardEmailData {
  label?: string;
  to: string;
  template?: {
    subject?: string;
    body?: string;
    html?: string;
  };
}

export interface ForwardTelegramBoundData {
  label?: string;
}

export interface ForwardTelegramData {
  label?: string;
  // If `useAppBot` is true, token is taken from system settings (`telegram_bot_token`).
  token?: string;
  useAppBot?: boolean;
  chatId: string;
  messageThreadId?: number;
  topicRouting?: "explicit" | "mailboxTopic" | "generalTopic";
  template?: string;
  parseMode?: "Markdown" | "HTML" | "MarkdownV2" | "None";
}

export interface ForwardDiscordData {
  label?: string;
  webhookUrl: string;
  template?: string;
  // Discord rich embed support
  useEmbed?: boolean;
  embedColor?: string;
}

export interface ForwardSlackData {
  label?: string;
  webhookUrl: string;
  template?: string;
  // Slack block kit support
  useBlocks?: boolean;
}

export interface ForwardWebhookData {
  label?: string;
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  bodyTemplate?: string;
  contentType?: "application/json" | "application/x-www-form-urlencoded" | "text/plain";
}

// ==================== 转发默认模板 ====================

export const DEFAULT_FORWARD_TEMPLATES = {
  email: {
    subject: "[Forwarded] {{email.subject}}",
    body: `From: {{email.fromName}} <{{email.fromAddress}}>
To: {{email.toAddress}}
Date: {{email.receivedAt}}
Subject: {{email.subject}}

---

{{email.textBody}}`,
    html: `<div style="font-family: sans-serif;">
<p><strong>From:</strong> {{email.fromName}} &lt;{{email.fromAddress}}&gt;</p>
<p><strong>To:</strong> {{email.toAddress}}</p>
<p><strong>Date:</strong> {{email.receivedAt}}</p>
<p><strong>Subject:</strong> {{email.subject}}</p>
<hr/>
{{email.htmlBody}}
</div>`,
  },
  telegram: {
    default: `📧 *New Email*

*From:* {{email.fromName}} <{{email.fromAddress}}>
*To:* {{email.toAddress}}
*Subject:* {{email.subject}}
*Time:* {{email.receivedAt}}

---
{{email.textBody}}`,
    compact: `📧 New email from {{email.fromAddress}}
Subject: {{email.subject}}`,
    detailed: `📧 *Email Notification*

*From:* {{email.fromName}} ({{email.fromAddress}})
*To:* {{email.toAddress}}
*Subject:* {{email.subject}}
*Received:* {{email.receivedAt}}

*Preview:*
{{email.textBody}}

---
_Forwarded by TEmail Workflow_`,
  },
  discord: {
    default: `📧 **New Email**

**From:** {{email.fromName}} <{{email.fromAddress}}>
**Subject:** {{email.subject}}
**Time:** {{email.receivedAt}}

> {{email.textBody}}`,
    compact: `📧 Email from **{{email.fromAddress}}**: {{email.subject}}`,
    embed: JSON.stringify({
      embeds: [{
        title: "📧 {{email.subject}}",
        description: "{{email.textBody}}",
        color: 15258703,
        fields: [
          { name: "From", value: "{{email.fromName}} <{{email.fromAddress}}>", inline: true },
          { name: "To", value: "{{email.toAddress}}", inline: true }
        ],
        footer: { text: "Forwarded by TEmail" },
        timestamp: "{{email.receivedAt}}"
      }]
    }, null, 2),
  },
  slack: {
    default: `📧 *New Email*

*From:* {{email.fromName}} <{{email.fromAddress}}>
*Subject:* {{email.subject}}
*Time:* {{email.receivedAt}}

>>>{{email.textBody}}`,
    compact: `📧 Email from *{{email.fromAddress}}*: {{email.subject}}`,
    blocks: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "📧 New Email" }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: "*From:*\\n{{email.fromName}}" },
            { type: "mrkdwn", text: "*Subject:*\\n{{email.subject}}" }
          ]
        },
        {
          type: "section",
          text: { type: "plain_text", text: "{{email.textBody}}" }
        }
      ]
    }, null, 2),
  },
  webhook: {
    json: JSON.stringify({
      event: "new_email",
      data: {
        id: "{{email.id}}",
        messageId: "{{email.messageId}}",
        from: {
          address: "{{email.fromAddress}}",
          name: "{{email.fromName}}"
        },
        to: "{{email.toAddress}}",
        subject: "{{email.subject}}",
        body: "{{email.textBody}}",
        receivedAt: "{{email.receivedAt}}"
      }
    }, null, 2),
    minimal: JSON.stringify({
      from: "{{email.fromAddress}}",
      subject: "{{email.subject}}",
      body: "{{email.textBody}}"
    }, null, 2),
    full: JSON.stringify({
      id: "{{email.id}}",
      messageId: "{{email.messageId}}",
      from: {
        address: "{{email.fromAddress}}",
        name: "{{email.fromName}}"
      },
      to: "{{email.toAddress}}",
      replyTo: "{{email.replyTo}}",
      subject: "{{email.subject}}",
      textBody: "{{email.textBody}}",
      htmlBody: "{{email.htmlBody}}",
      receivedAt: "{{email.receivedAt}}",
      mailboxId: "{{mailbox.id}}",
      mailboxAddress: "{{mailbox.address}}"
    }, null, 2),
  },
} as const;

// ==================== 流程控制数据 ====================

export interface ControlBranchData {
  label?: string;
  condition: MatchCondition;
}

export interface ControlDelayData {
  label?: string;
  duration: number; // 秒
}

export interface ControlEndData {
  label?: string;
}

// ==================== 执行上下文 ====================

export interface ExecutionContext {
  email?: EmailContext;
  variables: Record<string, unknown>;
  logs: ExecutionLog[];
  isTestMode?: boolean; // 测试模式下跳过真实数据库操作
}

export interface EmailContext {
  id: string;
  messageId?: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  subject: string;
  textBody?: string;
  htmlBody?: string;
  previewUrl?: string;
  receivedAt: Date;
}

export interface ExecutionLog {
  nodeId: string;
  nodeType: NodeType;
  status: "success" | "failed" | "skipped";
  message?: string;
  timestamp: Date;
  duration?: number;
  output?: unknown;
}

// ==================== 节点定义元数据 ====================

export interface NodeDefinition {
  type: NodeType;
  category: "trigger" | "condition" | "action" | "forward" | "control";
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: number;
  outputs: number | "conditional" | "multi";
  defaultData: Partial<NodeData>;
}

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  // 触发器
  "trigger:email": {
    type: "trigger:email",
    category: "trigger",
    label: "Email Trigger",
    description: "Triggered when a new email is received",
    icon: "Mail",
    color: "#3b82f6",
    inputs: 0,
    outputs: 1,
    defaultData: {},
  },
  "trigger:schedule": {
    type: "trigger:schedule",
    category: "trigger",
    label: "Schedule Trigger",
    description: "Triggered on a schedule (cron)",
    icon: "Clock",
    color: "#3b82f6",
    inputs: 0,
    outputs: 1,
    defaultData: { cron: "0 * * * *" },
  },
  "trigger:manual": {
    type: "trigger:manual",
    category: "trigger",
    label: "Manual Trigger",
    description: "Triggered manually by user",
    icon: "Hand",
    color: "#3b82f6",
    inputs: 0,
    outputs: 1,
    defaultData: {},
  },

  // 条件判断
  "condition:match": {
    type: "condition:match",
    category: "condition",
    label: "Match Condition",
    description: "Check if email field matches a pattern",
    icon: "Search",
    color: "#f59e0b",
    inputs: 1,
    outputs: "conditional",
    defaultData: { field: "subject", operator: "contains", value: "" },
  },
  "condition:keyword": {
    type: "condition:keyword",
    category: "condition",
    label: "Keyword Match",
    description: "Check for specific keywords",
    icon: "Tag",
    color: "#f59e0b",
    inputs: 1,
    outputs: "multi",
    defaultData: {
      keywords: [],
      matchType: "any",
      fields: ["subject"],
      caseSensitive: false,
    },
  },
  "condition:ai-classifier": {
    type: "condition:ai-classifier",
    category: "condition",
    label: "AI Classifier",
    description: "Classify email using AI with multiple categories",
    icon: "Brain",
    color: "#8b5cf6",
    inputs: 1,
    outputs: "multi",
    defaultData: {
      categories: [],
      fields: ["subject", "textBody"],
      confidenceThreshold: 0.7,
      defaultCategory: "default",
    },
  },
  "condition:classifier": {
    type: "condition:classifier",
    category: "condition",
    label: "AI Classifier (Legacy)",
    description: "Legacy AI classifier node (use AI Classifier)",
    icon: "Brain",
    color: "#8b5cf6",
    inputs: 1,
    outputs: "multi",
    defaultData: {
      categories: [],
      fields: ["subject", "textBody"],
      confidenceThreshold: 0.7,
      defaultCategory: "default",
    },
  },
  "condition:custom": {
    type: "condition:custom",
    category: "condition",
    label: "Custom Condition",
    description: "Custom adapter-based condition",
    icon: "Code",
    color: "#f59e0b",
    inputs: 1,
    outputs: "conditional",
    defaultData: { adapterId: "", config: {} },
  },

  // 执行动作
  "action:archive": {
    type: "action:archive",
    category: "action",
    label: "Archive",
    description: "Archive the email",
    icon: "Archive",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:markRead": {
    type: "action:markRead",
    category: "action",
    label: "Mark as Read",
    description: "Mark the email as read",
    icon: "CheckCircle",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:markUnread": {
    type: "action:markUnread",
    category: "action",
    label: "Mark as Unread",
    description: "Mark the email as unread",
    icon: "Circle",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:star": {
    type: "action:star",
    category: "action",
    label: "Star",
    description: "Star the email",
    icon: "Star",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:unstar": {
    type: "action:unstar",
    category: "action",
    label: "Unstar",
    description: "Remove star from the email",
    icon: "StarOff",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:delete": {
    type: "action:delete",
    category: "action",
    label: "Delete",
    description: "Move the email to Trash",
    icon: "Trash2",
    color: "#ef4444",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:setVariable": {
    type: "action:setVariable",
    category: "action",
    label: "Set Variable",
    description: "Set a workflow variable",
    icon: "Variable",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { name: "", value: "" },
  },
  "action:unsetVariable": {
    type: "action:unsetVariable",
    category: "action",
    label: "Unset Variable",
    description: "Remove a workflow variable",
    icon: "Variable",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { name: "" },
  },
  "action:cloneVariable": {
    type: "action:cloneVariable",
    category: "action",
    label: "Clone Variable",
    description: "Clone a variable into another one",
    icon: "Variable",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { source: "", target: "" },
  },
  "action:rewriteEmail": {
    type: "action:rewriteEmail",
    category: "action",
    label: "Rewrite Email",
    description: "Rewrite email subject/body using templates",
    icon: "Mail",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "action:regexReplace": {
    type: "action:regexReplace",
    category: "action",
    label: "Regex Replace",
    description: "Apply regex replacement to an email field",
    icon: "Code",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { field: "textBody", pattern: "", replacement: "", flags: "g" },
  },
  "action:aiRewrite": {
    type: "action:aiRewrite",
    category: "action",
    label: "AI Rewrite",
    description: "Rewrite or extract content using AI",
    icon: "Brain",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { writeTarget: "variables", fields: ["subject", "textBody"], outputVariableKeys: [], prompt: "", resultVariable: "" },
  },
  "action:setTags": {
    type: "action:setTags",
    category: "action",
    label: "Set Tags",
    description: "Add/remove/set email tags",
    icon: "Tag",
    color: "#10b981",
    inputs: 1,
    outputs: 1,
    defaultData: { mode: "add", tags: [] },
  },

  // 转发
  "forward:email": {
    type: "forward:email",
    category: "forward",
    label: "Forward Email",
    description: "Forward to email address",
    icon: "Send",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: { to: "" },
  },
  "forward:telegram-bound": {
    type: "forward:telegram-bound",
    category: "forward",
    label: "Telegram Group (Bound)",
    description: "Forward to your bound Telegram forum group",
    icon: "MessageCircle",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: {},
  },
  "forward:telegram": {
    type: "forward:telegram",
    category: "forward",
    label: "Send to Telegram",
    description: "Send notification to Telegram",
    icon: "MessageCircle",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: { token: "", chatId: "" },
  },
  "forward:discord": {
    type: "forward:discord",
    category: "forward",
    label: "Send to Discord",
    description: "Send notification to Discord",
    icon: "MessageSquare",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: { webhookUrl: "" },
  },
  "forward:slack": {
    type: "forward:slack",
    category: "forward",
    label: "Send to Slack",
    description: "Send notification to Slack",
    icon: "Hash",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: { webhookUrl: "" },
  },
  "forward:webhook": {
    type: "forward:webhook",
    category: "forward",
    label: "Webhook",
    description: "Call custom webhook",
    icon: "Webhook",
    color: "#8b5cf6",
    inputs: 1,
    outputs: 1,
    defaultData: { url: "", method: "POST" },
  },

  // 流程控制
  "control:branch": {
    type: "control:branch",
    category: "control",
    label: "Branch",
    description: "Conditional branching",
    icon: "GitBranch",
    color: "#6366f1",
    inputs: 1,
    outputs: "conditional",
    defaultData: { condition: { field: "subject", operator: "contains", value: "" } },
  },
  "control:delay": {
    type: "control:delay",
    category: "control",
    label: "Delay",
    description: "Wait for specified duration",
    icon: "Timer",
    color: "#6366f1",
    inputs: 1,
    outputs: 1,
    defaultData: { duration: 60 },
  },
  "control:end": {
    type: "control:end",
    category: "control",
    label: "End",
    description: "End workflow execution",
    icon: "CircleStop",
    color: "#6366f1",
    inputs: 1,
    outputs: 0,
    defaultData: {},
  },
};

// ==================== 工具函数类型 ====================

// 字段标签映射
export const MATCH_FIELD_LABELS: Record<MatchField, string> = {
  subject: "Subject",
  fromAddress: "From Address",
  fromName: "From Name",
  toAddress: "To Address",
  textBody: "Body (Text)",
  htmlBody: "Body (HTML)",
  messageId: "Message ID",
  replyTo: "Reply-To",
};

// 操作符标签映射
export const MATCH_OPERATOR_LABELS: Record<MatchOperator, string> = {
  contains: "Contains",
  notContains: "Does not contain",
  equals: "Equals",
  notEquals: "Does not equal",
  startsWith: "Starts with",
  endsWith: "Ends with",
  regex: "Matches regex",
  isEmpty: "Is empty",
  isNotEmpty: "Is not empty",
};

// 需要值的操作符
export const VALUE_OPERATORS: MatchOperator[] = [
  "contains",
  "notContains",
  "equals",
  "notEquals",
  "startsWith",
  "endsWith",
  "regex",
];

export function getNodeCategory(type: NodeType): string {
  return type.split(":")[0];
}

export function isConditionalNode(type: NodeType): boolean {
  const def = NODE_DEFINITIONS[type];
  return def?.outputs === "conditional";
}

export function isTriggerNode(type: NodeType): boolean {
  return type.startsWith("trigger:");
}

export function createDefaultNode(type: NodeType, position: { x: number; y: number }): WorkflowNode {
  const def = NODE_DEFINITIONS[type];
  return {
    id: `${type}-${Date.now()}`,
    type,
    position,
    data: { ...def.defaultData, label: def.label },
  };
}

export function createEmptyWorkflowConfig(): WorkflowConfig {
  return {
    version: 1,
    nodes: [],
    edges: [],
  };
}
