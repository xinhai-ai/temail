"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MIN_VISIBLE_MS = 250;
const INCREMENT_INTERVAL_MS = 250;
const MAX_AUTO_PROGRESS = 90;
const FINISH_FADE_MS = 200;
const SAFETY_TIMEOUT_MS = 15000;

type Status = "idle" | "loading" | "finishing";

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;

  try {
    const nextUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);
    if (nextUrl.origin !== currentUrl.origin) return false;
    if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const statusRef = useRef<Status>("idle");
  const mountedRef = useRef(false);
  const startTimeRef = useRef(0);
  const prefersReducedMotionRef = useRef(false);

  const incrementIntervalIdRef = useRef<number | null>(null);
  const finishTimeoutIdRef = useRef<number | null>(null);
  const hideTimeoutIdRef = useRef<number | null>(null);
  const safetyTimeoutIdRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (incrementIntervalIdRef.current !== null) {
      window.clearInterval(incrementIntervalIdRef.current);
      incrementIntervalIdRef.current = null;
    }
    if (finishTimeoutIdRef.current !== null) {
      window.clearTimeout(finishTimeoutIdRef.current);
      finishTimeoutIdRef.current = null;
    }
    if (hideTimeoutIdRef.current !== null) {
      window.clearTimeout(hideTimeoutIdRef.current);
      hideTimeoutIdRef.current = null;
    }
    if (safetyTimeoutIdRef.current !== null) {
      window.clearTimeout(safetyTimeoutIdRef.current);
      safetyTimeoutIdRef.current = null;
    }
  };

  const scheduleStart = () => {
    if (!mountedRef.current) return;
    start();
  };

  const start = () => {
    if (statusRef.current === "loading") return;

    clearTimers();
    statusRef.current = "loading";
    startTimeRef.current = performance.now();

    setVisible(true);
    setProgress(prefersReducedMotionRef.current ? 50 : 15);

    safetyTimeoutIdRef.current = window.setTimeout(() => {
      if (statusRef.current !== "loading") return;
      finish();
    }, SAFETY_TIMEOUT_MS);

    if (prefersReducedMotionRef.current) return;

    incrementIntervalIdRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (statusRef.current !== "loading") return prev;
        if (prev >= MAX_AUTO_PROGRESS) return prev;
        const remaining = MAX_AUTO_PROGRESS - prev;
        const next = prev + Math.max(0.5, remaining * 0.12);
        return Math.min(MAX_AUTO_PROGRESS, next);
      });
    }, INCREMENT_INTERVAL_MS);
  };

  const finish = () => {
    if (statusRef.current === "idle") return;
    if (statusRef.current === "finishing") return;

    statusRef.current = "finishing";
    if (incrementIntervalIdRef.current !== null) {
      window.clearInterval(incrementIntervalIdRef.current);
      incrementIntervalIdRef.current = null;
    }
    if (safetyTimeoutIdRef.current !== null) {
      window.clearTimeout(safetyTimeoutIdRef.current);
      safetyTimeoutIdRef.current = null;
    }

    const elapsed = performance.now() - startTimeRef.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);

    finishTimeoutIdRef.current = window.setTimeout(() => {
      setProgress(100);
      hideTimeoutIdRef.current = window.setTimeout(() => {
        statusRef.current = "idle";
        setVisible(false);
        setProgress(0);
      }, FINISH_FADE_MS);
    }, delay);
  };

  useEffect(() => {
    finish();
  }, [pathname, search]);

  useEffect(() => {
    prefersReducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    mountedRef.current = true;

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!isInternalNavigation(anchor)) return;

      scheduleStart();
    };

    const onPopState = () => {
      scheduleStart();
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    const maybeStartFromHistoryArgs = (args: unknown[]) => {
      const url = args[2];
      if (!url) return;
      try {
        const nextUrl = new URL(url.toString(), window.location.href);
        const currentUrl = new URL(window.location.href);
        if (nextUrl.origin !== currentUrl.origin) return;
        if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;
        scheduleStart();
      } catch {
        scheduleStart();
      }
    };

    history.pushState = function (...args) {
      maybeStartFromHistoryArgs(args);
      return originalPushState.apply(this, args as Parameters<History["pushState"]>);
    };

    history.replaceState = function (...args) {
      maybeStartFromHistoryArgs(args);
      return originalReplaceState.apply(this, args as Parameters<History["replaceState"]>);
    };

    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      mountedRef.current = false;
      clearTimers();
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[9999] h-0.5">
      <div
        className="h-full bg-primary transition-[width,opacity] duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          willChange: "width, opacity",
        }}
      />
    </div>
  );
}
