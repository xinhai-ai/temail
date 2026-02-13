<div align="center">
  <img src="public/logo.svg" alt="TEmail Logo" width="120" height="120">
  <h1>TEmail</h1>
  <p><strong>Self-hosted Email Operations Platform</strong></p>
  <p>A modern, self-hostable platform for inbound email ingestion, automation, routing, and multi-channel delivery across domains.</p>

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
      <img alt="Deploy with Vercel" src="https://vercel.com/button">
    </a>
    <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/xinhai-ai/temail/tree/main/workers/cloudflare-email-forwarder">
      <img alt="Deploy to Cloudflare Workers" src="https://deploy.workers.cloudflare.com/button">
    </a>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-deployment">Deployment</a> •
    <a href="#open-api">Open API</a> •
    <a href="#-documentation">Documentation</a> •
    <a href="#-contributing">Contributing</a>
  </p>

  <p>
    <a href="README.md">English</a> | <a href="README_CN.md">简体中文</a>
  </p>
</div>

---

## Overview

**TEmail** is a self-hosted **email operations and automation platform** that helps you:

- **Receive** emails from multiple domains via Webhook or IMAP
- **Process** emails with powerful workflow automation (visual editor)
- **Distribute** to various channels: Telegram, Slack, Discord, Webhook, and more

Perfect for building notification systems, customer support pipelines, email-to-task automation, and any scenario where you need programmatic access to incoming emails.

### Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Email Sender   │────▶│  Cloudflare Email    │────▶│  CF Worker      │
└─────────────────┘     │  Routing             │     │  (Email Parser) │
                        └──────────────────────┘     └────────┬────────┘
                                                              │ HTTP POST
                        ┌──────────────────────┐              ▼
                        │  IMAP Server         │     ┌─────────────────┐
                        │  (Gmail, etc.)       │────▶│  TEmail         │
                        └──────────────────────┘     │  ┌───────────┐  │
                                                     │  │ Workflows │  │
                                                     │  └───────────┘  │
                        ┌──────────────────────┐     │       │         │
                        │  Database            │◀────│       ▼         │
                        │  (Postgres/SQLite)   │     │  ┌───────────┐  │
                        └──────────────────────┘     │  │ Actions   │  │
                                                     │  └───────────┘  │
                                                     └────────┬────────┘
                                                              │
                 ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
                 ▼                    ▼                       ▼                    ▼                       ▼
          ┌───────────┐        ┌───────────┐          ┌───────────┐        ┌───────────┐          ┌───────────┐
          │ Telegram  │        │   Slack   │          │  Discord  │        │  Webhook  │          │   Email   │
          └───────────┘        └───────────┘          └───────────┘        └───────────┘          └───────────┘
