# TEmail Open API（v1）调用文档

本文档描述本项目对外提供的 Open API 接口。

## 1. 总览

- **Open API v1（对外接口）**：`/api/open/v1/**`（使用 API Key 鉴权）
- 所有请求和响应均使用 JSON 格式（除附件下载和 RFC822 原文）

## 2. 鉴权方式

你可以任选其一传递 API Key：

- Header：`Authorization: Bearer <token>`
- Header：`X-API-Key: <token>`

其中 `<token>` 格式为：

```
temail_api_v1.<keyPrefix>.<secret>
```

**示例**：

```bash
curl -H "Authorization: Bearer temail_api_v1.AbCdEf12.your-secret-here" \
  https://your-domain.com/api/open/v1/mailboxes
```

## 3. Scopes（权限）

创建 API Key 时可指定 scopes。当前支持：

| Scope | 说明 |
|-------|------|
| `mailboxes:read` | 读取邮箱列表和详情 |
| `mailboxes:write` | 创建/更新/删除邮箱 |
| `emails:read` | 读取邮件列表和详情 |
| `emails:write` | 更新邮件状态、批量操作 |
| `emails:raw` | 读取 RFC822 原文 |
| `emails:attachments` | 下载附件 |
| `tags:read` | 读取标签 |
| `tags:write` | 管理邮件标签 |
| `search:read` | 搜索邮件 |
| `domains:read` | 读取可用域名 |
| `groups:read` | 读取邮箱分组 |
| `groups:write` | 创建/更新/删除分组 |

## 4. 错误返回约定

除下载类接口外，错误统一返回 JSON：

```json
{ "error": "Unauthorized" }
```

**常见状态码**：

| 状态码 | 说明 |
|--------|------|
| `400` | 参数不合法 |
| `401` | 缺少/无效 API Key |
| `403` | API Key 被禁用或缺少 scope |
| `404` | 资源不存在 |
| `500` | 服务器内部错误 |

**错误响应示例**：

```json
{
  "error": "Mailbox not found"
}
```

---

## 5. Domains API

### 5.1 获取域名列表

`GET /api/open/v1/domains`

**Scope**：`domains:read`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `search` | string | 否 | 按域名搜索 |

**注意**：普通用户只能看到 `isPublic: true` 且 `status: ACTIVE` 的域名。

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/domains"
```

**响应示例**：

```json
{
  "domains": [
    {
      "id": "clx123abc",
      "name": "example.com",
      "status": "ACTIVE",
      "isPublic": true,
      "description": "公共邮件域名"
    },
    {
      "id": "clx456def",
      "name": "mail.example.org",
      "status": "ACTIVE",
      "isPublic": true,
      "description": null
    }
  ]
}
```

---

## 6. Mailboxes API

### 6.1 获取邮箱列表

`GET /api/open/v1/mailboxes`

**Scope**：`mailboxes:read`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `search` | string | 否 | 按地址或备注搜索 |

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/mailboxes?search=test"
```

**响应示例**：

```json
{
  "mailboxes": [
    {
      "id": "clx789ghi",
      "address": "test@example.com",
      "prefix": "test",
      "status": "ACTIVE",
      "note": "测试邮箱",
      "isStarred": false,
      "expiresAt": null,
      "groupId": null,
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z",
      "domain": {
        "id": "clx123abc",
        "name": "example.com"
      },
      "unreadCount": 5
    }
  ]
}
```

### 6.2 创建邮箱

`POST /api/open/v1/mailboxes`

**Scope**：`mailboxes:write`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prefix` | string | 是 | 邮箱前缀（@ 符号前的部分） |
| `domainId` | string | 是 | 域名 ID |
| `note` | string | 否 | 备注（最多 500 字符） |
| `groupId` | string | 否 | 分组 ID |

**请求示例**：

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "hello", "domainId": "clx123abc", "note": "我的邮箱"}' \
  "https://your-domain.com/api/open/v1/mailboxes"
```

