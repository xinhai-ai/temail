<div align="center">
  <img src="public/logo.svg" alt="TEmail Logo" width="120" height="120">
  <h1>TEmail</h1>
  <p><strong>可自托管的邮件收件管道</strong></p>
  <p>一个现代化的、可自托管的邮件接收和处理平台，支持多域名收件箱管理、工作流自动化和多渠道通知。</p>

  <p>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg"></a>
    <a href="https://github.com/xinhai-ai/temail/releases"><img alt="Release" src="https://img.shields.io/github/v/release/xinhai-ai/temail?color=blue"></a>
    <a href="https://github.com/xinhai-ai/temail/pkgs/container/temail"><img alt="Docker" src="https://img.shields.io/badge/Docker-ghcr.io-blue?logo=docker"></a>
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black?logo=next.js">
  </p>

  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxinhai-ai%2Ftemail&project-name=temail&repository-name=temail&env=DATABASE_URL%2CAUTH_SECRET%2CAUTH_ENCRYPTION_KEY%2CAUTH_URL%2CNEXT_PUBLIC_APP_URL%2CTEMAIL_DEPLOYMENT_MODE%2CNEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE%2CBOOTSTRAP_SUPER_ADMIN_SECRET%2CBOOTSTRAP_SUPER_ADMIN_MAIL&envLink=https%3A%2F%2Fgithub.com%2Fxinhai-ai%2Ftemail%2Fblob%2Fmain%2F.env.example">
      <img alt="部署到 Vercel" src="https://vercel.com/button">
    </a>
    <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/xinhai-ai/temail/tree/main/workers/cloudflare-email-forwarder">
      <img alt="部署到 Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button">
    </a>
  </p>

  <p>
    <a href="#-功能特性">功能特性</a> •
    <a href="#-快速开始">快速开始</a> •
    <a href="#-部署方式">部署方式</a> •
    <a href="#-配置说明">配置说明</a> •
    <a href="#-贡献指南">贡献指南</a>
  </p>

  <p>
    <a href="README.md">English</a> | <a href="README_CN.md">简体中文</a>
  </p>
</div>

---

## 项目简介

**TEmail** 是一个可自托管的**邮件收件管道**，帮助你：

- **接收**来自多个域名的邮件（通过 Webhook 或 IMAP）
- **处理**邮件（使用强大的可视化工作流编辑器）
- **分发**到各种渠道：Telegram、Slack、Discord、Webhook 等

适用于构建通知系统、客服工单管道、邮件转任务自动化，以及任何需要程序化处理收件的场景。

### 系统架构

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   邮件发送者     │────▶│  Cloudflare Email    │────▶│  CF Worker      │
└─────────────────┘     │  Routing             │     │  (邮件解析器)    │
                        └──────────────────────┘     └────────┬────────┘
                                                              │ HTTP POST
                        ┌──────────────────────┐              ▼
                        │  IMAP 服务器          │     ┌─────────────────┐
                        │  (Gmail 等)          │────▶│  TEmail         │
                        └──────────────────────┘     │  ┌───────────┐  │
                                                     │  │  工作流    │  │
                                                     │  └───────────┘  │
                        ┌──────────────────────┐     │       │         │
                        │  数据库               │◀────│       ▼         │
                        │  (Postgres/SQLite)   │     │  ┌───────────┐  │
                        └──────────────────────┘     │  │   动作     │  │
                                                     │  └───────────┘  │
                                                     └────────┬────────┘
                                                              │
                 ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
                 ▼                    ▼                       ▼                    ▼                       ▼
          ┌───────────┐        ┌───────────┐          ┌───────────┐        ┌───────────┐          ┌───────────┐
          │ Telegram  │        │   Slack   │          │  Discord  │        │  Webhook  │          │   邮件     │
          └───────────┘        └───────────┘          └───────────┘        └───────────┘          └───────────┘
