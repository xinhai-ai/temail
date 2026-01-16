import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { RealtimeEnvelope, RealtimeEvent } from "@/lib/realtime/types";

type RealtimeListener = (envelope: RealtimeEnvelope) => void;

type RealtimeEmitter = {
  emitter: EventEmitter;
};

const globalForRealtime = globalThis as unknown as {
  __temailRealtime?: RealtimeEmitter;
};

function getRealtimeEmitter(): EventEmitter {
  if (!globalForRealtime.__temailRealtime) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForRealtime.__temailRealtime = { emitter };
  }
  return globalForRealtime.__temailRealtime.emitter;
}

function userChannel(userId: string) {
  return `user:${userId}`;
}

export function publishRealtimeEvent(userId: string, event: RealtimeEvent) {
  const envelope: RealtimeEnvelope = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    event,
  };
  getRealtimeEmitter().emit(userChannel(userId), envelope);
}

export function subscribeRealtimeEvents(userId: string, listener: RealtimeListener) {
  const emitter = getRealtimeEmitter();
  const channel = userChannel(userId);
  emitter.on(channel, listener);
  return () => {
    emitter.off(channel, listener);
  };
}

