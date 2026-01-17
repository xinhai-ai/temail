/**
 * Global rate limiter for IMAP sync operations
 *
 * Features:
 * - Global mutex lock to prevent concurrent sync operations
 * - Cooldown period between syncs
 * - Works across all users (global limit, not per-user)
 */

type SyncState = {
  isRunning: boolean;
  lastSyncAt: number;
  lastSyncBy: string | null;
};

// Global state - shared across all requests in this process
// For multi-instance deployments, consider using Redis or database
const globalSyncState: SyncState = {
  isRunning: false,
  lastSyncAt: 0,
  lastSyncBy: null,
};

// Configuration
const COOLDOWN_MS = 30 * 1000; // 30 seconds between syncs
const MAX_SYNC_DURATION_MS = 5 * 60 * 1000; // Auto-release lock after 5 minutes

export type RateLimitResult =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: "running"; remainingMs: number }
  | { allowed: false; reason: "cooldown"; remainingMs: number };

/**
 * Try to acquire the global sync lock
 * Returns a release function if successful, or error info if rate limited
 */
export function tryAcquireSyncLock(userId: string): RateLimitResult {
  const now = Date.now();

  // Check if a sync is currently running
  if (globalSyncState.isRunning) {
    // Auto-release stale locks (in case of crashes)
    const elapsed = now - globalSyncState.lastSyncAt;
    if (elapsed < MAX_SYNC_DURATION_MS) {
      return {
        allowed: false,
        reason: "running",
        remainingMs: Math.max(0, MAX_SYNC_DURATION_MS - elapsed),
      };
    }
    // Stale lock - release it
    globalSyncState.isRunning = false;
  }

  // Check cooldown
  const timeSinceLastSync = now - globalSyncState.lastSyncAt;
  if (timeSinceLastSync < COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      remainingMs: COOLDOWN_MS - timeSinceLastSync,
    };
  }

  // Acquire lock
  globalSyncState.isRunning = true;
  globalSyncState.lastSyncAt = now;
  globalSyncState.lastSyncBy = userId;

  // Return release function
  const release = () => {
    globalSyncState.isRunning = false;
    globalSyncState.lastSyncAt = Date.now(); // Update to actual completion time
  };

  return { allowed: true, release };
}

/**
 * Get current sync status for display
 */
export function getSyncStatus(): {
  isRunning: boolean;
  cooldownRemainingMs: number;
  lastSyncAt: number | null;
} {
  const now = Date.now();
  const timeSinceLastSync = now - globalSyncState.lastSyncAt;

  // Check for stale running state
  const isActuallyRunning = globalSyncState.isRunning &&
    (now - globalSyncState.lastSyncAt) < MAX_SYNC_DURATION_MS;

  const cooldownRemainingMs = isActuallyRunning
    ? MAX_SYNC_DURATION_MS - (now - globalSyncState.lastSyncAt)
    : Math.max(0, COOLDOWN_MS - timeSinceLastSync);

  return {
    isRunning: isActuallyRunning,
    cooldownRemainingMs,
    lastSyncAt: globalSyncState.lastSyncAt > 0 ? globalSyncState.lastSyncAt : null,
  };
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
