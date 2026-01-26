# Cloudflare Email Worker → TEmail Webhook Forwarder

This worker receives inbound emails via **Cloudflare Email Routing (Email Workers)** and forwards a parsed payload to TEmail's webhook endpoint:

`/api/webhooks/incoming`

## Prerequisites

- A deployed TEmail instance (Vercel or self-hosted)
- A Domain configured in TEmail with **Source = Webhook**, and a generated **Webhook Secret**
- Cloudflare Email Routing enabled for your domain

## Configure

Create the worker in Cloudflare and set environment variables:

- `TEMAIL_WEBHOOK_URL` (required)  
  Example: `https://your-app.vercel.app/api/webhooks/incoming`
- `TEMAIL_WEBHOOK_SECRET` (recommended for single domain)  
  The **Domain Webhook Secret** from TEmail.
- `TEMAIL_WEBHOOK_SECRETS` (optional, multi-domain)  
  JSON map from domain to secret, e.g. `{"example.com":"sk_xxx","example.net":"sk_yyy"}`
- `TEMAIL_WEBHOOK_TIMEOUT_MS` (optional, default `10000`)
- `TEMAIL_MAX_TEXT_CHARS` (optional, default `200000`)
- `TEMAIL_MAX_HTML_CHARS` (optional, default `200000`)
- `TEMAIL_FALLBACK_FORWARD_TO` (optional)  
  If webhook delivery fails, forward the email to this address (must be a verified Email Routing destination).

## Deploy (wrangler)

```bash
cd workers/cloudflare-email-forwarder
npm install
npx wrangler deploy
```

Then in Cloudflare Dashboard → Email Routing → Routing rules, route incoming mail to this Worker.

