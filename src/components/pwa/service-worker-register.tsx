"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const showUpdateToast = () => {
      toast.info("New version available", {
        action: {
          label: "Refresh",
          onClick: () => window.location.reload(),
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdateToast();
        }

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state !== "installed") return;
            if (!navigator.serviceWorker.controller) return;
            showUpdateToast();
          });
        });
      })
      .catch(() => {
        // ignore registration errors in unsupported or restricted environments
      });
  }, []);

  return null;
}
