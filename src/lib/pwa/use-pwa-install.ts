"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const INSTALL_DISMISS_KEY = "temail.pwa.install.dismissedAt";
const INSTALL_DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaInstallState = "idle" | "promptable" | "installed" | "unsupported" | "ios-manual";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  return /safari/i.test(navigator.userAgent) && !/chrome|android|crios|fxios|edgios/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia("(display-mode: standalone)").matches || nav.standalone);
}

function isPromptDismissedRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const value = Number(raw);
    return Number.isFinite(value) && Date.now() - value < INSTALL_DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isInStandaloneMode());
  const [manualDismissed, setManualDismissed] = useState<boolean>(() => isPromptDismissedRecently());

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const canInstall = useMemo(() => {
    if (installed) return false;
    if (manualDismissed) return false;
    return deferredPrompt !== null;
  }, [deferredPrompt, installed, manualDismissed]);

  const isIosManual = useMemo(() => {
    if (installed) return false;
    if (manualDismissed) return false;
    return isIos() && isSafari();
  }, [installed, manualDismissed]);

  const state: PwaInstallState = useMemo(() => {
    if (installed) return "installed";
    if (canInstall) return "promptable";
    if (isIosManual) return "ios-manual";
    if (typeof window !== "undefined" && !("serviceWorker" in navigator)) return "unsupported";
    return "idle";
  }, [canInstall, installed, isIosManual]);

  const dismissPrompt = useCallback(() => {
    setManualDismissed(true);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === "accepted") {
      setInstalled(true);
      return "accepted";
    }
    return "dismissed";
  }, [deferredPrompt]);

  return {
    state,
    canInstall,
    isIosManual,
    isInstalled: installed,
    promptInstall,
    dismissPrompt,
  };
}