**响应示例**：

```json
{
  "mailbox": {
    "id": "clx999xyz",
    "address": "hello@example.com",
    "prefix": "hello",
    "status": "ACTIVE",
    "note": "我的邮箱",
    "isStarred": false,
    "expiresAt": null,
    "groupId": null,
    "createdAt": "2026-01-27T12:00:00.000Z",
    "updatedAt": "2026-01-27T12:00:00.000Z",
    "domain": {
      "id": "clx123abc",
      "name": "example.com"
    }
  }
}
```

### 6.3 获取邮箱详情

`GET /api/open/v1/mailboxes/{id}`

**Scope**：`mailboxes:read`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/mailboxes/clx789ghi"
```

**响应示例**：

```json
{
  "mailbox": {
    "id": "clx789ghi",
    "address": "test@example.com",
    "prefix": "test",
    "status": "ACTIVE",
    "note": "测试邮箱",
    "isStarred": false,
    "expiresAt": null,
    "groupId": null,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z",
    "domain": {
      "id": "clx123abc",
      "name": "example.com"
    },
    "unreadCount": 5
  }
}
```

### 6.4 获取邮箱统计

`GET /api/open/v1/mailboxes/{id}/stats`

**Scope**：`mailboxes:read`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/mailboxes/clx789ghi/stats"
```

**响应示例**：

```json
{
  "stats": {
    "totalEmails": 100,
    "unreadCount": 15,
    "readCount": 75,
    "archivedCount": 8,
    "deletedCount": 2,
    "starredCount": 10,
    "latestEmailAt": "2026-01-27T10:00:00.000Z"
  }
}
```

### 6.5 更新邮箱

`PATCH /api/open/v1/mailboxes/{id}`

**Scope**：`mailboxes:write`

**请求体**（任选字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `note` | string \| null | 备注 |
| `isStarred` | boolean | 是否星标 |
| `status` | string | 状态：`ACTIVE`、`INACTIVE`、`DELETED` |
| `groupId` | string \| null | 分组 ID |

**请求示例**：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isStarred": true, "note": "重要邮箱"}' \
  "https://your-domain.com/api/open/v1/mailboxes/clx789ghi"
```

**响应示例**：

```json
{
  "mailbox": {
    "id": "clx789ghi",
    "address": "test@example.com",
    "prefix": "test",
    "status": "ACTIVE",
    "note": "重要邮箱",
    "isStarred": true,
    "expiresAt": null,
    "groupId": null,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-27T12:30:00.000Z",
    "domain": {
      "id": "clx123abc",
      "name": "example.com"
    }
  }
}
```

### 6.6 删除邮箱

`DELETE /api/open/v1/mailboxes/{id}`

**Scope**：`mailboxes:write`

**请求示例**：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/mailboxes/clx789ghi"
```

**响应示例**：

```json
{
  "success": true
}
```

---

## 7. Groups API

### 7.1 获取分组列表

`GET /api/open/v1/groups`

**Scope**：`groups:read`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/groups"
```

**响应示例**：

```json
{
  "groups": [
    {
      "id": "clxgrp001",
      "name": "工作",
      "color": "#3B82F6",
      "description": "工作相关邮箱",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-01-15T08:00:00.000Z",
      "mailboxCount": 5
    },
    {
      "id": "clxgrp002",
      "name": "个人",
      "color": "#10B981",
      "description": null,
      "createdAt": "2026-01-16T09:00:00.000Z",
      "updatedAt": "2026-01-16T09:00:00.000Z",
      "mailboxCount": 3
    }
  ]
}
```

### 7.2 创建分组

`POST /api/open/v1/groups`

**Scope**：`groups:write`

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 分组名称（最多 100 字符） |
| `color` | string | 否 | 颜色代码（如 `#3B82F6`） |
| `description` | string | 否 | 描述（最多 500 字符） |