```

---

## Screenshots

<div align="center">
  <table>
    <tr>
      <td align="center" width="50%">
        <img src="docs/images/screenshot-dashboard.jpg" alt="Dashboard" width="100%">
        <br><em>Dashboard - Statistics & Quick Actions</em>
      </td>
      <td align="center" width="50%">
        <img src="docs/images/screenshot-inbox.jpg" alt="Inbox" width="100%">
        <br><em>Inbox - Three-panel Email Management</em>
      </td>
    </tr>
    <tr>
      <td align="center" width="50%">
        <img src="docs/images/screenshot-workflow.jpg" alt="Workflow Editor" width="100%">
        <br><em>Workflow - Visual Automation Editor</em>
      </td>
      <td align="center" width="50%">
        <img src="docs/images/screenshot-telegram-group.jpg" alt="Telegram Integration" width="100%">
        <br><em>Telegram - Forum Group Integration</em>
      </td>
    </tr>
  </table>
  <p>
    <img src="docs/images/screenshot-inbox-mobile.jpg" alt="Mobile View" height="400">
    <br><em>Mobile - Responsive Design</em>
  </p>
</div>

---

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Multi-Domain Inbox** | Manage multiple email domains and mailboxes in one place |
| **Webhook Ingestion** | Receive emails via HTTP webhook (Cloudflare Worker, SendGrid, etc.) |
| **IMAP Sync** | Connect to any IMAP server (Gmail, Outlook, self-hosted) |
| **Visual Workflow Editor** | Drag-and-drop workflow builder with ReactFlow |
| **Multi-Channel Notifications** | Forward to Telegram, Slack, Discord, or custom webhooks |
| **Open API** | RESTful API with granular scopes for integrations and automation |
| **Email Preview** | Shareable preview links with expiration |
| **Full-Text Search** | Search emails by subject, sender, content |
| **Tagging & Labeling** | Organize emails with custom tags |
| **Installable PWA** | Install on desktop/mobile with offline app-shell fallback |

### Workflow Automation

Build powerful email processing pipelines with 20+ node types:

- **Triggers**: Email received, Manual, Scheduled
- **Conditions**: Regex match, Keyword filter, AI classifier
- **Actions**: Archive, Star, Tag, Delete, AI rewrite
- **Forwarding**: Email, Telegram, Slack, Discord, Webhook

> **📖 See [Workflow Guide](docs/WORKFLOW.md) for detailed documentation and examples.**

### Security

| Feature | Description |
|---------|-------------|
| **Passkey Authentication** | WebAuthn/FIDO2 passwordless login |
| **OTP/TOTP** | Two-factor authentication support |
| **RBAC** | Role-based access (Super Admin, Admin, User) |
| **Webhook Signatures** | HMAC-SHA256 signature verification |
| **Rate Limiting** | Built-in API rate limiting |
| **Turnstile** | Cloudflare CAPTCHA integration |

### Admin Dashboard

- User management with role assignment
- System-wide settings and configuration
- Inbound email monitoring and rematch
- Audit logs for compliance
- Telegram bot management

### Telegram Integration

TEmail provides deep Telegram integration for efficient email management on mobile.

#### Forum Group Support

Bind a Telegram **Forum Group (Supergroup with Topics)** to manage all your emails:

| Feature | Description |
|---------|-------------|
| **Auto Topic Creation** | Each mailbox automatically creates a dedicated topic |
| **Real-time Notifications** | New emails instantly forwarded to corresponding topics |
| **Organized Threads** | Emails grouped by mailbox, easy to track conversations |
| **Preview Links** | Click to view full email in browser |

#### Bot Commands

**Private Chat (DM the bot):**

| Command | Description |
|---------|-------------|
| `/start <code>` | Link your TEmail account |
| `/new [domain\|prefix@domain]` | Create a new mailbox |
| `/mailboxes` | List your mailboxes |
| `/emails [mailbox]` | List recent emails |
| `/search <query>` | Search emails |
| `/open <emailId>` | Get a safe preview link |
| `/delete <emailId>` | Move email to Trash |
| `/restore <emailId>` | Restore from Trash |
| `/purge <emailId>` | Permanently delete |
| `/refresh` | Sync inbound emails (IMAP + rematch) |
| `/help` | Show help message |
| `/unlink` | Unlink Telegram account |

**Forum Group:**

| Command | Description |
|---------|-------------|
| `/bind <code>` | Bind group and create General topic |

**Forum Topics:**
- Run commands in **General topic** for global management
- Run commands in **mailbox topics** for per-mailbox operations

#### Workflow Integration

Forward emails to Telegram via workflow nodes:

- **Telegram (Bound)**: Send to your bound forum group with auto topic routing
- **Telegram (Custom)**: Send to any chat/channel with custom bot token
- **Rich Templates**: Customizable message format with Markdown/HTML support

#### Quick Setup

1. Create a Telegram Bot via [@BotFather](https://t.me/BotFather)
2. Create a Forum Group (Supergroup with Topics enabled)
3. Add your bot to the group as admin
4. Configure bot token in TEmail Admin Settings
5. Use `/bindgroup` in your Telegram group
6. Create workflows with `forward:telegram-bound` node

> **💡 Tip**: Forum Groups allow unlimited topics, perfect for managing multiple mailboxes in one place.

---

## User Interface

TEmail features a modern, polished inbox experience designed for productivity and ease of use.

### Inbox Layout

**Three-Panel Design** (Desktop):
- **Left**: Mailbox list with groups, search, and unread counts
- **Center**: Email list with filters, multi-select, and batch actions
- **Right**: Email preview with HTML/text toggle and attachments

**Mobile Optimized**: Tab-based navigation for touch-friendly access

### Dashboard Overview

| Feature | Description |
|---------|-------------|
| **Statistics Cards** | Total mailboxes, emails, unread count, and domains at a glance |
| **Activity Chart** | 7-day email trend visualization |
| **Quick Actions** | One-click mailbox and group creation |
| **Recent Emails** | Latest 5 emails preview |
| **Top Mailboxes** | Most active mailboxes ranking |

### Email Management

| Feature | Description |
|---------|-------------|
| **Smart Filters** | Filter by status (All/Unread/Archived) and tags |
| **Multi-Select Mode** | Batch mark as read, archive, or delete |
| **Right-Click Menus** | Context menus for quick actions on emails and mailboxes |
| **Keyboard Shortcuts** | Efficient navigation and actions |
| **Real-time Updates** | SSE-based live notifications (polling in Vercel mode) |

### Email Preview & Details

| Feature | Description |
|---------|-------------|
| **View Modes** | Toggle between HTML, plain text, and raw RFC 822 |
| **DKIM Status** | Visual indicator for email authentication |
| **Remote Content Control** | Block/allow remote images per sender or domain |
| **Attachments** | Download individual files with size info |
| **Sender Favicon** | Auto-fetch sender domain icons |

### Organization Tools

| Feature | Description |
|---------|-------------|
| **Mailbox Groups** | Organize mailboxes into collapsible folders |
| **Star System** | Star important mailboxes and emails |
| **Custom Tags** | Create and assign colored labels |
| **Notes** | Add notes to mailboxes for reference |
| **Search** | Full-text search across mailboxes and emails |

### Trash Management

- Soft delete with configurable retention (30/90 days or never)
- Restore or permanently delete emails
- Batch operations support

### Notifications

| Feature | Description |
|---------|-------------|
| **Desktop Notifications** | Browser push notifications for new emails |
| **Toast Messages** | Instant feedback for all actions |
| **Unread Badges** | Real-time unread counts on mailboxes |

### Accessibility & i18n

- **Dark/Light Theme**: System preference detection
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Keyboard Navigation**: Full keyboard accessibility
- **Multi-language**: English and Chinese (中文) support

---

## Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | Next.js 16, React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, shadcn/ui, Radix UI |
| **Database** | PostgreSQL, SQLite, LibSQL/Turso (via Prisma) |
| **Auth** | NextAuth v5, WebAuthn, TOTP |
| **Email** | imapflow, mailparser, nodemailer |
| **Workflow** | ReactFlow, Zod validation |
| **i18n** | next-intl (English, Chinese) |
| **Deployment** | Docker, Vercel, Cloudflare Workers |

---

## Quick Start

For most production scenarios, **Docker self-hosted is the recommended path** (full feature set and easier upgrades).
Use Vercel + Cloudflare only when you specifically need a serverless architecture.

### Option 1: Docker Self-Hosted (Recommended)

For full features including IMAP, SMTP forwarding, and file storage.

```bash
# Clone the repository
git clone https://github.com/xinhai-ai/temail.git
cd temail

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker compose pull
docker compose up -d

