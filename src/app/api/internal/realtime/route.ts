import { NextRequest, NextResponse } from "next/server";
import { publishRealtimeEvent } from "@/lib/realtime/server";

// Internal API for IMAP service to publish realtime events
// This endpoint should only be accessible from localhost

export async function POST(request: NextRequest) {
  // Verify request is from localhost (IMAP service)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const host = request.headers.get("host") || "";

  // Only allow requests from localhost in non-production
  // In production, you might want to use a shared secret
  const isLocalhost =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    forwarded?.includes("127.0.0.1") ||
    realIp === "127.0.0.1";

  // Check for internal service key if set
  const serviceKey = process.env.IMAP_SERVICE_KEY;
  const providedKey = request.headers.get("x-service-key");

  if (serviceKey && providedKey !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!serviceKey && !isLocalhost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();

    const { userId, event } = body as {
      userId: string;
      event: {
        type: string;
        data: unknown;
      };
    };

    if (!userId || !event || !event.type) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Publish the event to the realtime system
    publishRealtimeEvent(userId, event as Parameters<typeof publishRealtimeEvent>[1]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/internal/realtime] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