**请求示例**：

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "临时邮箱", "color": "#F59E0B", "description": "用于注册"}' \
  "https://your-domain.com/api/open/v1/groups"
```

**响应示例**：

```json
{
  "group": {
    "id": "clxgrp003",
    "name": "临时邮箱",
    "color": "#F59E0B",
    "description": "用于注册",
    "createdAt": "2026-01-27T12:00:00.000Z",
    "updatedAt": "2026-01-27T12:00:00.000Z"
  }
}
```

### 7.3 获取分组详情

`GET /api/open/v1/groups/{id}`

**Scope**：`groups:read`

返回分组详情及其包含的邮箱列表。

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/groups/clxgrp001"
```

**响应示例**：

```json
{
  "group": {
    "id": "clxgrp001",
    "name": "工作",
    "color": "#3B82F6",
    "description": "工作相关邮箱",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-15T08:00:00.000Z",
    "mailboxes": [
      {
        "id": "clx789ghi",
        "address": "work@example.com",
        "prefix": "work",
        "status": "ACTIVE",
        "note": null,
        "domain": {
          "id": "clx123abc",
          "name": "example.com"
        }
      }
    ]
  }
}
```

### 7.4 更新分组

`PATCH /api/open/v1/groups/{id}`

**Scope**：`groups:write`

**请求体**（任选字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 分组名称 |
| `color` | string \| null | 颜色代码 |
| `description` | string \| null | 描述 |

**请求示例**：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "工作邮箱", "color": "#2563EB"}' \
  "https://your-domain.com/api/open/v1/groups/clxgrp001"
```

**响应示例**：

```json
{
  "group": {
    "id": "clxgrp001",
    "name": "工作邮箱",
    "color": "#2563EB",
    "description": "工作相关邮箱",
    "createdAt": "2026-01-15T08:00:00.000Z",
    "updatedAt": "2026-01-27T13:00:00.000Z"
  }
}
```

### 7.5 删除分组

`DELETE /api/open/v1/groups/{id}`

**Scope**：`groups:write`

删除分组后，该分组下的邮箱 `groupId` 会自动置为 `null`。

**请求示例**：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/groups/clxgrp003"
```

**响应示例**：

```json
{
  "success": true
}
```

---

## 8. Emails API

### 8.1 获取邮件列表

`GET /api/open/v1/emails`

**Scope**：`emails:read`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `search` | string | 否 | 按主题或发件人搜索 |
| `status` | string | 否 | 过滤状态：`UNREAD`、`READ`、`ARCHIVED`、`DELETED` |
| `excludeArchived` | boolean | 否 | 是否排除已归档邮件 |
| `mailboxId` | string | 否 | 按邮箱 ID 过滤 |
| `tagId` | string | 否 | 按标签 ID 过滤 |
| `mode` | string | 否 | 分页模式：`cursor` 或 `page`（默认 `page`） |
| `cursor` | string | 否 | 游标（cursor 模式） |
| `page` | number | 否 | 页码（默认 1） |
| `limit` | number | 否 | 每页数量（默认 20，最大 100） |

