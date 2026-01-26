import { isVercelDeployment } from "@/lib/deployment/server";

const DEFAULT_TIMEOUT_MS = 10_000;

function getImapServiceUrl(): string {
  const port = process.env.IMAP_SERVICE_PORT || "3001";
  const host = process.env.IMAP_SERVICE_HOST || "localhost";
  return `http://${host}:${port}`;
}

export type ImapServiceStatus = {
  startedAt: string;
  workersCount: number;
  workers: Array<{
    status: string;
    domainId: string;
    domainName: string;
    lastSync?: string;
    lastError?: string;
    consecutiveErrors: number;
    connectedAt?: string;
  }>;
  scheduler: Array<{
    name: string;
    lastRun?: string;
  }>;
};

export type ImapSyncResult = {
  success: boolean;
  message?: string;
  count?: number;
};

export type ImapHealthResult = {
  status: "ok" | "error";
  timestamp?: string;
  error?: string;
};

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    timeout?: number;
  } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const { method = "GET", timeout = DEFAULT_TIMEOUT_MS } = options;
  const url = `${getImapServiceUrl()}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeout),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}` };
    }

    return { ok: true, data: data as T };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError" || error.name === "TimeoutError") {
        return { ok: false, error: "Request timeout" };
      }
      if (error.message.includes("ECONNREFUSED")) {
        return { ok: false, error: "IMAP service unavailable" };
      }
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Unknown error" };
  }
}

export async function checkImapServiceHealth(): Promise<ImapHealthResult> {
  const result = await request<{ status: "ok"; timestamp: string }>("/health", {
    timeout: 3000,
  });

  if (!result.ok) {
    return { status: "error", error: result.error };
  }

  return { status: "ok", timestamp: result.data.timestamp };
}

export async function getImapServiceStatus(): Promise<
  { ok: true; status: ImapServiceStatus } | { ok: false; error: string }
> {
  const result = await request<ImapServiceStatus>("/status");
  if (!result.ok) {
    return result;
  }
  return { ok: true, status: result.data };
}

export async function triggerImapReconcile(): Promise<ImapSyncResult> {
  const result = await request<{ success: boolean; message: string }>("/reconcile", {
    method: "POST",
  });

  if (!result.ok) {
    return { success: false, message: result.error };
  }

  return result.data;
}

export async function syncImapDomain(domainId: string): Promise<ImapSyncResult> {
  const result = await request<{ success: boolean; message: string }>(`/sync/${domainId}`, {
    method: "POST",
  });

  if (!result.ok) {
    return { success: false, message: result.error };
  }

  return result.data;
}

export async function syncAllImapDomains(): Promise<ImapSyncResult> {
  const result = await request<{ success: boolean; count: number }>("/sync/all", {
    method: "POST",
  });

  if (!result.ok) {
    return { success: false, message: result.error };
  }

  return { success: true, count: result.data.count };
}

export function isImapServiceEnabled(): boolean {
  if (isVercelDeployment()) return false;
  // Check if the IMAP service should be used instead of embedded service
  return process.env.IMAP_SERVICE_ENABLED === "1";
}
