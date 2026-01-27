# TEmail Open API（v1）调用文档

本文档描述本项目对外提供的 Open API（邮件相关接口），以及用户如何在系统内创建/管理自己的 API Key。

## 1. 总览

- **API Key 管理（登录态 UI/API）**：`/api/open-api/keys`（需要登录 Cookie；不使用 API Key）
- **Open API v1（对外接口）**：`/api/open/v1/**`（使用 API Key 鉴权）

## 2. 鉴权方式（Open API v1）

你可以任选其一传递 API Key：

- Header：`Authorization: Bearer <token>`
- Header：`X-API-Key: <token>`

其中 `<token>` 格式为：

`temail_api_v1.<keyPrefix>.<secret>`

## 3. Scopes（权限）

创建 API Key 时可指定 scopes。当前支持：

- `mailboxes:read` / `mailboxes:write`
- `emails:read` / `emails:write`
- `emails:raw`（读取 RFC822 原文）
- `emails:attachments`（下载附件）
- `tags:read` / `tags:write`
- `search:read`

## 4. 错误返回约定

除下载类接口外，错误统一返回 JSON：

```json
{ "error": "Unauthorized" }
```

常见状态码：

- `401`：缺少/无效 API Key
- `403`：API Key 被禁用或缺少 scope
- `404`：资源不存在
- `400`：参数不合法

## 5. API Key 管理（登录态）

说明：以下接口用于**登录用户**管理自己的 Key（例如 Dashboard 页面调用），不是对外 Open API。

### 5.1 列表

`GET /api/open-api/keys`

Response：

```json
{
  "keys": [
    {
      "id": "ck...",
      "name": "My Key",
      "keyPrefix": "AbCdEf12",
      "scopes": ["emails:read"],
      "usageCount": 3,
      "lastUsedAt": "2026-01-27T00:00:00.000Z",
      "disabledAt": null,
      "createdAt": "2026-01-27T00:00:00.000Z",
      "updatedAt": "2026-01-27T00:00:00.000Z"
    }
  ]
}
```

### 5.2 创建（仅返回一次明文 token）

`POST /api/open-api/keys`

Body：

```json
{ "name": "My Key", "scopes": ["mailboxes:read", "emails:read"] }
```

Response：

```json
{
  "key": { "...": "..." },
  "token": "temail_api_v1.<keyPrefix>.<secret>"
}
```

### 5.3 更新（禁用/启用、改名、改 scopes）

`PATCH /api/open-api/keys/{id}`

Body（任选字段）：

```json
{ "disabled": true }
```

### 5.4 删除（软删除）

`DELETE /api/open-api/keys/{id}`

## 6. 邮件 Open API v1（对外）

Base：`/api/open/v1`

### 6.1 Mailboxes

#### 6.1.1 列表

`GET /mailboxes`（scope：`mailboxes:read`）

Query：
- `search`（可选）

#### 6.1.2 创建

`POST /mailboxes`（scope：`mailboxes:write`）

Body：

```json
{ "prefix": "foo", "domainId": "ck...", "note": "optional" }
```

#### 6.1.3 详情 / 更新 / 删除

- `GET /mailboxes/{id}`（`mailboxes:read`）
- `PATCH /mailboxes/{id}`（`mailboxes:write`）
- `DELETE /mailboxes/{id}`（`mailboxes:write`）

### 6.2 Emails

#### 6.2.1 列表

`GET /emails`（scope：`emails:read`）

Query（与 UI 内部接口类似）：
- `search`
- `status`：`UNREAD|READ|ARCHIVED|DELETED`
- `excludeArchived=true`
- `mailboxId`
- `tagId`
- 分页：`mode=cursor&cursor=...` 或 `page=1&limit=20`

#### 6.2.2 详情 / 更新 / 移入回收站

- `GET /emails/{id}`（`emails:read`）※Open API 的 GET 不会自动把 UNREAD 改成 READ
- `PATCH /emails/{id}`（`emails:write`，支持 `status`/`isStarred`）
- `DELETE /emails/{id}`（`emails:write`，语义：移入回收站）

#### 6.2.3 恢复 / 永久删除

- `POST /emails/{id}/restore`（`emails:write`）
- `DELETE /emails/{id}/purge`（`emails:write`）

#### 6.2.4 RFC822 原文

`GET /emails/{id}/raw`（scope：`emails:raw`）

注意：在 `vercel` 部署模式下该接口会返回 `404`（无文件系统持久化）。

#### 6.2.5 附件下载

`GET /emails/{id}/attachments/{attachmentId}`（scope：`emails:attachments`）

返回为二进制流，带 `Content-Disposition`。

### 6.3 Tags

- `GET /tags`（`tags:read`）
- `GET /emails/{id}/tags`（`tags:read`）
- `PATCH /emails/{id}/tags`（`tags:write`，支持 `add`/`remove`）

### 6.4 Search

`GET /search/emails`（scope：`search:read`）

Query：
- `q`（必填）
- `mailboxId` / `tagId` / `status` / `excludeArchived`
- 分页：`mode=cursor&cursor=...` 或 `mode=page&page=1&limit=20`

## 7. 环境变量（建议）

建议在生产环境设置 pepper（用于哈希 API Key）：

- `OPEN_API_KEY_PEPPER`：强随机字符串（如果未设置，会回退到 `AUTH_SECRET`）

