import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isImapServiceEnabled, syncAllImapDomains } from "@/lib/imap-client";
import { formatRemainingTime, tryAcquireSyncLock } from "@/lib/rate-limit";
import { getImapSyncRateLimitConfig } from "@/services/rate-limit-settings";
import { rematchUnmatchedInboundEmailsForUser } from "@/services/inbound/rematch";

type ImapRefreshResult =
  | { ok: true; count: number; message: string }
  | { ok: false; reason: "disabled" | "running" | "cooldown" | "error"; remainingMs?: number; message: string };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const inbound = await rematchUnmatchedInboundEmailsForUser(session.user.id);

    let imap: ImapRefreshResult = {
      ok: false,
      reason: "disabled",
      message: "IMAP sync skipped (service disabled)",
    };

    if (isImapServiceEnabled()) {
      const rateLimitConfig = await getImapSyncRateLimitConfig();
      const lockResult = tryAcquireSyncLock(session.user.id, rateLimitConfig);

      if (!lockResult.allowed) {
        const remainingFormatted = formatRemainingTime(lockResult.remainingMs);
        imap = {
          ok: false,
          reason: lockResult.reason,
          remainingMs: lockResult.remainingMs,
          message:
            lockResult.reason === "running"
              ? `A sync is already running. Please wait ${remainingFormatted}.`
              : `Please wait ${remainingFormatted} before refreshing again.`,
        };
      } else {
        try {
          const result = await syncAllImapDomains();
          imap = result.success
            ? { ok: true, count: result.count || 0, message: `Synced ${result.count || 0} domain(s)` }
            : { ok: false, reason: "error", message: result.message || "Sync failed" };
        } finally {
          lockResult.release();
        }
      }
    }

    const messageParts: string[] = [];
    if (imap.ok) {
      messageParts.push(imap.message);
    } else if (imap.reason !== "disabled") {
      messageParts.push(imap.message);
    }

    if (inbound.created > 0) {
      messageParts.push(`Re-matched ${inbound.created} inbound email(s)`);
    } else if (inbound.matched > 0) {
      messageParts.push(`Updated ${inbound.matched} inbound email(s)`);
    }

    return NextResponse.json({
      success: true,
      imap,
      inbound,
      message: messageParts.join(" • ") || "No updates",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
