<div align="center">
  <h1>TEmail</h1>
  <p>一个可自托管的「收件 → 处理 → 分发」邮件管道：多域名收件箱、Webhook/IMAP 收件、工作流自动化、可观测日志与集成通知。</p>
  <p>
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-2ea44f.svg"></a>
    <a href="https://github.com/xinhai-ai/temail/pkgs/container/temail"><img alt="GHCR" src="https://img.shields.io/badge/ghcr-temail-blue.svg"></a>
    <a href="VERSIONING.md"><img alt="Versioning" src="https://img.shields.io/badge/versioning-semver-informational.svg"></a>
  </p>
  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxinhai-ai%2Ftemail&project-name=temail&repository-name=temail&env=DATABASE_URL%2CAUTH_SECRET%2CAUTH_ENCRYPTION_KEY%2CAUTH_URL%2CNEXT_PUBLIC_APP_URL%2CTEMAIL_DEPLOYMENT_MODE%2CNEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE%2CBOOTSTRAP_SUPER_ADMIN_SECRET%2CBOOTSTRAP_SUPER_ADMIN_MAIL&envLink=https%3A%2F%2Fgithub.com%2Fxinhai-ai%2Ftemail%2Fblob%2Fmain%2F.env.example">
      <img alt="Deploy with Vercel" src="https://vercel.com/button">
    </a>
    <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/xinhai-ai/temail/tree/main/workers/cloudflare-email-forwarder">
      <img alt="Deploy to Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button">
    </a>
  </p>
  <p>
    <a href="#快速开始vercel--cloudflare-推荐">快速开始</a> ·
    <a href="#部署模式vercel-模式">Vercel 模式</a> ·
    <a href="#docker-compose-自托管">Docker 自托管</a> ·
    <a href="#本地开发">本地开发</a>
  </p>
</div>

---

## 这是什么？

TEmail 专注于 **inbound email pipeline（收件管道）**：

- 你可以为多个域名创建收件箱（mailboxes），将外部邮件通过 **Webhook 或 IMAP** 接入
- 每封邮件进入系统后可以触发 **工作流（Workflow）**：分类、改写、打标签、通知、转发到你的系统
- 提供管理后台与日志：便于审计、排错与运营

> 如果你希望“只要能在 Vercel 上跑”，我们提供了 `vercel` 部署模式：默认以 Webhook 收件为主，禁用不适合 serverless 的能力（详见下文）。

## 功能亮点

- 多域名收件：域名管理、邮箱管理、分组/标签、搜索与预览链接
- Webhook 收件：接入 Cloudflare Worker / 任意邮件网关（推到 `/api/webhooks/incoming`）
- IMAP 收件（可选，自托管）：独立 Worker 进程同步 IMAP 邮箱到系统
- 工作流自动化：可视化节点编排、执行日志、通知与分发
- 集成：Telegram / Slack / Discord / Webhook（HTTP）推送
- 安全：NextAuth（Passkey/OTP）、RBAC、Webhook Secret 校验、速率限制

## 架构（推荐：Vercel + Cloudflare）

```
Email Sender
   ↓
Cloudflare Email Routing
   ↓ (Email Worker)
Cloudflare Worker (parse + forward)
   ↓ (HTTP)
TEmail Webhook: /api/webhooks/incoming
   ↓
Database (Postgres / libsql)
   ↓
TEmail Web UI + Workflows
```

---

## 快速开始：Vercel + Cloudflare（推荐）

这一套适合「不想维护 IMAP Worker / 不想自建 SMTP」，希望快速上线收件管道的场景。

### 1) 一键部署 Web 到 Vercel

点击上方 **Deploy with Vercel** 按钮，然后在 Vercel 中设置环境变量（至少）：

| 变量 | 必需 | 说明 |
|---|---:|---|
| `DATABASE_URL` | ✅ | 推荐 Postgres（生产），不要用本地 `file:./dev.db` |
| `AUTH_SECRET` | ✅ | NextAuth secret（`openssl rand -hex 32`） |
| `AUTH_ENCRYPTION_KEY` | ✅ | 用于加密敏感信息（`openssl rand -hex 32`） |
| `AUTH_URL` | ✅ | 站点 URL（例如 `https://your-app.vercel.app`） |
| `NEXT_PUBLIC_APP_URL` | ✅ | 同上（公开给前端使用） |
| `TEMAIL_DEPLOYMENT_MODE` | ✅ | 设为 `vercel` |
| `NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE` | ✅ | 设为 `vercel` |
| `BOOTSTRAP_SUPER_ADMIN_SECRET` | ✅（推荐） | 首个超管注册用的密钥（见下） |
| `BOOTSTRAP_SUPER_ADMIN_MAIL` | ➕ | 可选：锁定首个超管邮箱 |

> 首个超级管理员：当数据库中 **没有任何用户** 时，注册接口允许携带 `adminSecret`，且等于 `BOOTSTRAP_SUPER_ADMIN_SECRET`（如设置了 `BOOTSTRAP_SUPER_ADMIN_MAIL` 还必须邮箱匹配），即可创建 `SUPER_ADMIN`。

### 2) 在 TEmail 创建 Webhook 域名

部署完成后进入 TEmail（用上一步的方式注册/登录管理员）：