```

---

## 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| **多域名收件箱** | 在一处管理多个邮件域名和邮箱 |
| **Webhook 收件** | 通过 HTTP Webhook 接收邮件（Cloudflare Worker、SendGrid 等） |
| **IMAP 同步** | 连接任意 IMAP 服务器（Gmail、Outlook、自建邮箱） |
| **可视化工作流编辑器** | 基于 ReactFlow 的拖拽式工作流构建器 |
| **多渠道通知** | 转发到 Telegram、Slack、Discord 或自定义 Webhook |
| **邮件预览** | 带过期时间的可分享预览链接 |
| **全文搜索** | 按主题、发件人、内容搜索邮件 |
| **标签管理** | 使用自定义标签整理邮件 |

### 工作流自动化

使用 20+ 种节点类型构建强大的邮件处理管道：

- **触发器**：邮件接收、手动触发、定时触发
- **条件判断**：正则匹配、关键词过滤、AI 分类器
- **执行动作**：归档、星标、打标签、删除、AI 改写
- **转发分发**：邮件、Telegram、Slack、Discord、Webhook

> **📖 详细文档和示例请查看 [工作流指南](docs/WORKFLOW.md)。**

### 安全特性

| 功能 | 说明 |
|------|------|
| **Passkey 认证** | WebAuthn/FIDO2 无密码登录 |
| **OTP/TOTP** | 双因素认证支持 |
| **RBAC 权限** | 基于角色的访问控制（超级管理员、管理员、用户） |
| **Webhook 签名** | HMAC-SHA256 签名验证 |
| **速率限制** | 内置 API 速率限制 |
| **Turnstile** | Cloudflare 验证码集成 |

### 管理后台

- 用户管理与角色分配
- 系统级设置与配置
- 入站邮件监控与重新匹配
- 审计日志（用于合规）
- Telegram Bot 管理

---

## 用户界面

TEmail 拥有现代化、精心打磨的收件箱体验，专为高效和易用而设计。

### 收件箱布局

**三栏设计**（桌面端）：
- **左侧**：邮箱列表，支持分组、搜索和未读计数
- **中间**：邮件列表，支持过滤、多选和批量操作
- **右侧**：邮件预览，支持 HTML/文本切换和附件下载

**移动端优化**：标签页式导航，触控友好

### 仪表盘概览

| 功能 | 说明 |
|------|------|
| **统计卡片** | 一目了然查看邮箱总数、邮件总数、未读数和域名数 |
| **活动图表** | 7 天邮件趋势可视化 |
| **快捷操作** | 一键创建邮箱和分组 |
| **最近邮件** | 最新 5 封邮件预览 |
| **热门邮箱** | 收件最多的邮箱排行 |

### 邮件管理

| 功能 | 说明 |
|------|------|
| **智能过滤** | 按状态（全部/未读/归档）和标签过滤 |
| **多选模式** | 批量标记已读、归档或删除 |
| **右键菜单** | 邮件和邮箱的快捷操作菜单 |
| **键盘快捷键** | 高效的导航和操作 |
| **实时更新** | 基于 SSE 的即时通知（Vercel 模式使用轮询） |

### 邮件预览与详情

| 功能 | 说明 |
|------|------|
| **查看模式** | HTML、纯文本和原始 RFC 822 三种模式切换 |
| **DKIM 状态** | 邮件认证状态可视化指示 |
| **远程内容控制** | 按发件人或域名阻止/允许远程图片 |
| **附件管理** | 下载单个文件，显示文件大小 |
| **发件人图标** | 自动获取发件人域名 favicon |

### 组织工具

| 功能 | 说明 |
|------|------|
| **邮箱分组** | 将邮箱整理到可折叠的文件夹中 |
| **星标系统** | 为重要邮箱和邮件添加星标 |
| **自定义标签** | 创建和分配彩色标签 |
| **备注功能** | 为邮箱添加备注以供参考 |
| **全文搜索** | 在邮箱和邮件中进行全文搜索 |

### 垃圾箱管理

- 软删除，可配置保留期限（30/90 天或永不删除）
- 恢复或永久删除邮件
- 支持批量操作

### 通知系统

| 功能 | 说明 |
|------|------|
| **桌面通知** | 新邮件浏览器推送通知 |
| **Toast 消息** | 所有操作的即时反馈 |
| **未读徽章** | 邮箱上的实时未读计数 |

### 无障碍与国际化

- **深色/浅色主题**：自动检测系统偏好
- **响应式设计**：适配桌面、平板和手机
- **键盘导航**：完整的键盘可访问性
- **多语言支持**：英文和中文（中文）

---

## 技术栈

| 分类 | 技术 |
|------|------|
| **框架** | Next.js 16, React 19, TypeScript 5 |
| **样式** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **数据库** | PostgreSQL, SQLite, LibSQL/Turso（通过 Prisma） |
| **认证** | NextAuth v5, WebAuthn, TOTP |
| **邮件** | imapflow, mailparser, nodemailer |
| **工作流** | ReactFlow, Zod 验证 |
| **国际化** | next-intl（英文、中文） |
| **部署** | Docker, Vercel, Cloudflare Workers |

---

## 快速开始

### 方式一：Vercel + Cloudflare（推荐）

适合无服务器环境的最快部署方式。

#### 第一步：创建 Neon PostgreSQL 数据库

[Neon](https://neon.tech) 提供无服务器 PostgreSQL，与 Vercel 完美配合。

1. **注册 Neon 账号**
   - 访问 [neon.tech](https://neon.tech) 并注册（有免费套餐）
   - 点击 **"Create a project"**

2. **创建项目**
   - 项目名称：`temail`（或你喜欢的名称）
   - PostgreSQL 版本：**16**（推荐）
   - 区域：选择离 Vercel 部署最近的区域（如 `aws-us-east-1`）
   - 点击 **"Create project"**

3. **获取连接字符串**
   - 创建完成后，你会看到连接详情
   - 复制 **Connection string**（格式如下）：
     ```
     postgresql://username:password@ep-xxx-xxx-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - **重要**：确保包含 `?sslmode=require`（Neon 需要 SSL）

