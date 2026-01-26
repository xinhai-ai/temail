import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncAllImapDomains, isImapServiceEnabled } from "@/lib/imap-client";
import {
  tryAcquireSyncLock,
  getSyncStatus,
  formatRemainingTime,
} from "@/lib/rate-limit";
import { isVercelDeployment } from "@/lib/deployment/server";

// GET: Check sync status (cooldown, running state)
export async function GET(request: NextRequest) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = getSyncStatus();

  return NextResponse.json({
    isRunning: status.isRunning,
    cooldownRemainingMs: status.cooldownRemainingMs,
    canSync: !status.isRunning && status.cooldownRemainingMs === 0,
    lastSyncAt: status.lastSyncAt ? new Date(status.lastSyncAt).toISOString() : null,
  });
}

// POST: Trigger IMAP sync for all domains
export async function POST(request: NextRequest) {
  if (isVercelDeployment()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImapServiceEnabled()) {
    return NextResponse.json(
      { error: "IMAP service is not enabled" },
      { status: 503 }
    );
  }

  // Try to acquire global sync lock
  const lockResult = tryAcquireSyncLock(session.user.id);

  if (!lockResult.allowed) {
    const remainingFormatted = formatRemainingTime(lockResult.remainingMs);

    if (lockResult.reason === "running") {
      return NextResponse.json(
        {
          error: "Sync already in progress",
          reason: "running",
          remainingMs: lockResult.remainingMs,
          message: `A sync is already running. Please wait ${remainingFormatted}.`,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: "Rate limited",
        reason: "cooldown",
        remainingMs: lockResult.remainingMs,
        message: `Please wait ${remainingFormatted} before refreshing again.`,
      },
      { status: 429 }
    );
  }

  // Lock acquired, perform sync
  try {
    const result = await syncAllImapDomains();

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Synced ${result.count} domain(s)`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  } finally {
    // Always release the lock
    lockResult.release();
  }
}
