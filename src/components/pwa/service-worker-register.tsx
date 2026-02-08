"use client";

import { useEffect } from "react";
import { Workbox } from "workbox-window";
import { toast } from "sonner";

type WorkboxInstalledEvent = Event & {
  isUpdate?: boolean;
};

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const workerUrl = "/sw.js";
    const workbox = new Workbox(workerUrl);

    const onInstalled = (event: WorkboxInstalledEvent) => {
      if (!event.isUpdate) return;
      toast.info("New version available", {
        action: {
          label: "Refresh",
          onClick: () => window.location.reload(),
        },
      });
    };

    workbox.addEventListener("installed", onInstalled as EventListener);

    workbox.register().catch(() => {
      // ignore registration errors in unsupported or restricted environments
    });

    return () => {
      workbox.removeEventListener("installed", onInstalled as EventListener);
    };
  }, []);

  return null;
}