4. **配置连接池（推荐）**
   - 在 Neon 控制台 → **Connection pooling**
   - 启用 **Pooled connection**
   - 复制带连接池的连接字符串以获得更好性能：
     ```
     postgresql://username:password@ep-xxx-xxx-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```

> **提示**：Neon 免费套餐包含 0.5 GB 存储和每月 190 计算小时 - 足够大多数使用场景。

#### 第二步：部署到 Vercel

点击上方"部署到 Vercel"按钮，然后配置以下环境变量：

| 变量 | 必需 | 说明 |
|------|:----:|------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL 连接字符串（带 `?sslmode=require`） |
| `AUTH_SECRET` | ✅ | NextAuth 密钥（`openssl rand -hex 32`） |
| `AUTH_ENCRYPTION_KEY` | ✅ | 加密密钥（`openssl rand -hex 32`） |
| `AUTH_URL` | ✅ | 你的应用 URL（如 `https://your-app.vercel.app`） |
| `NEXT_PUBLIC_APP_URL` | ✅ | 同 AUTH_URL |
| `TEMAIL_DEPLOYMENT_MODE` | ✅ | 设置为 `vercel` |
| `NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE` | ✅ | 设置为 `vercel` |
| `BOOTSTRAP_SUPER_ADMIN_SECRET` | ✅ | 首个管理员注册密钥 |
| `BOOTSTRAP_SUPER_ADMIN_MAIL` | ➖ | （可选）限定首个管理员邮箱 |

> **注意**：首次部署后，Vercel 会在构建时自动运行 `prisma generate`。你需要手动运行数据库迁移（见下文）。

**运行数据库迁移**（首次部署必需）：

```bash
# 在本地克隆仓库
git clone https://github.com/xinhai-ai/temail.git
cd temail

# 安装依赖
npm ci

# 设置 Neon DATABASE_URL
export DATABASE_URL="postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require"

# 运行迁移创建表结构
npx prisma migrate deploy
```

或者，你可以使用 Neon 的 SQL 编辑器运行迁移，或使用 `npx prisma db push` 快速设置。

#### 第三步：在 TEmail 中创建 Webhook 域名

1. 使用 `BOOTSTRAP_SUPER_ADMIN_SECRET` 注册管理员账号
2. 进入 **域名管理** → **添加域名**
3. 将 **来源类型** 设置为 `Webhook`
4. 复制生成的 **Webhook Secret**
5. 在该域名下创建邮箱

#### 第四步：部署 Cloudflare Worker

点击"部署到 Cloudflare Workers"按钮，然后在 Worker 中设置以下变量：

| 变量 | 必需 | 说明 |
|------|:----:|------|
| `TEMAIL_WEBHOOK_URL` | ✅ | `https://your-app.vercel.app/api/webhooks/incoming` |
| `TEMAIL_WEBHOOK_SECRET` | ✅ | 第三步中复制的 Webhook Secret |
| `TEMAIL_WEBHOOK_SECRETS` | ➖ | 多域名时使用：`{"domain1.com":"secret1","domain2.com":"secret2"}` |
| `TEMAIL_FALLBACK_FORWARD_TO` | ➖ | Webhook 失败时的备用转发邮箱 |