# View logs
docker compose logs -f
```

Access at `http://localhost:3000`

#### Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `web` | 3000 | Next.js web application |
| `worker` | 3001 | IMAP sync service (optional) |

#### First Admin Setup (Docker)

The bootstrap script automatically creates a super admin when the database is empty:

```bash
# View bootstrap logs
docker compose logs -f web | grep "\[bootstrap\]"

# Or set in .env before starting:
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=your-secure-password
```

#### Super Admin CLI (Email Query / Password Reset)

Use the CLI to query SUPER_ADMIN emails or reset SUPER_ADMIN password:

```bash
# List all SUPER_ADMIN emails
npm run super-admin -- emails

# Reset password for the only SUPER_ADMIN (or fail if multiple exist)
npm run super-admin -- reset-password

# Reset password for a specific SUPER_ADMIN email
npm run super-admin -- reset-password --email admin@example.com

# Set a custom password (otherwise auto-generate and print once)
npm run super-admin -- reset-password --email admin@example.com --password "your-new-password"
```

---

### Option 2: Vercel + Cloudflare (Serverless)

The fastest path for webhook-based serverless deployment.

#### Step 0: Fork to Your Own GitHub Repository (Required)

Before deploying, fork `xinhai-ai/temail` to your own GitHub account and deploy from your fork.
This makes future updates easier through upstream sync.