**请求示例（分页模式）**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails?page=1&limit=20&status=UNREAD"
```

**响应示例（分页模式）**：

```json
{
  "emails": [
    {
      "id": "clxemail001",
      "subject": "欢迎使用 TEmail",
      "fromAddress": "support@temail.app",
      "fromName": "TEmail Support",
      "status": "UNREAD",
      "isStarred": false,
      "deletedAt": null,
      "receivedAt": "2026-01-27T10:30:00.000Z",
      "mailboxId": "clx789ghi",
      "mailbox": {
        "id": "clx789ghi",
        "address": "test@example.com"
      },
      "tags": [
        {
          "id": "clxtag001",
          "name": "重要",
          "color": "#EF4444"
        }
      ],
      "snippet": "感谢您注册 TEmail，这是一封欢迎邮件..."
    }
  ],
  "pagination": {
    "mode": "page",
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

**请求示例（游标模式）**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails?mode=cursor&limit=20"
```

**响应示例（游标模式）**：

```json
{
  "emails": [...],
  "hasMore": true,
  "nextCursor": "clxemail020",
  "pagination": {
    "mode": "cursor",
    "limit": 20,
    "cursor": null,
    "nextCursor": "clxemail020",
    "hasMore": true
  }
}
```

### 8.2 获取邮件详情

`GET /api/open/v1/emails/{id}`

**Scope**：`emails:read`

**注意**：Open API 的 GET 不会自动将 `UNREAD` 改为 `READ`。

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001"
```

**响应示例**：

```json
{
  "email": {
    "id": "clxemail001",
    "subject": "欢迎使用 TEmail",
    "fromAddress": "support@temail.app",
    "fromName": "TEmail Support",
    "toAddresses": ["test@example.com"],
    "ccAddresses": [],
    "textContent": "感谢您注册 TEmail...",
    "htmlContent": "<html>...</html>",
    "status": "UNREAD",
    "isStarred": false,
    "deletedAt": null,
    "restoreStatus": null,
    "receivedAt": "2026-01-27T10:30:00.000Z",
    "mailboxId": "clx789ghi",
    "mailbox": {
      "id": "clx789ghi",
      "address": "test@example.com"
    },
    "attachments": [
      {
        "id": "clxatt001",
        "filename": "welcome.pdf",
        "contentType": "application/pdf",
        "size": 12345
      }
    ],
    "headers": [
      { "name": "Message-ID", "value": "<abc123@temail.app>" }
    ],
    "tags": [
      { "id": "clxtag001", "name": "重要", "color": "#EF4444" }
    ],
    "rawAvailable": true
  }
}
```

### 8.3 更新邮件

`PATCH /api/open/v1/emails/{id}`

**Scope**：`emails:write`

**请求体**（任选字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 状态：`UNREAD`、`READ`、`ARCHIVED`、`DELETED` |
| `isStarred` | boolean | 是否星标 |

**请求示例**：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "READ", "isStarred": true}' \
  "https://your-domain.com/api/open/v1/emails/clxemail001"
```

**响应示例**：

```json
{
  "email": {
    "id": "clxemail001",
    "status": "READ",
    "deletedAt": null,
    "restoreStatus": null,
    "isStarred": true,
    "mailboxId": "clx789ghi"
  }
}
```

### 8.4 移入回收站

`DELETE /api/open/v1/emails/{id}`

**Scope**：`emails:write`

**请求示例**：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001"
```

**响应示例**：

```json
{
  "success": true
}
```

### 8.5 恢复邮件

`POST /api/open/v1/emails/{id}/restore`

**Scope**：`emails:write`

从回收站恢复邮件。

**请求示例**：

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001/restore"
```

**响应示例**：

```json
{
  "email": {
    "id": "clxemail001",
    "status": "READ",
    "deletedAt": null
  }
}
```

### 8.6 永久删除

`DELETE /api/open/v1/emails/{id}/purge`

**Scope**：`emails:write`

永久删除邮件及其附件。

**请求示例**：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001/purge"
```

**响应示例**：

```json
{
  "success": true
}
```

### 8.7 批量操作

`POST /api/open/v1/emails/batch`

**Scope**：`emails:write`

**限制**：单次最多处理 100 封邮件。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `operation` | string | 是 | 操作类型（见下表） |
| `emailIds` | string[] | 是 | 邮件 ID 数组（1-100 个） |

**支持的操作**：

| operation | 说明 |
|-----------|------|
| `mark_read` | 标记已读 |
| `mark_unread` | 标记未读 |
| `archive` | 归档 |
| `delete` | 移入回收站 |
| `restore` | 从回收站恢复 |
| `star` | 加星标 |
| `unstar` | 取消星标 |

**请求示例**：

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "mark_read",
    "emailIds": ["clxemail001", "clxemail002", "clxemail003"]
  }' \
  "https://your-domain.com/api/open/v1/emails/batch"
