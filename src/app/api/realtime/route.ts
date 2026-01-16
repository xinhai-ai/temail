import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subscribeRealtimeEvents } from "@/lib/realtime/server";
import type { RealtimeEnvelope } from "@/lib/realtime/types";

function serializeSse(envelope: RealtimeEnvelope) {
  const payload = JSON.stringify(envelope.event.data);
  return `id: ${envelope.id}\nevent: ${envelope.event.type}\ndata: ${payload}\n\n`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          cleanup?.();
        } finally {
          controller.close();
        }
      };

      // Initial event so the client can treat connection as ready.
      send("event: ready\ndata: {}\n\n");

      const unsubscribe = subscribeRealtimeEvents(userId, (envelope) => {
        send(serializeSse(envelope));
      });

      const heartbeat = setInterval(() => {
        send(": ping\n\n");
      }, 20000);

      const onAbort = () => close();
      request.signal.addEventListener("abort", onAbort);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", onAbort);
      };
    },
    cancel() {
      cleanup?.();
      cleanup = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