#### 第五步：配置邮件路由

1. 在 Cloudflare 控制台 → **Email Routing**
2. 为你的域名启用邮件路由
3. 添加路由规则，将邮件转发到你的 Worker
4. 发送测试邮件并在 TEmail 收件箱中查看

---

### 方式二：Docker 自托管

适合需要完整功能（包括 IMAP、SMTP 转发、文件存储）的场景。

```bash
# 克隆仓库
git clone https://github.com/xinhai-ai/temail.git
cd temail

# 配置环境变量
cp .env.example .env
# 编辑 .env 进行配置

# 启动服务
docker compose pull
docker compose up -d

# 查看日志
docker compose logs -f
```

访问 `http://localhost:3000`

#### Docker 服务

| 服务 | 端口 | 说明 |
|------|------|------|
| `web` | 3000 | Next.js Web 应用 |
| `worker` | 3001 | IMAP 同步服务（可选） |

#### 首次管理员设置（Docker）

当数据库为空时，启动脚本会自动创建超级管理员：

```bash
# 查看启动日志
docker compose logs -f web | grep "\[bootstrap\]"

# 或在启动前在 .env 中设置：
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
```

---

### 方式三：本地开发

```bash
# 前置要求：Node.js 20+, npm

# 安装依赖
npm ci

# 初始化数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev

# 或同时启动 IMAP 服务
npm run dev:all
```

---

## 部署方式

### 部署模式

TEmail 支持两种部署模式：

| 模式 | `TEMAIL_DEPLOYMENT_MODE` | 功能 |
|------|--------------------------|------|
| **默认模式** | `default` 或不设置 | 完整功能：IMAP、SMTP、原始邮件存储、DKIM、实时 SSE |
| **Vercel 模式** | `vercel` | 无服务器优化：仅 Webhook、无文件存储、轮询替代 SSE |

### 功能对比

| 功能 | 默认模式 | Vercel 模式 |
|------|:--------:|:-----------:|
| Webhook 收件 | ✅ | ✅ |
| IMAP 同步 | ✅ | ❌ |
| SMTP 转发 | ✅ | ❌ |
| 原始邮件存储 | ✅ | ❌ |
| DKIM 验证 | ✅ | ❌ |
| 实时更新 | SSE | 轮询 |
| 附件存储 | ✅ | ❌ |

---

## 配置说明

### 环境变量

所有配置都通过环境变量完成。完整列表请参阅 [`.env.example`](.env.example)。

#### 必需变量

```bash
# 数据库（生产环境推荐 PostgreSQL）
DATABASE_URL="postgresql://user:password@host:5432/temail"

# 认证
AUTH_SECRET="your-random-secret-32-chars"
AUTH_ENCRYPTION_KEY="your-encryption-key-32-chars"
AUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# 部署模式（vercel 或 default）
TEMAIL_DEPLOYMENT_MODE="default"
NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE="default"
```

#### 可选：SMTP（用于邮件转发）

```bash
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@your-domain.com"
```

#### 可选：IMAP 服务

```bash
IMAP_SERVICE_ENABLED=true
IMAP_SERVICE_HOST="localhost"
IMAP_SERVICE_PORT=3001
IMAP_SERVICE_KEY="your-imap-service-key"
NEXTJS_URL="http://localhost:3000"
```

#### 可选：Telegram Bot

```bash
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_BOT_USERNAME="your_bot_username"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your_bot_username"
```

---

## API 参考

TEmail 提供完整的 REST API。

### 认证

所有 API 端点都需要通过会话 Cookie 或 API Key 进行认证。

### 主要端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/webhooks/incoming` | POST | 接收入站邮件 |
| `/api/domains` | GET/POST | 列出/创建域名 |
| `/api/mailboxes` | GET/POST | 列出/创建邮箱 |
| `/api/emails` | GET | 列出邮件 |
| `/api/emails/[id]` | GET/DELETE | 获取/删除邮件 |
| `/api/workflows` | GET/POST | 列出/创建工作流 |
| `/api/search` | GET | 搜索邮件 |
| `/api/health` | GET | 健康检查 |

### Webhook 请求格式

入站邮件应以 JSON 格式 POST：