```

**响应示例**：

```json
{
  "success": true,
  "processed": 3,
  "failed": 0
}
```

**部分失败示例**（当某些 ID 不存在或无权访问时）：

```json
{
  "success": true,
  "processed": 2,
  "failed": 1
}
```

### 8.8 RFC822 原文

`GET /api/open/v1/emails/{id}/raw`

**Scope**：`emails:raw`

返回邮件的 RFC822 原始内容。

**注意**：在 Vercel 部署模式下该接口会返回 `404`（无文件系统持久化）。

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001/raw"
```

**响应**：返回 `text/plain` 格式的原始邮件内容。

### 8.9 附件下载

`GET /api/open/v1/emails/{id}/attachments/{attachmentId}`

**Scope**：`emails:attachments`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  -o welcome.pdf \
  "https://your-domain.com/api/open/v1/emails/clxemail001/attachments/clxatt001"
```

**响应**：返回二进制流，带 `Content-Disposition` 头。

---

## 9. Tags API

### 9.1 获取标签列表

`GET /api/open/v1/tags`

**Scope**：`tags:read`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/tags"
```

**响应示例**：

```json
{
  "tags": [
    { "id": "clxtag001", "name": "重要", "color": "#EF4444" },
    { "id": "clxtag002", "name": "待办", "color": "#F59E0B" }
  ]
}
```

### 9.2 获取邮件标签

`GET /api/open/v1/emails/{id}/tags`

**Scope**：`tags:read`

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/emails/clxemail001/tags"
```

**响应示例**：

```json
{
  "tags": [
    { "id": "clxtag001", "name": "重要", "color": "#EF4444" }
  ]
}
```

### 9.3 管理邮件标签

`PATCH /api/open/v1/emails/{id}/tags`

**Scope**：`tags:write`

**请求体**（任选字段）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `add` | string[] | 要添加的标签 ID 数组 |
| `remove` | string[] | 要移除的标签 ID 数组 |

**请求示例**：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"add": ["clxtag002"], "remove": ["clxtag001"]}' \
  "https://your-domain.com/api/open/v1/emails/clxemail001/tags"
```

**响应示例**：

```json
{
  "tags": [
    { "id": "clxtag002", "name": "待办", "color": "#F59E0B" }
  ]
}
```

---

## 10. Search API

`GET /api/open/v1/search/emails`

**Scope**：`search:read`

**Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `q` | string | 是 | 搜索关键词 |
| `mailboxId` | string | 否 | 按邮箱过滤 |
| `tagId` | string | 否 | 按标签过滤 |
| `status` | string | 否 | 按状态过滤 |
| `excludeArchived` | boolean | 否 | 排除已归档 |
| `mode` | string | 否 | 分页模式：`cursor` 或 `page` |
| `cursor` | string | 否 | 游标 |
| `page` | number | 否 | 页码 |
| `limit` | number | 否 | 每页数量 |

**请求示例**：

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/open/v1/search/emails?q=welcome&limit=10"
```

**响应示例**：

```json
{
  "emails": [
    {
      "id": "clxemail001",
      "subject": "欢迎使用 TEmail",
      "fromAddress": "support@temail.app",
      "fromName": "TEmail Support",
      "status": "UNREAD",
      "isStarred": false,
      "receivedAt": "2026-01-27T10:30:00.000Z",
      "mailbox": {
        "id": "clx789ghi",
        "address": "test@example.com"
      },
      "tags": [],
      "snippet": "感谢您注册 TEmail..."
    }
  ],
  "pagination": {
    "mode": "page",
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

---

## 11. 环境变量

建议在生产环境设置 pepper（用于哈希 API Key）：

```
OPEN_API_KEY_PEPPER=your-strong-random-string
```

如果未设置，会回退到 `AUTH_SECRET`。
