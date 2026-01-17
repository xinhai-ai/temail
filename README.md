# TEmail

一个自托管的临时邮箱 / 邮件中转平台：支持多域名邮箱收件箱、Webhook/IMAP 收件、转发（SMTP/Webhook 等）与工作流处理。

## 功能概览

- 临时邮箱：创建邮箱、收件箱管理、邮件列表/详情
- 收件源：
  - Webhook：将外部邮件/事件推送到 `/api/webhooks/incoming`
  - IMAP：通过独立的 IMAP Service 同步邮箱到系统
- 转发：支持通过 SMTP/Webhook（以及 UI 中的其它类型占位）将邮件转发到目标
- 工作流：可对收件触发工作流节点执行

## 本地开发（Node.js）

前置要求：Node.js 20+、npm

1) 准备环境变量

```bash
cp .env.example .env
```

2) 安装依赖并初始化数据库

```bash
npm ci
npx prisma migrate dev
```

3) 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`。

## IMAP Service（可选）

IMAP 同步服务是一个独立进程（默认端口 `3001`），用于拉取 IMAP 邮箱并写入数据库，然后通过内部 API 通知 Web 端做实时更新。

本地一键启动（Web + IMAP Service）：

```bash
npm run dev:all
```

仅启动 IMAP Service：

```bash
node --conditions=react-server --import tsx scripts/imap-service.ts
```

常用环境变量：`IMAP_SERVICE_ENABLED`、`IMAP_SERVICE_HOST`、`IMAP_SERVICE_PORT`、`IMAP_SERVICE_KEY`、`NEXTJS_URL`。

## 环境变量

请参考 `.env.example`

## Docker（推荐）

本仓库提供 `Dockerfile` 与 `docker-compose.yml`，支持一条命令启动并持久化 SQLite 数据库。

```bash
cp .env.example .env
docker compose pull
docker compose up -d
```

访问 `http://localhost:3000`。

### 快速下载（仅用镜像部署）

如果你不想 `git clone`，可以直接下载配置文件并使用已发布镜像启动（将 `<OWNER>`/`<REPO>` 替换为你的仓库）：

```bash
wget -O docker-compose.yml https://raw.githubusercontent.com/xinhai-ai/temail/main/docker-compose.yml
wget -O .env.example https://raw.githubusercontent.com/xinhai-ai/temail/main/.env.example
cp .env.example .env
```

### 启用 IMAP Service（Docker Compose）

默认已启用（`docker-compose.yml` 内置 `IMAP_SERVICE_ENABLED=1`；`.env.example` 也以注释形式提供该值）。如需关闭可设为 `0`。

1) 在 `.env` 中确认：

- `IMAP_SERVICE_ENABLED="1"`
- （可选）设置 `IMAP_SERVICE_KEY`，用于限制内部 API 调用

2) `docker-compose.yml` 默认已包含 `imap-service` 服务；Web 容器会通过 `IMAP_SERVICE_HOST=imap-service` 与 IMAP Service 通信。

### 生产部署建议（Compose）

- 使用反向代理（Nginx/Caddy/Traefik）提供 HTTPS，并将 `AUTH_URL` / `NEXT_PUBLIC_APP_URL` 设置为你的公网域名
- 默认使用 SQLite：数据持久化在 compose 的 `temail-data` 卷中（可在 `docker-compose.yml` 调整）
- 升级发布：`docker compose pull && docker compose up -d`（或重新 `--build`）

### 常见问题（Prisma 迁移）

如果你看到 `P3009/P3018`（例如 `no such table: workflow_executions`），通常是因为历史版本曾把某个迁移标记为失败：

- 全新部署（无数据）：直接清空卷重新来一遍：

```bash
docker compose down -v
docker compose up -d
```

- 需要保留数据：先把失败迁移标记为回滚，再重新部署迁移：

```bash
docker compose exec web npx prisma migrate resolve --rolled-back 20260117180000_workflow_execution_logs
docker compose exec web npx prisma migrate deploy
```

## CI（GitHub Actions）

已提供 GitHub Actions 工作流用于在 PR/Push 时构建 Docker 镜像（保证 `docker build` 可通过），并在默认分支推送到 GHCR：

- `ghcr.io/xinhai-ai/temail:latest`（Web）
- `ghcr.io/xinhai-ai/temail:sha-...`（Web）
- `ghcr.io/xinhai-ai/temail-imap-service:latest`（IMAP Service）
- `ghcr.io/xinhai-ai/temail-imap-service:sha-...`（IMAP Service）

## License

MIT，见 `LICENSE`。