```json
{
  "from": "sender@example.com",
  "to": "recipient@yourdomain.com",
  "subject": "邮件主题",
  "text": "纯文本内容",
  "html": "<p>HTML 内容</p>",
  "headers": {},
  "attachments": []
}
```

必需请求头：`X-Webhook-Secret: your-webhook-secret`

---

## 项目结构

```
temail/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 认证页面
│   │   ├── (dashboard)/       # 用户仪表盘
│   │   ├── (admin)/           # 管理后台
│   │   └── api/               # API 路由（80+ 个端点）
│   ├── components/            # React 组件
│   │   ├── ui/               # shadcn/ui 组件
│   │   ├── layout/           # 布局组件
│   │   └── email/            # 邮件相关组件
│   ├── lib/                   # 工具函数和辅助模块
│   │   ├── workflow/         # 工作流类型和工具
│   │   ├── storage/          # 文件存储抽象
│   │   └── realtime/         # SSE/轮询实现
│   └── services/              # 业务逻辑
│       ├── imap/             # IMAP 同步服务
│       ├── telegram/         # Telegram 集成
│       └── workflow/         # 工作流执行引擎
├── prisma/                    # 数据库 Schema
│   ├── schema.prisma         # SQLite Schema
│   └── schema-pg.prisma      # PostgreSQL Schema
├── workers/                   # Cloudflare Workers
│   └── cloudflare-email-forwarder/
├── scripts/                   # 实用脚本
└── messages/                  # 国际化翻译
```

---

## 常见问题

### 为什么 Vercel 模式禁用了 IMAP/SMTP/原始邮件？

Vercel 的无服务器环境不支持：
- 持久文件存储（原始邮件和附件需要）
- 长连接（IMAP 需要）
- 后台 Worker（定时任务需要）

如需完整功能，请使用 Docker 自托管部署。

### Cloudflare Worker 如何处理附件？

在 Vercel 模式下，附件不会被存储。可选方案：
1. 在 Worker 中将附件存储到 R2/S3，然后将 URL 发送到 Webhook
2. 使用 Docker 自托管并启用持久存储

### 生产环境可以使用 SQLite 吗？

SQLite 适用于小规模部署。对于多用户的生产环境，推荐使用 PostgreSQL 以获得更好的并发性能和可靠性。

### 如何从 SQLite 迁移到 PostgreSQL？

1. 从 SQLite 导出数据
2. 将 `DATABASE_URL` 更新为 PostgreSQL 连接字符串
3. 运行 `npx prisma migrate deploy`
4. 将数据导入 PostgreSQL

---

## 贡献指南

我们欢迎贡献！请遵循以下指南：

### 开发环境设置

```bash
# Fork 并克隆仓库
git clone https://github.com/your-username/temail.git
cd temail

# 安装依赖
npm ci

# 初始化开发数据库
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

### 代码风格

- TypeScript 严格模式
- 2 空格缩进
- 双引号字符串
- 必须使用分号
- ESLint 检查：`npm run lint`

### 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: 添加新功能
fix: 修复 Bug
docs: 更新文档
chore: 维护任务
refactor: 代码重构
test: 添加测试
```

### Pull Request 流程

1. Fork 仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 进行修改
4. 运行测试：`npm test`
5. 运行检查：`npm run lint`
6. 使用规范的提交信息提交
7. 推送并创建 Pull Request

---

## 版本管理

TEmail 遵循[语义化版本](https://semver.org/)：

- **Major**（X.0.0）：破坏性变更
- **Minor**（0.X.0）：新功能，向后兼容
- **Patch**（0.0.X）：Bug 修复，向后兼容

详见 [VERSIONING.md](VERSIONING.md)。

---

## 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件。

---

## 致谢

本项目基于以下优秀的开源项目构建：

- [Next.js](https://nextjs.org/) - React 框架
- [Prisma](https://www.prisma.io/) - 数据库 ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [ReactFlow](https://reactflow.dev/) - 工作流编辑器
- [NextAuth.js](https://next-auth.js.org/) - 认证框架

---

<div align="center">
  <p>
    <a href="https://github.com/xinhai-ai/temail/issues">报告 Bug</a> •
    <a href="https://github.com/xinhai-ai/temail/issues">功能建议</a> •
    <a href="https://github.com/xinhai-ai/temail/discussions">讨论区</a>
  </p>
  <p>由 TEmail 团队用心打造</p>
</div>
