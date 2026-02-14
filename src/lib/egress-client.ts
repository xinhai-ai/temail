import "server-only";

import fetchWithNodeAgent from "node-fetch";
import type { BodyInit as NodeFetchBodyInit, RequestInit as NodeFetchRequestInit } from "node-fetch";
import { DEFAULT_EGRESS_TIMEOUT_MS, validateEgressUrl } from "@/lib/egress";
import { getSystemSettingValue } from "@/services/system-settings";
import { ProxyAgent as NodeProxyAgent } from "proxy-agent";
import { ProxyAgent as UndiciProxyAgent, type Dispatcher } from "undici";

type EgressMode = "direct" | "http_proxy" | "socks_proxy" | "cloudflare_worker";

type EgressRequestInit = RequestInit & {
  timeoutMs?: number;
};

type WorkerBodyPayload = {
  body?: string;
  bodyEncoding?: "utf8" | "base64";
};

type EgressSettings = {
  mode: EgressMode;
  httpProxyUrl: string;
  socksProxyUrl: string;
  workerUrl: string;
  workerToken: string;
};

const undiciProxyAgentCache = new Map<string, UndiciProxyAgent>();
const nodeProxyAgentCache = new Map<string, NodeProxyAgent>();

function parseEgressMode(value: string | null): EgressMode {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "http_proxy") return "http_proxy";
  if (normalized === "socks_proxy") return "socks_proxy";
  if (normalized === "cloudflare_worker") return "cloudflare_worker";
  return "direct";
}

function normalize(value: string | null): string {
  return (value || "").trim();
}

function toHeadersRecord(headers?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  const next = new Headers(headers);
  next.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function getTimeoutSignal(init: EgressRequestInit): AbortSignal {
  if (init.signal) return init.signal;
  const timeoutMs =
    typeof init.timeoutMs === "number" && init.timeoutMs > 0
      ? init.timeoutMs
      : DEFAULT_EGRESS_TIMEOUT_MS;
  return AbortSignal.timeout(timeoutMs);
}

function getUndiciProxyAgent(proxyUrl: string): UndiciProxyAgent {
  const cached = undiciProxyAgentCache.get(proxyUrl);
  if (cached) return cached;
  const created = new UndiciProxyAgent(proxyUrl);
  undiciProxyAgentCache.set(proxyUrl, created);
  return created;
}

function getNodeProxyAgent(proxyUrl: string): NodeProxyAgent {
  const cached = nodeProxyAgentCache.get(proxyUrl);
  if (cached) return cached;
  const created = new NodeProxyAgent({
    getProxyForUrl: () => proxyUrl,
  });
  nodeProxyAgentCache.set(proxyUrl, created);
  return created;
}

function parseProxyUrl(raw: string, allowedProtocols: string[]): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!allowedProtocols.includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

async function resolveEgressSettings(): Promise<EgressSettings> {
  const [modeRaw, httpProxyRaw, socksProxyRaw, workerUrlRaw, workerTokenRaw] = await Promise.all([
    getSystemSettingValue("workflow_egress_mode"),
    getSystemSettingValue("workflow_egress_http_proxy_url"),
    getSystemSettingValue("workflow_egress_socks_proxy_url"),
    getSystemSettingValue("workflow_egress_worker_url"),
    getSystemSettingValue("workflow_egress_worker_token"),
  ]);

  return {
    mode: parseEgressMode(modeRaw),
    httpProxyUrl: normalize(httpProxyRaw),
    socksProxyUrl: normalize(socksProxyRaw),
    workerUrl: normalize(workerUrlRaw),
    workerToken: normalize(workerTokenRaw),
  };
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function encodeWorkerBody(body: BodyInit | null | undefined): Promise<WorkerBodyPayload> {
  if (body == null) return {};
  if (typeof body === "string") {
    return { body, bodyEncoding: "utf8" };
  }
  if (body instanceof URLSearchParams) {
    return { body: body.toString(), bodyEncoding: "utf8" };
  }
  if (body instanceof Blob) {
    const bytes = new Uint8Array(await body.arrayBuffer());
    return { body: toBase64(bytes), bodyEncoding: "base64" };
  }
  if (body instanceof ArrayBuffer) {
    return { body: toBase64(new Uint8Array(body)), bodyEncoding: "base64" };
  }
  if (ArrayBuffer.isView(body)) {
    return { body: toBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)), bodyEncoding: "base64" };
  }
  throw new Error("Unsupported request body for cloudflare_worker egress mode");
}

