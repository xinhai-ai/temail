import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";
import { runRetentionJob } from "@/services/jobs/retention";

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  userId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
});

let retentionJobRunning = false;

function secureEquals(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function getProvidedToken(request: NextRequest): string {
  const headerToken = (request.headers.get("x-job-token") || "").trim();
  if (headerToken) return headerToken;

  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function hasJsonBody(request: NextRequest): boolean {
  const contentLength = Number.parseInt(request.headers.get("content-length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > 0) return true;

  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("application/json");
}

export async function POST(request: NextRequest) {
  const expectedToken = (process.env.JOBS_TRIGGER_TOKEN || "").trim();
  if (!expectedToken) {
    return NextResponse.json({ error: "JOBS_TRIGGER_TOKEN is not configured" }, { status: 503 });
  }

  const providedToken = getProvidedToken(request);
  if (!providedToken || !secureEquals(expectedToken, providedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown = {};
  if (hasJsonBody(request)) {
    const bodyResult = await readJsonBody(request, { maxBytes: 20_000 });
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }
    payload = bodyResult.data;
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request body" }, { status: 400 });
  }

  if (retentionJobRunning) {
    return NextResponse.json({ error: "Retention job is already running" }, { status: 409 });
  }

  retentionJobRunning = true;
  try {
    const result = await runRetentionJob(parsed.data);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("[jobs/retention] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    retentionJobRunning = false;
  }
}
