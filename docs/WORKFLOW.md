# TEmail Workflow Guide

TEmail 的工作流系统让你能够自动化处理收到的邮件。通过可视化编辑器，你可以创建强大的邮件处理管道，实现自动分类、转发、通知等功能。

## 目录

- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [节点类型](#节点类型)
  - [触发器 (Triggers)](#触发器-triggers)
  - [条件判断 (Conditions)](#条件判断-conditions)
  - [执行动作 (Actions)](#执行动作-actions)
  - [转发节点 (Forwards)](#转发节点-forwards)
  - [流程控制 (Controls)](#流程控制-controls)
- [模板语法](#模板语法)
- [实战示例](#实战示例)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)

---

## 快速开始

### 创建你的第一个工作流

1. 登录 TEmail，进入 **Workflows** 页面
2. 点击 **Create Workflow** 按钮
3. 输入工作流名称（如 "通知重要邮件"）
4. 在可视化编辑器中：
   - 从左侧面板拖拽 **Email Trigger** 到画布
   - 拖拽 **Send to Telegram** 节点
   - 用线连接两个节点
   - 配置 Telegram 节点的 Chat ID 和消息模板
5. 点击 **Save** 保存工作流
6. 启用工作流（Enable 开关）

现在，每当收到新邮件，你都会收到 Telegram 通知！

---

## 核心概念

### 工作流结构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Trigger   │────▶│  Condition  │────▶│   Action    │
│  (触发器)    │     │  (条件判断)  │     │  (执行动作)  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Forward   │
                    │  (转发通知)  │
                    └─────────────┘
```

### 执行流程

1. **触发**：工作流由触发器启动（邮件到达、定时、手动）
2. **条件判断**：根据条件决定执行路径
3. **动作执行**：对邮件进行操作（归档、打标签、改写等）
4. **转发通知**：将处理结果发送到外部渠道
5. **结束**：工作流执行完成

### 执行上下文

工作流执行时，以下数据可用于模板：

| 变量 | 说明 |
|------|------|
| `email.id` | 邮件 ID |
| `email.messageId` | 邮件 Message-ID |
| `email.fromAddress` | 发件人邮箱 |
| `email.fromName` | 发件人名称 |
| `email.toAddress` | 收件人邮箱 |
| `email.subject` | 邮件主题 |
| `email.textBody` | 纯文本正文 |
| `email.htmlBody` | HTML 正文 |
| `email.receivedAt` | 接收时间 |
| `email.previewUrl` | 邮件预览链接 |
| `mailbox.id` | 邮箱 ID |
| `mailbox.address` | 邮箱地址 |
| `variables.*` | 工作流变量 |

---

## 节点类型

### 触发器 (Triggers)

触发器是工作流的起点，定义何时启动工作流。

#### Email Trigger（邮件触发器）

当指定邮箱收到新邮件时触发。

```json
{
  "type": "trigger:email",
  "data": {
    "label": "收到新邮件",
    "mailboxId": "可选，限定特定邮箱"
  }
}
```

**配置项**：
- `mailboxId`：（可选）限定触发的邮箱，不填则所有邮箱都触发

#### Schedule Trigger（定时触发器）(暂时不可用)

按 Cron 表达式定时触发。

```json
{
  "type": "trigger:schedule",
  "data": {
    "label": "每日摘要",
    "cron": "0 9 * * *",
    "timezone": "Asia/Shanghai"
  }
}
```

**Cron 表达式示例**：
| 表达式 | 说明 |
|--------|------|
| `0 * * * *` | 每小时整点 |
| `0 9 * * *` | 每天早上 9 点 |
| `0 9 * * 1` | 每周一早上 9 点 |
| `0 0 1 * *` | 每月 1 号凌晨 |
| `*/15 * * * *` | 每 15 分钟 |

#### Manual Trigger（手动触发器）

需要手动点击按钮触发，适用于测试或一次性任务。

```json
{
  "type": "trigger:manual",
  "data": {
    "label": "手动执行"
  }
}
```

---

### 条件判断 (Conditions)

条件节点用于根据邮件内容决定执行路径。

#### Match Condition（匹配条件）

检查邮件字段是否匹配指定模式。

```json
{
  "type": "condition:match",
  "data": {
    "label": "检查发件人",
    "field": "fromAddress",
    "operator": "contains",
    "value": "@github.com",
    "caseSensitive": false
  }
}
```

**可用字段** (`field`)：
| 字段 | 说明 |
|------|------|
| `subject` | 邮件主题 |
| `fromAddress` | 发件人邮箱 |
| `fromName` | 发件人名称 |
| `toAddress` | 收件人邮箱 |
| `textBody` | 纯文本正文 |
| `htmlBody` | HTML 正文 |
| `messageId` | Message-ID |
| `replyTo` | Reply-To 地址 |

**可用操作符** (`operator`)：
| 操作符 | 说明 |
|--------|------|
| `contains` | 包含 |
| `notContains` | 不包含 |
| `equals` | 等于 |
| `notEquals` | 不等于 |
| `startsWith` | 以...开头 |
| `endsWith` | 以...结尾 |
| `regex` | 正则匹配 |
| `isEmpty` | 为空 |
| `isNotEmpty` | 不为空 |

**输出**：
- `true` 出口：条件匹配时走此路径
- `false` 出口：条件不匹配时走此路径

#### Keyword Match（关键词匹配）

检查邮件是否包含指定关键词，支持多分类输出。

**简单模式**（布尔输出）：

```json
{
  "type": "condition:keyword",
  "data": {
    "label": "检测垃圾邮件",
    "keywords": ["unsubscribe", "广告", "促销"],
    "matchType": "any",
    "fields": ["subject", "textBody"],
    "caseSensitive": false
  }
}
```

**多分类模式**（多个输出端口）：

```json
{
  "type": "condition:keyword",
  "data": {
    "label": "邮件分类",
    "categories": ["工作", "账单", "通知", "其他"],
    "keywordSets": [
      {
        "category": "工作",
        "keywords": ["会议", "项目", "deadline"],
        "matchType": "any"
      },
      {
        "category": "账单",
        "keywords": ["发票", "账单", "付款"],
        "matchType": "any"
      },
      {
        "category": "通知",
        "keywords": ["通知", "提醒", "确认"],
        "matchType": "any"
      }
    ],
    "defaultCategory": "其他"
  }
}
```

#### AI Classifier（AI 分类器）

使用 AI 对邮件进行智能分类。

```json
{
  "type": "condition:ai-classifier",
  "data": {
    "label": "AI 智能分类",
    "categories": ["紧急", "重要", "普通", "垃圾"],
    "fields": ["subject", "textBody"],
    "confidenceThreshold": 0.7,
    "defaultCategory": "普通",
    "customPrompt": "请根据邮件内容判断紧急程度..."
  }
}
```

**配置项**：
- `categories`：分类列表，每个分类对应一个输出端口
- `fields`：用于分类的邮件字段
- `confidenceThreshold`：置信度阈值（0-1）
- `defaultCategory`：置信度不足时的默认分类
- `customPrompt`：自定义 AI 提示词

---

### 执行动作 (Actions)

动作节点对邮件进行操作。

#### Archive（归档）

将邮件标记为已归档。

```json
{
  "type": "action:archive",
  "data": { "label": "归档邮件" }
}
```

#### Mark as Read / Unread（标记已读/未读）

```json
{
  "type": "action:markRead",
  "data": { "label": "标记为已读" }
}
```

```json
{
  "type": "action:markUnread",
  "data": { "label": "标记为未读" }
}
```

#### Star / Unstar（星标）

```json
{
  "type": "action:star",
  "data": { "label": "添加星标" }
}
```

#### Delete（删除）

将邮件移至垃圾箱。

```json
{
  "type": "action:delete",
  "data": { "label": "移至垃圾箱" }
}
```

#### Set Variable（设置变量）

设置工作流变量，可在后续节点中使用。

```json
{
  "type": "action:setVariable",
  "data": {
    "label": "保存原始主题",
    "name": "original_subject",
    "value": "{{email.subject}}"
  }
}
```

**用途**：
- 保存原始值供后续使用
- 在节点间传递数据
- 存储 AI 处理结果

#### Set Tags（设置标签）

管理邮件标签。

```json
{
  "type": "action:setTags",
  "data": {
    "label": "添加标签",
    "mode": "add",
    "tags": ["重要", "待处理"]
  }
}
```

**模式** (`mode`)：
- `add`：添加标签（保留现有）
- `remove`：移除指定标签
- `set`：设置标签（替换所有）

#### Rewrite Email（改写邮件）

使用模板改写邮件内容。

```json
{
  "type": "action:rewriteEmail",
  "data": {
    "label": "添加前缀",
    "subject": "[已处理] {{email.subject}}",
    "textBody": "处理时间: {{email.receivedAt}}\n\n{{email.textBody}}"
  }
}
```

**注意**：改写会修改内存中的邮件对象，后续节点看到的是改写后的内容。

#### Regex Replace（正则替换）

对邮件字段进行正则替换。

```json
{
  "type": "action:regexReplace",
  "data": {
    "label": "脱敏手机号",
    "field": "textBody",
    "pattern": "(\\d{3})\\d{4}(\\d{4})",
    "replacement": "$1****$2",
    "flags": "g"
  }
}
```

#### AI Rewrite（AI 改写）

使用 AI 处理邮件内容。

```json
{
  "type": "action:aiRewrite",
  "data": {
    "label": "AI 摘要",
    "writeTarget": "variables",
    "fields": ["subject", "textBody"],
    "prompt": "请提取邮件的关键信息，生成摘要存入 summary，提取待办事项存入 action_items",
    "resultVariable": "ai_result"
  }
}
```

**写入目标** (`writeTarget`)：
- `email`：直接改写邮件内容
- `variables`：写入工作流变量
- `both`：同时写入邮件和变量

---

### 转发节点 (Forwards)

将邮件或通知发送到外部渠道。

#### Forward Email（邮件转发）

将邮件转发到指定邮箱（需配置 SMTP）。

```json
{
  "type": "forward:email",
  "data": {
    "label": "转发给老板",
    "to": "boss@company.com",
    "template": {
      "subject": "[FWD] {{email.subject}}",
      "body": "From: {{email.fromAddress}}\n\n{{email.textBody}}"
    }
  }
}
```

#### Send to Telegram（发送到 Telegram）

```json
{
  "type": "forward:telegram",
  "data": {
    "label": "Telegram 通知",
    "useAppBot": true,
    "chatId": "-1001234567890",
    "template": "📧 *新邮件*\n\n*发件人:* {{email.fromAddress}}\n*主题:* {{email.subject}}",
    "parseMode": "Markdown"
  }
}
```

**配置项**：
- `useAppBot`：使用系统配置的 Bot（推荐）
- `token`：自定义 Bot Token（不推荐，会记录日志）
- `chatId`：目标聊天 ID（群组 ID 以 `-100` 开头）
- `messageThreadId`：话题 ID（用于超级群组）
- `parseMode`：消息格式（`Markdown`、`HTML`、`MarkdownV2`、`None`）

#### Telegram Group (Bound)（绑定的 Telegram 群组）

转发到用户绑定的 Telegram Forum 群组，自动按邮箱创建话题。

```json
{
  "type": "forward:telegram-bound",
  "data": {
    "label": "发送到我的群组",
    "template": "📧 {{email.subject}}\n\n{{email.textBody}}",
    "parseMode": "None"
  }
}
```

**前提条件**：
1. 在 TEmail 设置中绑定 Telegram 群组
2. 群组需开启 Topics 功能

#### Send to Discord（发送到 Discord）

```json
{
  "type": "forward:discord",
  "data": {
    "label": "Discord 通知",
    "webhookUrl": "https://discord.com/api/webhooks/xxx/yyy",
    "template": "📧 **新邮件**\n\n**发件人:** {{email.fromAddress}}\n**主题:** {{email.subject}}",
    "useEmbed": false
  }
}
```

**Discord Embed 示例**：

```json
{
  "type": "forward:discord",
  "data": {
    "webhookUrl": "https://discord.com/api/webhooks/xxx/yyy",
    "useEmbed": true,
    "template": "{\"embeds\":[{\"title\":\"📧 {{email.subject}}\",\"description\":\"{{email.textBody}}\",\"color\":15258703,\"fields\":[{\"name\":\"From\",\"value\":\"{{email.fromAddress}}\",\"inline\":true}]}]}"
  }
}
```

#### Send to Slack（发送到 Slack）

```json
{
  "type": "forward:slack",
  "data": {
    "label": "Slack 通知",
    "webhookUrl": "https://hooks.slack.com/services/xxx/yyy/zzz",
    "template": "📧 *新邮件*\n\n*发件人:* {{email.fromAddress}}\n*主题:* {{email.subject}}"
  }
}
```

#### Webhook（自定义 Webhook）

调用任意 HTTP 接口。

```json
{
  "type": "forward:webhook",
  "data": {
    "label": "调用 API",
    "url": "https://api.example.com/emails",
    "method": "POST",
    "contentType": "application/json",
    "headers": {
      "Authorization": "Bearer {{variables.api_token}}"
    },
    "bodyTemplate": "{\"from\":\"{{email.fromAddress}}\",\"subject\":\"{{email.subject}}\",\"body\":\"{{email.textBody}}\"}"
  }
}
```

**配置项**：
- `method`：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`
- `contentType`：`application/json`、`application/x-www-form-urlencoded`、`text/plain`
- `headers`：自定义请求头
- `bodyTemplate`：请求体模板

**出口代理（全局）**：
- 管理后台 `设置 -> 工作流 -> Webhook 出口模式` 支持：
  - `直连`（默认）
  - `HTTP 代理`
  - `SOCKS 代理`
  - `Cloudflare Worker`（Bearer 鉴权）
- 该设置会统一作用于 `forward:webhook`、Discord、Slack、Feishu、ServerChan 节点的出站请求。

---

### 流程控制 (Controls)

控制工作流的执行流程。

#### Branch（分支）

根据条件分支执行路径。

```json
{
  "type": "control:branch",
  "data": {
    "label": "检查 VIP",
    "condition": {
      "field": "fromAddress",
      "operator": "endsWith",
      "value": "@vip.example.com"
    }
  }
}
```

#### Delay（延迟）

暂停执行指定时间。

```json
{
  "type": "control:delay",
  "data": {
    "label": "等待 5 分钟",
    "duration": 300
  }
}
```

**注意**：`duration` 单位为秒，最大支持 26 小时（93600 秒）。

#### End（结束）

显式结束工作流执行。

```json
{
  "type": "control:end",
  "data": { "label": "结束" }
}
```

---

## 模板语法

TEmail 使用 Mustache 风格的模板语法。

### 基本语法

```
{{variable}}           - 输出变量值
{{email.subject}}      - 访问嵌套属性
{{variables.myVar}}    - 访问工作流变量
```

### 可用变量

#### 邮件变量 (`email.*`)

| 变量 | 类型 | 说明 |
|------|------|------|
| `email.id` | string | 邮件 ID |
| `email.messageId` | string | RFC 822 Message-ID |
| `email.fromAddress` | string | 发件人邮箱 |
| `email.fromName` | string | 发件人名称 |
| `email.toAddress` | string | 收件人邮箱 |
| `email.subject` | string | 邮件主题 |
| `email.textBody` | string | 纯文本正文 |
| `email.htmlBody` | string | HTML 正文 |
| `email.receivedAt` | string | 接收时间（ISO 格式） |
| `email.previewUrl` | string | 邮件预览链接 |
| `email.replyTo` | string | Reply-To 地址 |

#### 邮箱变量 (`mailbox.*`)

| 变量 | 类型 | 说明 |
|------|------|------|
| `mailbox.id` | string | 邮箱 ID |
| `mailbox.address` | string | 邮箱地址 |

#### 工作流变量 (`variables.*`)

工作流执行期间设置的自定义变量。

```
{{variables.original_subject}}
{{variables.ai_result}}
{{variables.custom_data}}
```

### 特殊字符处理

模板中的 JSON 需要转义：

```json
{
  "bodyTemplate": "{\"subject\": \"{{email.subject}}\", \"body\": \"{{email.textBody}}\"}"
}
```

---

## 实战示例

### 示例 1：GitHub 通知转发到 Telegram

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "trigger",
      "type": "trigger:email",
      "position": { "x": 200, "y": 100 },
      "data": { "label": "新邮件" }
    },
    {
      "id": "check-github",
      "type": "condition:match",
      "position": { "x": 200, "y": 250 },
      "data": {
        "label": "检查 GitHub",
        "field": "fromAddress",
        "operator": "contains",
        "value": "@github.com"
      }
    },
    {
      "id": "send-telegram",
      "type": "forward:telegram",
      "position": { "x": 100, "y": 400 },
      "data": {
        "label": "发送 Telegram",
        "useAppBot": true,
        "chatId": "-1001234567890",
        "template": "🐙 *GitHub 通知*\n\n{{email.subject}}",
        "parseMode": "Markdown"
      }
    },
    {
      "id": "archive",
      "type": "action:archive",
      "position": { "x": 100, "y": 550 },
      "data": { "label": "归档" }
    },
    {
      "id": "end",
      "type": "control:end",
      "position": { "x": 200, "y": 700 },
      "data": { "label": "结束" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "check-github" },
    { "id": "e2", "source": "check-github", "sourceHandle": "true", "target": "send-telegram" },
    { "id": "e3", "source": "check-github", "sourceHandle": "false", "target": "end" },
    { "id": "e4", "source": "send-telegram", "target": "archive" },
    { "id": "e5", "source": "archive", "target": "end" }
  ]
}
```

### 示例 2：邮件自动分类打标签

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "trigger",
      "type": "trigger:email",
      "position": { "x": 300, "y": 100 },
      "data": { "label": "新邮件" }
    },
    {
      "id": "classify",
      "type": "condition:keyword",
      "position": { "x": 300, "y": 250 },
      "data": {
        "label": "关键词分类",
        "categories": ["账单", "工作", "社交", "其他"],
        "keywordSets": [
          { "category": "账单", "keywords": ["发票", "账单", "付款", "订单"], "matchType": "any" },
          { "category": "工作", "keywords": ["会议", "项目", "报告", "deadline"], "matchType": "any" },
          { "category": "社交", "keywords": ["邀请", "活动", "聚会"], "matchType": "any" }
        ],
        "defaultCategory": "其他"
      }
    },
    {
      "id": "tag-bill",
      "type": "action:setTags",
      "position": { "x": 100, "y": 450 },
      "data": { "mode": "add", "tags": ["账单", "财务"] }
    },
    {
      "id": "tag-work",
      "type": "action:setTags",
      "position": { "x": 250, "y": 450 },
      "data": { "mode": "add", "tags": ["工作"] }
    },
    {
      "id": "tag-social",
      "type": "action:setTags",
      "position": { "x": 400, "y": 450 },
      "data": { "mode": "add", "tags": ["社交"] }
    },
    {
      "id": "end",
      "type": "control:end",
      "position": { "x": 300, "y": 600 },
      "data": { "label": "结束" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "classify" },
    { "id": "e2", "source": "classify", "sourceHandle": "账单", "target": "tag-bill" },
    { "id": "e3", "source": "classify", "sourceHandle": "工作", "target": "tag-work" },
    { "id": "e4", "source": "classify", "sourceHandle": "社交", "target": "tag-social" },
    { "id": "e5", "source": "classify", "sourceHandle": "其他", "target": "end" },
    { "id": "e6", "source": "tag-bill", "target": "end" },
    { "id": "e7", "source": "tag-work", "target": "end" },
    { "id": "e8", "source": "tag-social", "target": "end" }
  ]
}
```

### 示例 3：AI 摘要 + 转发

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "trigger",
      "type": "trigger:email",
      "position": { "x": 200, "y": 100 },
      "data": { "label": "新邮件" }
    },
    {
      "id": "ai-summary",
      "type": "action:aiRewrite",
      "position": { "x": 200, "y": 250 },
      "data": {
        "label": "AI 生成摘要",
        "writeTarget": "variables",
        "fields": ["subject", "textBody"],
        "prompt": "请用一句话总结这封邮件的核心内容，存入 summary 变量",
        "resultVariable": "ai_result"
      }
    },
    {
      "id": "notify",
      "type": "forward:telegram",
      "position": { "x": 200, "y": 400 },
      "data": {
        "label": "发送摘要",
        "useAppBot": true,
        "chatId": "-1001234567890",
        "template": "📧 *邮件摘要*\n\n来自: {{email.fromAddress}}\n\n*AI 摘要:* {{variables.summary}}\n\n[查看原文]({{email.previewUrl}})",
        "parseMode": "Markdown"
      }
    },
    {
      "id": "end",
      "type": "control:end",
      "position": { "x": 200, "y": 550 },
      "data": { "label": "结束" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "ai-summary" },
    { "id": "e2", "source": "ai-summary", "target": "notify" },
    { "id": "e3", "source": "notify", "target": "end" }
  ]
}
```

---

## 最佳实践

### 1. 工作流设计原则

- **单一职责**：每个工作流只处理一类邮件
- **先过滤后处理**：在执行动作前先用条件过滤
- **使用变量**：保存中间结果到变量，便于调试
- **添加结束节点**：显式结束工作流，便于理解流程

### 2. 性能优化

- **限制触发范围**：在触发器中指定 `mailboxId`
- **简单条件优先**：把简单的 Match 条件放在前面
- **避免死循环**：检查工作流是否可能循环触发

### 3. 安全建议

- **不要硬编码敏感信息**：使用系统设置或变量
- **验证 Webhook URL**：确保目标地址可信
- **测试模式**：先用测试模式验证工作流

### 4. 调试技巧

- **查看执行日志**：在工作流详情页查看历史执行记录
- **使用 Set Variable**：在关键节点保存变量值
- **手动触发测试**：用 Manual Trigger 测试复杂流程

---

## 故障排除

### 常见问题

#### Q: 工作流没有触发？

1. 检查工作流是否已启用（Enable 开关）
2. 检查触发器的 `mailboxId` 配置
3. 确认邮件已正确入库
4. 查看工作流执行日志

#### Q: Telegram 发送失败？

1. 检查 Bot Token 是否正确
2. 确认 Chat ID 格式正确（群组以 `-100` 开头）
3. 确保 Bot 已加入目标群组/频道
4. 检查 Bot 是否有发消息权限

#### Q: 变量值为空？

1. 检查变量名拼写
2. 确认 Set Variable 节点在使用变量的节点之前执行
3. 查看执行日志中的变量输出

#### Q: 条件判断不符合预期？

1. 检查字段名和操作符
2. 注意大小写敏感设置
3. 正则表达式需要正确转义
4. 使用测试模式验证条件

### 执行日志解读

| 状态 | 说明 |
|------|------|
| `success` | 节点执行成功 |
| `failed` | 节点执行失败（查看 message） |
| `skipped` | 节点被跳过（条件不满足） |

### 获取帮助

如果遇到问题，可以：

1. 查看 [GitHub Issues](https://github.com/xinhai-ai/temail/issues)
2. 提交新的 Issue 描述问题
3. 加入社区讨论

---

## 附录：节点类型速查表

| 类型 | 节点 | 说明 |
|------|------|------|
| **触发器** | `trigger:email` | 邮件到达时触发 |
| | `trigger:schedule` | 定时触发 |
| | `trigger:manual` | 手动触发 |
| **条件** | `condition:match` | 字段匹配 |
| | `condition:keyword` | 关键词匹配 |
| | `condition:ai-classifier` | AI 分类 |
| **动作** | `action:archive` | 归档 |
| | `action:markRead` | 标记已读 |
| | `action:markUnread` | 标记未读 |
| | `action:star` | 添加星标 |
| | `action:unstar` | 移除星标 |
| | `action:delete` | 移至垃圾箱 |
| | `action:setVariable` | 设置变量 |
| | `action:setTags` | 设置标签 |
| | `action:rewriteEmail` | 改写邮件 |
| | `action:regexReplace` | 正则替换 |
| | `action:aiRewrite` | AI 改写 |
| **转发** | `forward:email` | 邮件转发 |
| | `forward:telegram` | Telegram 通知 |
| | `forward:telegram-bound` | 绑定的 Telegram 群组 |
| | `forward:discord` | Discord 通知 |
| | `forward:slack` | Slack 通知 |
| | `forward:webhook` | 自定义 Webhook |
| **控制** | `control:branch` | 条件分支 |
| | `control:delay` | 延迟执行 |
| | `control:end` | 结束工作流 |
