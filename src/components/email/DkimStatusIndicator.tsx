"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

function getIconClassName(status: DkimUiStatus) {
  if (status === "correct") return "text-green-600";
  if (status === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function DkimStatusIndicator({
  emailId,
  className,
}: {
  emailId: string | null;
  className?: string;
}) {
  const [result, setResult] = useState<{ emailId: string; data: DkimUiResult } | null>(null);

  useEffect(() => {
    if (!emailId) return;

    const controller = new AbortController();

    fetch(`/api/emails/${emailId}/dkim`, { signal: controller.signal })
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
      .then((data) => {
        setResult({ emailId, data });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        setResult({
          emailId,
          data: { status: "unknown", summary: "DKIM: Unknown (failed to load)", error: message },
        });
      });

    return () => controller.abort();
  }, [emailId]);

  if (!emailId) return null;

  const display = result?.emailId === emailId ? result.data : DEFAULT_LOADING;

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
