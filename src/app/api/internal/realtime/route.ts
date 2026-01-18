import { NextRequest, NextResponse } from "next/server";
import { publishRealtimeEvent } from "@/lib/realtime/server";
import crypto from "node:crypto";
import { readJsonBody } from "@/lib/request";

// Internal API for IMAP service to publish realtime events
// This endpoint should only be accessible from localhost

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function isLoopbackHostname(hostname: string) {
  const lowered = hostname.toLowerCase();
  return lowered === "localhost" || lowered === "127.0.0.1" || lowered === "::1";
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.IMAP_SERVICE_KEY;
  const providedKey = request.headers.get("x-service-key");

  if (typeof serviceKey === "string" && serviceKey) {
    if (typeof providedKey !== "string" || !safeEqual(providedKey, serviceKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Do not allow internal calls without a shared secret in production deployments.
    return NextResponse.json(
      { error: "Internal service key is not configured" },
      { status: 503 }
    );
  } else {
    // Development fallback: allow loopback only.
    if (!isLoopbackHostname(request.nextUrl.hostname)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const bodyResult = await readJsonBody(request, { maxBytes: 100_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    const body = bodyResult.data;

    const { userId, event } = body as {
      userId: string;
      event: {
        type: string;
        data: unknown;
      };
    };

    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      typeof event !== "object" ||
      !event ||
      typeof (event as { type?: unknown }).type !== "string" ||
      !(event as { type: string }).type.trim()
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Publish the event to the realtime system
    publishRealtimeEvent(userId.trim(), event as Parameters<typeof publishRealtimeEvent>[1]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/internal/realtime] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
