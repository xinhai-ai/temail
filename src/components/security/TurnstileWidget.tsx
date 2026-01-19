"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const onLoad = () => resolve();
      const onError = () => reject(new Error("Failed to load Turnstile"));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Turnstile")), { once: true });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
  resetKey,
  className,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  resetKey?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled) return;
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const safeOnToken = useCallback(
    (token: string | null) => {
      onToken(token);
    },
    [onToken]
  );

  useEffect(() => {
    if (!ready) return;
    const container = containerRef.current;
    const turnstile = window.turnstile;
    if (!container || !turnstile) return;

    safeOnToken(null);

    if (widgetIdRef.current) {
      try {
        turnstile.remove(widgetIdRef.current);
      } catch {
        // ignore
      }
      widgetIdRef.current = null;
    }

    container.innerHTML = "";

    const id = turnstile.render(container, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token) => safeOnToken(token),
      "expired-callback": () => safeOnToken(null),
      "error-callback": () => safeOnToken(null),
    });

    widgetIdRef.current = id;

    return () => {
      if (widgetIdRef.current) {
        try {
          turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [ready, safeOnToken, siteKey]);

  useEffect(() => {
    if (!ready) return;
    const id = widgetIdRef.current;
    const turnstile = window.turnstile;
    if (!id || !turnstile) return;
    try {
      turnstile.reset(id);
    } catch {
      // ignore
    }
  }, [ready, resetKey]);

  if (loadError) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
          className
        )}
      >
        Failed to load Turnstile. Please disable ad blockers or try again.
      </div>
    );
  }

  return <div ref={containerRef} className={cn("min-h-[68px]", className)} />;
}