async function toNodeFetchBody(body: BodyInit | null | undefined): Promise<NodeFetchBodyInit | undefined> {
  if (body == null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body;
  if (body instanceof Blob) {
    return Buffer.from(await body.arrayBuffer());
  }
  if (body instanceof ArrayBuffer) {
    return Buffer.from(body);
  }
  if (ArrayBuffer.isView(body)) {
    return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  }
  throw new Error("Unsupported request body for socks_proxy egress mode");
}

async function fetchThroughSocksProxy(
  targetUrl: URL,
  proxyUrl: string,
  init: EgressRequestInit
): Promise<Response> {
  const proxy = parseProxyUrl(proxyUrl, ["socks:", "socks4:", "socks4a:", "socks5:", "socks5h:"]);
  if (!proxy) {
    throw new Error("workflow_egress_socks_proxy_url must be a valid SOCKS URL");
  }

  const requestInit: NodeFetchRequestInit = {
    method: init.method,
    headers: toHeadersRecord(init.headers),
    redirect: init.redirect ?? "error",
    signal: getTimeoutSignal(init),
    agent: getNodeProxyAgent(proxy.toString()),
    body: await toNodeFetchBody(init.body),
  };

  const response = await fetchWithNodeAgent(targetUrl.toString(), requestInit);

  const body = await response.arrayBuffer();
  const headers = new Headers();
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchThroughCloudflareWorker(
  targetUrl: URL,
  init: EgressRequestInit,
  settings: EgressSettings
): Promise<Response> {
  const workerUrl = parseProxyUrl(settings.workerUrl, ["http:", "https:"]);
  if (!workerUrl) {
    throw new Error("workflow_egress_worker_url must be a valid HTTP/HTTPS URL");
  }
  if (!settings.workerToken) {
    throw new Error("workflow_egress_worker_token is required in cloudflare_worker mode");
  }

  const requestMethod = (init.method || "GET").toUpperCase();
  const { body, bodyEncoding } = await encodeWorkerBody(init.body);
  const workerPayload = {
    targetUrl: targetUrl.toString(),
    method: requestMethod,
    headers: toHeadersRecord(init.headers),
    body,
    bodyEncoding,
  };

  return fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.workerToken}`,
    },
    redirect: "error",
    signal: getTimeoutSignal(init),
    body: JSON.stringify(workerPayload),
  });
}

export async function egressFetch(input: string | URL, init: EgressRequestInit = {}): Promise<Response> {
  const validated = await validateEgressUrl(input instanceof URL ? input.toString() : input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const settings = await resolveEgressSettings();

  if (settings.mode === "socks_proxy") {
    return fetchThroughSocksProxy(validated.url, settings.socksProxyUrl, init);
  }

  if (settings.mode === "cloudflare_worker") {
    return fetchThroughCloudflareWorker(validated.url, init, settings);
  }

  if (settings.mode === "http_proxy") {
    const proxy = parseProxyUrl(settings.httpProxyUrl, ["http:", "https:"]);
    if (!proxy) {
      throw new Error("workflow_egress_http_proxy_url must be a valid HTTP/HTTPS URL");
    }
    const requestInit: RequestInit & { dispatcher?: Dispatcher } = {
      ...init,
      redirect: init.redirect ?? "error",
      signal: getTimeoutSignal(init),
      dispatcher: getUndiciProxyAgent(proxy.toString()),
    };
    return fetch(validated.url, requestInit);
  }

  return fetch(validated.url, {
    ...init,
    redirect: init.redirect ?? "error",
    signal: getTimeoutSignal(init),
  });
}
