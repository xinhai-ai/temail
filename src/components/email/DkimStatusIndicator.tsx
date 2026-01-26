"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isVercelDeployment } from "@/lib/deployment/public";

type DkimUiStatus = "correct" | "error" | "unknown";

type DkimUiSignature = {
  signingDomain: string;
  selector?: string;
  result: string;
  comment?: string;
  info?: string;
};

type DkimUiResult = {
  status: DkimUiStatus;
  summary: string;
  headerFrom?: string[];
  signatures?: DkimUiSignature[];
  error?: string;
};

const DEFAULT_LOADING: DkimUiResult = {
  status: "unknown",
  summary: "DKIM: Checking...",
};

const DKIM_CLIENT_CACHE_TTL_MS = 5 * 60_000;
const DKIM_CLIENT_CACHE_MAX_ENTRIES = 500;
const dkimClientCache = new Map<string, { expiresAt: number; value: DkimUiResult }>();
const dkimClientInFlight = new Map<string, Promise<DkimUiResult>>();
const DKIM_DISABLED = isVercelDeployment();

function peekCachedClientResult(emailId: string): DkimUiResult | null {
  const cached = dkimClientCache.get(emailId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) return null;
  return cached.value;
}

function getCachedClientResult(emailId: string): DkimUiResult | null {
  const value = peekCachedClientResult(emailId);
  if (value) return value;
  dkimClientCache.delete(emailId);
  return null;
}

function setCachedClientResult(emailId: string, value: DkimUiResult) {
  const now = Date.now();
  dkimClientCache.set(emailId, { expiresAt: now + DKIM_CLIENT_CACHE_TTL_MS, value });

  if (dkimClientCache.size <= DKIM_CLIENT_CACHE_MAX_ENTRIES) return;

  for (const [key, entry] of dkimClientCache) {
    if (entry.expiresAt <= now) dkimClientCache.delete(key);
  }
  while (dkimClientCache.size > DKIM_CLIENT_CACHE_MAX_ENTRIES) {
    const firstKey = dkimClientCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    dkimClientCache.delete(firstKey);
  }
}

async function fetchDkim(emailId: string) {
  const cached = getCachedClientResult(emailId);
  if (cached) return cached;

  const existing = dkimClientInFlight.get(emailId);
  if (existing) return existing;

  const promise = fetch(`/api/emails/${emailId}/dkim`)
    .then(async (res) => {
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        return {
          status: "unknown",
          summary: "DKIM: Unknown (failed to load)",
          error: data?.error || `HTTP ${res.status}`,
        } satisfies DkimUiResult;
      }
      return (await res.json()) as DkimUiResult;
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      return {
        status: "unknown",
        summary: "DKIM: Unknown (failed to load)",
        error: message,
      } satisfies DkimUiResult;
    })
    .then((data) => {
      setCachedClientResult(emailId, data);
      return data;
    })
    .finally(() => {
      dkimClientInFlight.delete(emailId);
    });

  dkimClientInFlight.set(emailId, promise);
  return promise;
}

function getIconClassName(status: DkimUiStatus) {
  if (status === "correct") return "text-green-600";
  if (status === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function DkimStatusIndicator({
  emailId,
  className,
  enabled = true,
  deferMs = 0,
}: {
  emailId: string | null;
  className?: string;
  enabled?: boolean;
  deferMs?: number;
}) {
  const [result, setResult] = useState<{ emailId: string; data: DkimUiResult } | null>(null);

  useEffect(() => {
    if (DKIM_DISABLED || !emailId || !enabled) return;

    const cached = getCachedClientResult(emailId);
    if (cached) return;

    let canceled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const run = () => {
      void fetchDkim(emailId).then((data) => {
        if (canceled) return;
        setResult({ emailId, data });
      });
    };

    if (deferMs > 0) {
      timerId = setTimeout(run, deferMs);
    } else {
      const requestIdleCallback = (globalThis as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      if (typeof requestIdleCallback === "function") {
        idleId = requestIdleCallback(run, { timeout: 750 });
      } else {
        timerId = setTimeout(run, 0);
      }
    }

    return () => {
      canceled = true;
      if (timerId !== null) clearTimeout(timerId);
      const cancelIdleCallback = (globalThis as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (idleId !== null && typeof cancelIdleCallback === "function") cancelIdleCallback(idleId);
    };
  }, [deferMs, emailId, enabled]);

  if (DKIM_DISABLED || !emailId) return null;

  const cachedDisplay = peekCachedClientResult(emailId);
  const display = result?.emailId === emailId ? result.data : cachedDisplay ?? DEFAULT_LOADING;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className
          )}
          aria-label={display.summary}
        >
          {display.status === "correct" ? (
            <CheckCircle2 className={cn("h-4 w-4", getIconClassName(display.status))} />
          ) : display.status === "error" ? (
            <XCircle className={cn("h-4 w-4", getIconClassName(display.status))} />
          ) : (
            <AlertCircle className={cn("h-4 w-4", getIconClassName(display.status))} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[420px] whitespace-pre-wrap p-3 text-left leading-snug">
        <div className="font-medium">{display.summary}</div>
        {display.headerFrom?.length ? (
          <div className="mt-1 text-[11px] opacity-90">
            From domain: <span className="font-mono">{display.headerFrom.join(", ")}</span>
          </div>
        ) : null}
        {display.signatures?.length ? (
          <div className="mt-2 space-y-1">
            {display.signatures.map((sig, idx) => (
              <div key={`${sig.signingDomain}:${sig.selector ?? ""}:${idx}`} className="text-[11px]">
                <span className="font-mono">
                  d={sig.signingDomain}
                  {sig.selector ? ` s=${sig.selector}` : ""}
                </span>
                <span className="opacity-90"> · </span>
                <span className="font-mono">dkim={sig.result}</span>
                {sig.comment ? <span className="opacity-90"> ({sig.comment})</span> : null}
              </div>
            ))}
          </div>
        ) : null}
        {display.error ? (
          <div className="mt-2 text-[11px] opacity-90">
            Error: <span className="font-mono">{display.error}</span>
          </div>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
