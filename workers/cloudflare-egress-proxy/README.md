# Cloudflare Egress Proxy Worker

This worker is a minimal authenticated HTTP proxy for TEmail workflow webhook egress.

It only proxies outbound requests and does not implement webhook business logic.

## Endpoint

- `POST /proxy`
- Auth: `Authorization: Bearer <WORKER_AUTH_TOKEN>`

Request body:

```json
{
  "targetUrl": "https://api.example.com/hook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"hello\":\"world\"}",
  "bodyEncoding": "utf8"
}
```

`bodyEncoding` can be `utf8` or `base64`.

## Environment Variables

- `WORKER_AUTH_TOKEN` (required): shared bearer token.
- `WORKER_PROXY_TIMEOUT_MS` (optional): upstream timeout in milliseconds, default `10000`.

## Deploy

```bash
cd workers/cloudflare-egress-proxy
npm install
npx wrangler deploy
```

After deploy, configure TEmail admin settings:

- `Webhook Egress Mode`: `Cloudflare Worker`
- `Worker Proxy URL`: your worker URL + `/proxy`
- `Worker Bearer Token`: same as `WORKER_AUTH_TOKEN`