1. 进入 Domain 管理
2. 新建域名，选择 **Source Type = Webhook**
3. 复制生成的 **Webhook Secret**（后面 Cloudflare Worker 需要）
4. 创建/启用 mailbox（例如 `anything@yourdomain.com`）

### 3) 一键部署 Cloudflare Email Worker

点击上方 **Deploy to Cloudflare Workers** 按钮（会打开 Cloudflare 控制台），部署目录：

- `workers/cloudflare-email-forwarder`

在 Worker 环境变量里设置：

| 变量 | 必需 | 说明 |
|---|---:|---|
| `TEMAIL_WEBHOOK_URL` | ✅ | 例如 `https://your-app.vercel.app/api/webhooks/incoming` |
| `TEMAIL_WEBHOOK_SECRET` | ✅（单域名） | 刚才复制的 Domain Webhook Secret |
| `TEMAIL_WEBHOOK_SECRETS` | ➕（多域名） | JSON：`{"example.com":"sk_xxx","example.net":"sk_yyy"}` |
| `TEMAIL_FALLBACK_FORWARD_TO` | ➕ | webhook 失败时转发到备用邮箱（需是已验证的 Email Routing destination） |

### 4) Cloudflare Email Routing 规则

在 Cloudflare Dashboard：

1. Email Routing → 启用你的域名
2. Routing rules → 将匹配到的收件地址路由到该 Worker
3. 发送一封测试邮件到 mailbox，打开 TEmail Inbox 查看

---

## 部署模式：Vercel 模式

当设置 `TEMAIL_DEPLOYMENT_MODE=vercel` 时，系统会对 serverless / 多实例环境做裁剪，避免“看起来可用但线上会炸”的能力：

- ✅ 推荐保留：Webhook 收件、UI/搜索/标签/工作流（非 SMTP）、通知、管理后台等
- ❌ 强制禁用：
  - IMAP（服务集成 + 前端入口）
  - SMTP 发信/SMTP 转发（前端入口 + 工作流 Email Forward）
  - Raw 邮件落盘与展示（无持久文件系统）
  - DKIM（依赖 raw RFC822）
  - Realtime SSE（前端改轮询）

如果你需要 raw/附件持久化、DKIM 或 IMAP，同样可以继续使用 TEmail，但建议走 **Docker 自托管**（并配合对象存储）。

---

## Docker Compose 自托管

适合希望开启完整能力、或需要 IMAP Worker 的场景。

```bash
cp .env.example .env
# 编辑 .env：至少建议设置 AUTH_SECRET / AUTH_ENCRYPTION_KEY / AUTH_URL / NEXT_PUBLIC_APP_URL
docker compose pull
docker compose up -d
```

访问 `http://localhost:3000`。

### 首次启动自动创建管理员（Compose）

Compose 会运行 `node scripts/bootstrap-admin.js`：当数据库里没有用户时自动创建 `SUPER_ADMIN`。

可通过 `.env` 覆盖（记得取消注释）：

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`

查看启动日志：

```bash
docker compose logs -f web | rg "\\[bootstrap\\]"
```

### 启用 IMAP Service（可选）

IMAP Service 是独立进程（默认端口 `3001`），用于拉取 IMAP 并写入数据库。

- 一键启动（Web + IMAP）：`npm run dev:all`
- 仅启动 IMAP Service：`npm run imap:service`

常用环境变量见 `.env.example`：`IMAP_SERVICE_ENABLED`、`IMAP_SERVICE_HOST`、`IMAP_SERVICE_PORT`、`IMAP_SERVICE_KEY`、`NEXTJS_URL` 等。

---

## 本地开发

前置要求：Node.js 20+、npm

```bash
cp .env.example .env
npm ci
npx prisma migrate dev
npm run dev
```

打开 `http://localhost:3000`。

常用命令：

- `npm run lint`
- `npm test`

---

## 配置参考

所有可用环境变量请看 `.env.example`（按功能分组，默认注释）。

常见生产建议：

- 数据库：生产建议 Postgres（`DATABASE_URL=postgresql://...`）
- 反向代理/HTTPS：将 `AUTH_URL` 与 `NEXT_PUBLIC_APP_URL` 设置为公网域名（无尾斜杠）
- Webhook 安全：对每个域名使用独立的 Webhook secret，避免复用

---

## 常见问题（FAQ）

### 为什么 Vercel 模式禁用 raw / DKIM / IMAP？

Vercel 的 serverless/多实例环境通常不提供可靠的持久文件系统，也不保证长连接稳定。raw/DKIM/IMAP 依赖文件落盘与长连接/后台任务，建议用自托管或改造为对象存储 + 后台任务。

### Cloudflare Worker 只转发 text/html，没有附件怎么办？

在 `vercel` 模式下，为保证稳定与成本可控，TEmail 会跳过附件落盘。你可以：

- 在 Worker 侧将附件写入 R2/S3，再把引用（URL/Key）发到 webhook
- 或改用 Docker 自托管并开启持久存储

---

## 贡献与开发规范

- 代码风格：TypeScript strict，2 空格缩进，双引号，分号
- 提交信息：Conventional Commits（例如 `feat:` / `fix:` / `docs:`）

欢迎提交 Issue / PR。

---

## License

MIT，见 `LICENSE`。
