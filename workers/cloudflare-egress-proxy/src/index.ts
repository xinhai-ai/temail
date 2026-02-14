type Env = {
  WORKER_AUTH_TOKEN?: string;
  WORKER_PROXY_TIMEOUT_MS?: string;
};

type ProxyPayload = {
  targetUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  bodyEncoding?: "utf8" | "base64";
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt((value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10_000;
  return parsed;
}

function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const [scheme, ...rest] = authorization.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

function normalizeMethod(method: string | undefined): string {
  const candidate = (method || "GET").trim().toUpperCase();
  if (ALLOWED_METHODS.has(candidate)) return candidate;
  return "GET";
}

function sanitizeRequestHeaders(input: Record<string, string> | undefined): Headers {
  const headers = new Headers();
  if (!input) return headers;
  for (const [name, value] of Object.entries(input)) {
    const key = String(name || "").trim();
    if (!key) continue;
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, String(value ?? ""));
  }
  return headers;
}

function sanitizeResponseHeaders(input: Headers): Headers {
  const headers = new Headers();
  input.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseProxyPayload(value: unknown): ProxyPayload | null {
  if (!value || typeof value !== "object") return null;
  return value as ProxyPayload;
}

function parseTargetUrl(value: string | undefined): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function buildForwardBody(payload: ProxyPayload, method: string): BodyInit | undefined {
  if (method === "GET" || method === "HEAD") return undefined;
  if (typeof payload.body !== "string") return undefined;
  if (payload.bodyEncoding === "base64") {
    return decodeBase64ToBytes(payload.body);
  }
  return payload.body;
}

async function handleProxyRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const configuredToken = (env.WORKER_AUTH_TOKEN || "").trim();
  if (!configuredToken) {
    return jsonResponse(500, { error: "WORKER_AUTH_TOKEN is not configured" });
  }

  const requestToken = parseBearerToken(request.headers.get("authorization"));
  if (!requestToken || requestToken !== configuredToken) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const payload = parseProxyPayload(await request.json().catch(() => null));
  if (!payload) {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const targetUrl = parseTargetUrl(payload.targetUrl);
  if (!targetUrl) {
    return jsonResponse(400, { error: "targetUrl must be a valid HTTP/HTTPS URL" });
  }

  const method = normalizeMethod(payload.method);
  const headers = sanitizeRequestHeaders(payload.headers);
  const body = buildForwardBody(payload, method);

  const timeoutMs = parseTimeoutMs(env.WORKER_PROXY_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers,
      body,
      redirect: "manual",
      signal: controller.signal,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: sanitizeResponseHeaders(upstream.headers),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream request failed";
    return jsonResponse(502, { error: "Proxy request failed", details: message });
  } finally {
    clearTimeout(timer);
  }
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/proxy") {
      return handleProxyRequest(request, env);
    }
    if (url.pathname === "/healthz") {
      return new Response("ok", { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  },
};

export default worker;
