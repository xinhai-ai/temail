import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/api-rate-limit";
import { readJsonBody } from "@/lib/request";
import { verifyEmailToken } from "@/services/auth/email-verification";

const schema = z.object({
  token: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request) || "unknown";
  const limited = rateLimit(`verify-email:${ip}`, { limit: 60, windowMs: 10 * 60_000 });
  if (!limited.allowed) {
    const retryAfterSeconds = Math.max(1, Math.ceil(limited.retryAfterMs / 1000));
    return NextResponse.json(
      { error: "Rate limited" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 10_000 });
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  try {
    const data = schema.parse(bodyResult.data);
    const result = await verifyEmailToken(data.token);
    if (!result.ok) {
      if (result.error === "missing_token") {
        return NextResponse.json({ error: "Missing token" }, { status: 400 });
      }
      if (result.error === "invalid_or_expired") {
        return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("[api/auth/verify-email] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