#### Step 1: Create Neon PostgreSQL Database

[Neon](https://neon.tech) provides serverless PostgreSQL that works perfectly with Vercel.

1. **Create Neon Account**
   - Go to [neon.tech](https://neon.tech) and sign up (free tier available)
   - Click **"Create a project"**

2. **Create Project**
   - Project name: `temail` (or your preferred name)
   - PostgreSQL version: **16** (recommended)
   - Region: Choose closest to your Vercel deployment (e.g., `aws-us-east-1`)
   - Click **"Create project"**

3. **Get Connection String**
   - After creation, you'll see the connection details
   - Copy the **Connection string** (looks like):
     ```
     postgresql://username:password@ep-xxx-xxx-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
   - **Important**: Make sure `?sslmode=require` is included (Neon requires SSL)

4. **Configure Connection Pooling (Recommended)**
   - In Neon Dashboard → **Connection pooling**
   - Enable **Pooled connection**
   - Copy the pooled connection string for better performance:
     ```
     postgresql://username:password@ep-xxx-xxx-123456-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```

> **Tip**: Neon's free tier includes 0.5 GB storage and 190 compute hours/month - sufficient for most use cases.

#### Step 2: Deploy to Vercel

Deploy your **forked repository** with Vercel, then configure these environment variables:

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL connection string (with `?sslmode=require`) |
| `AUTH_SECRET` | ✅ | NextAuth secret (`openssl rand -hex 32`) |
| `AUTH_ENCRYPTION_KEY` | ✅ | Encryption key (`openssl rand -hex 32`) |
| `AUTH_URL` | ✅ | Your app URL (e.g., `https://your-app.vercel.app`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same as AUTH_URL |
| `TEMAIL_DEPLOYMENT_MODE` | ✅ | Set to `vercel` |
| `NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE` | ✅ | Set to `vercel` |
| `BOOTSTRAP_SUPER_ADMIN_SECRET` | ✅ | Secret for first admin registration |
| `BOOTSTRAP_SUPER_ADMIN_MAIL` | ➖ | (Optional) Lock first admin to specific email |

> **Note**: After first deployment, Vercel will automatically run `prisma generate` during build. You need to run database migration manually (see below).

**Run Database Migration** (Required for first deployment):

```bash
# Clone your own fork locally
git clone https://github.com/<your-github-username>/temail.git
cd temail

# Install dependencies
npm ci

# Set your Neon DATABASE_URL
export DATABASE_URL="postgresql://username:password@ep-xxx.neon.tech/neondb?sslmode=require"

# Run migration to create tables
npx prisma migrate deploy
```

Alternatively, you can use Neon's SQL Editor to run migrations, or use `npx prisma db push` for quick setup.

#### Step 3: Create Webhook Domain in TEmail

1. Register as admin using `BOOTSTRAP_SUPER_ADMIN_SECRET`
2. Go to **Domains** → **Add Domain**
3. Set **Source Type** to `Webhook`
4. Copy the generated **Webhook Secret**
5. Create mailboxes under this domain

#### Step 4: Deploy Cloudflare Worker

Click the "Deploy to Cloudflare Workers" button, then set these variables in the Worker:

| Variable | Required | Description |
|----------|:--------:|-------------|
| `TEMAIL_WEBHOOK_URL` | ✅ | `https://your-app.vercel.app/api/webhooks/incoming` |
| `TEMAIL_WEBHOOK_SECRET` | ✅ | Webhook secret from Step 3 |
| `TEMAIL_WEBHOOK_SECRETS` | ➖ | For multi-domain: `{"domain1.com":"secret1","domain2.com":"secret2"}` |
| `TEMAIL_FALLBACK_FORWARD_TO` | ➖ | Fallback email if webhook fails |

#### Step 5: Configure Email Routing

1. In Cloudflare Dashboard → **Email Routing**
2. Enable email routing for your domain
3. Add a routing rule to forward emails to your Worker
4. Send a test email and check TEmail inbox

---

### Option 3: Local Development

```bash
# Prerequisites: Node.js 20+, npm

# Install dependencies
npm ci

# Setup database
npx prisma migrate dev

# Start development server
npm run dev

# Or start with IMAP service
npm run dev:all
```

---

## Deployment

### Deployment Modes

TEmail supports two deployment modes:

| Mode | `TEMAIL_DEPLOYMENT_MODE` | Features |
|------|--------------------------|----------|
| **Default** | `default` or unset | Full features: IMAP, SMTP, raw email storage, DKIM, real-time SSE |
| **Vercel** | `vercel` | Serverless-optimized: Webhook-only, no file storage, polling instead of SSE |

### Feature Comparison

| Feature | Default Mode | Vercel Mode |
|---------|:------------:|:-----------:|
| Webhook Ingestion | ✅ | ✅ |
| IMAP Sync | ✅ | ❌ |
| SMTP Forwarding | ✅ | ❌ |
| Raw Email Storage | ✅ | ❌ |
| DKIM Verification | ✅ | ❌ |
| Real-time Updates | SSE | Polling |
| Attachments | ✅ | ❌ |

---

## Configuration

### Environment Variables

All configuration is done via environment variables. See [`.env.example`](.env.example) for the complete list.

#### Required Variables

```bash
# Database (PostgreSQL recommended for production)
DATABASE_URL="postgresql://user:password@host:5432/temail"

# Authentication
AUTH_SECRET="your-random-secret-32-chars"
AUTH_ENCRYPTION_KEY="your-encryption-key-32-chars"
AUTH_URL="https://your-domain.com"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Deployment mode (vercel or default)
TEMAIL_DEPLOYMENT_MODE="default"
NEXT_PUBLIC_TEMAIL_DEPLOYMENT_MODE="default"
```

#### Optional: SMTP (for email forwarding)

```bash
SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@your-domain.com"
```

#### Optional: IMAP Service

```bash
IMAP_SERVICE_ENABLED=true
IMAP_SERVICE_HOST="localhost"
IMAP_SERVICE_PORT=3001
IMAP_SERVICE_KEY="your-imap-service-key"
NEXTJS_URL="http://localhost:3000"
```

#### Optional: Telegram Bot

```bash
TELEGRAM_BOT_TOKEN="your-bot-token"
TELEGRAM_BOT_USERNAME="your_bot_username"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your_bot_username"
```

#### Optional: Unified Cache (memory / redis)

```bash
# Default is memory
CACHE_MODE="memory"
CACHE_PREFIX="temail"
CACHE_MEMORY_MAX_ENTRIES=10000

# Required when CACHE_MODE=redis
CACHE_REDIS_URL="redis://localhost:6379"
```

---

## API Reference

TEmail provides a comprehensive REST API for all operations.

### Authentication

All API endpoints require authentication via session cookie or API key.

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhooks/incoming` | POST | Receive incoming emails |
| `/api/domains` | GET/POST | List/create domains |
| `/api/mailboxes` | GET/POST | List/create mailboxes |
| `/api/emails` | GET | List emails |
| `/api/emails/[id]` | GET/DELETE | Get/delete email |
| `/api/workflows` | GET/POST | List/create workflows |
| `/api/search` | GET | Search emails |
| `/api/health` | GET | Health check |

### Webhook Payload

Incoming emails should be posted as JSON:

```json
{
  "from": "sender@example.com",
  "to": "recipient@yourdomain.com",
  "subject": "Email Subject",
  "text": "Plain text content",
  "html": "<p>HTML content</p>",
  "headers": {},
  "attachments": []
}
```

Required header: `X-Webhook-Secret: your-webhook-secret`

---

## Open API

TEmail provides an Open API (v1) for programmatic access to your emails and mailboxes. This enables integrations, automation scripts, and third-party applications.

### Getting Started

1. Go to **Settings** → **API** tab
2. Click **Create key** to generate a new API key
3. Select the required scopes (permissions)
4. Copy and securely store the token (shown only once)

### Authentication

Include your API key in requests using either header:

```bash
# Option 1: Authorization header
curl -H "Authorization: Bearer temail_api_v1.<prefix>.<secret>" \
  https://your-domain.com/api/open/v1/mailboxes

# Option 2: X-API-Key header
curl -H "X-API-Key: temail_api_v1.<prefix>.<secret>" \
  https://your-domain.com/api/open/v1/mailboxes
```

### Available Scopes

| Scope | Description |
|-------|-------------|
| `mailboxes:read` | List and view mailboxes |
| `mailboxes:write` | Create, update, delete mailboxes |
| `emails:read` | List and view emails |
| `emails:write` | Update email status, batch operations |
| `emails:raw` | Download RFC822 raw email |
| `emails:attachments` | Download attachments |
| `tags:read` | List tags |
| `tags:write` | Manage email tags |
| `search:read` | Search emails |
| `domains:read` | List available domains |
| `groups:read` | List mailbox groups |
| `groups:write` | Create, update, delete groups |

### API Endpoints

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/open/v1/domains` | GET | `domains:read` | List available domains |
| `/api/open/v1/mailboxes` | GET | `mailboxes:read` | List mailboxes |
| `/api/open/v1/mailboxes` | POST | `mailboxes:write` | Create mailbox |
| `/api/open/v1/mailboxes/{id}` | GET | `mailboxes:read` | Get mailbox details |
| `/api/open/v1/mailboxes/{id}` | PATCH | `mailboxes:write` | Update mailbox |
| `/api/open/v1/mailboxes/{id}` | DELETE | `mailboxes:write` | Delete mailbox |
| `/api/open/v1/mailboxes/{id}/stats` | GET | `mailboxes:read` | Get mailbox statistics |
| `/api/open/v1/emails` | GET | `emails:read` | List emails |
| `/api/open/v1/emails/{id}` | GET | `emails:read` | Get email details |
| `/api/open/v1/emails/{id}` | PATCH | `emails:write` | Update email status |
| `/api/open/v1/emails/{id}` | DELETE | `emails:write` | Move to trash |
| `/api/open/v1/emails/{id}/restore` | POST | `emails:write` | Restore from trash |
| `/api/open/v1/emails/{id}/purge` | DELETE | `emails:write` | Permanently delete |
| `/api/open/v1/emails/{id}/raw` | GET | `emails:raw` | Get RFC822 raw content |
| `/api/open/v1/emails/batch` | POST | `emails:write` | Batch operations |
| `/api/open/v1/groups` | GET | `groups:read` | List groups |
| `/api/open/v1/groups` | POST | `groups:write` | Create group |
| `/api/open/v1/groups/{id}` | GET | `groups:read` | Get group with mailboxes |
| `/api/open/v1/groups/{id}` | PATCH | `groups:write` | Update group |
| `/api/open/v1/groups/{id}` | DELETE | `groups:write` | Delete group |
| `/api/open/v1/tags` | GET | `tags:read` | List tags |
| `/api/open/v1/search/emails` | GET | `search:read` | Search emails |

### Example: Create Mailbox

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "support", "domainId": "clx123abc"}' \
  https://your-domain.com/api/open/v1/mailboxes
```

### Example: Batch Mark as Read

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation": "mark_read", "emailIds": ["id1", "id2", "id3"]}' \
  https://your-domain.com/api/open/v1/emails/batch
```

> **📖 See [Open API Documentation (中文)](docs/OPEN_API_CN.md) for complete API reference with detailed examples.**

---

## Project Structure

```
temail/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Authentication pages
│   │   ├── (dashboard)/       # User dashboard
│   │   ├── (admin)/           # Admin panel
│   │   └── api/               # API routes (80+ endpoints)
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   └── email/            # Email-specific components
│   ├── lib/                   # Utilities and helpers
│   │   ├── workflow/         # Workflow types and utils
│   │   ├── storage/          # File storage abstraction
│   │   └── realtime/         # SSE/polling implementation
│   └── services/              # Business logic
│       ├── imap/             # IMAP sync service
│       ├── telegram/         # Telegram integration
│       └── workflow/         # Workflow execution engine
├── prisma/                    # Database schemas
│   ├── schema.prisma         # SQLite schema
│   └── schema-pg.prisma      # PostgreSQL schema
├── workers/                   # Cloudflare Workers
│   └── cloudflare-email-forwarder/
├── scripts/                   # Utility scripts
└── messages/                  # i18n translations
```

---

## FAQ

### Why are IMAP/SMTP/Raw disabled in Vercel mode?

Vercel's serverless environment doesn't support:
- Persistent file storage (required for raw emails and attachments)
- Long-running connections (required for IMAP)
- Background workers (required for scheduled tasks)

For full features, use Docker self-hosted deployment.

### How do I handle attachments with Cloudflare Worker?

In Vercel mode, attachments are not stored. Options:
1. Store attachments in R2/S3 from the Worker, send URLs to webhook
2. Use Docker self-hosted with persistent storage

### Can I use SQLite in production?

SQLite works for small-scale deployments. For production with multiple users, PostgreSQL is recommended for better concurrency and reliability.

### How do I migrate from SQLite to PostgreSQL?

1. Export data from SQLite
2. Update `DATABASE_URL` to PostgreSQL connection string
3. Run `npx prisma migrate deploy`
4. Import data to PostgreSQL

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/your-username/temail.git
cd temail

# Install dependencies
npm ci

# Setup development database
npx prisma migrate dev

# Start development server
npm run dev
```

### Code Style

- TypeScript with strict mode
- 2 spaces indentation
- Double quotes for strings
- Semicolons required
- ESLint for linting: `npm run lint`

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance tasks
refactor: code refactoring
test: add tests
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit with conventional commit message
7. Push and create a Pull Request

---

## Versioning

TEmail follows [Semantic Versioning](https://semver.org/):

- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backward compatible
- **Patch** (0.0.X): Bug fixes, backward compatible

See [VERSIONING.md](VERSIONING.md) for details.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with these amazing open-source projects:

- [Next.js](https://nextjs.org/) - React framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [ReactFlow](https://reactflow.dev/) - Workflow editor
- [NextAuth.js](https://next-auth.js.org/) - Authentication

---

<div align="center">
  <p>
    <a href="https://github.com/xinhai-ai/temail/issues">Report Bug</a> •
    <a href="https://github.com/xinhai-ai/temail/issues">Request Feature</a> •
    <a href="https://github.com/xinhai-ai/temail/discussions">Discussions</a>
  </p>
  <p>Made with by the TEmail Team</p>
</div>
