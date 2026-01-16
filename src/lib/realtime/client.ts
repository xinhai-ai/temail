"use client";

import type { RealtimeEvent } from "@/lib/realtime/types";

type RealtimeHandlers = {
  onReady?: () => void;
  onEvent: (event: RealtimeEvent) => void;
  onError?: (event: Event) => void;
};

export function connectRealtime(handlers: RealtimeHandlers) {
  if (typeof window === "undefined") return () => {};

  const source = new EventSource("/api/realtime");

  const readyListener = () => handlers.onReady?.();
  source.addEventListener("ready", readyListener);

  const eventTypes: RealtimeEvent["type"][] = [
    "email.created",
    "email.updated",
    "email.deleted",
    "emails.bulk_updated",
  ];

  const listeners = eventTypes.map((type) => {
    const listener = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlers.onEvent({ type, data } as RealtimeEvent);
      } catch {
        // ignore malformed payloads
      }
    };
    source.addEventListener(type, listener);
    return { type, listener };
  });

  source.onerror = (e) => {
    handlers.onError?.(e);
  };

  return () => {
    source.removeEventListener("ready", readyListener);
    for (const { type, listener } of listeners) {
      source.removeEventListener(type, listener);
    }
    source.close();
  };
}

