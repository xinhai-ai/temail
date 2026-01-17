import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ImapServiceManager } from "../src/services/imap/manager";
import { createHttpRealtimePublisher } from "../src/services/imap/sync";
import prisma from "../src/lib/prisma";

function parseEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function parseEnvBool(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

const PORT = parseEnvInt("IMAP_SERVICE_PORT", 3001);
const NEXTJS_PORT = parseEnvInt("NEXTJS_PORT", 3000);
const NEXTJS_URL = process.env.NEXTJS_URL || `http://localhost:${NEXTJS_PORT}`;
const IDLE_TIMEOUT_MS = parseEnvInt("IMAP_IDLE_TIMEOUT_MS", 25 * 60 * 1000);
const HEARTBEAT_MS = parseEnvInt("IMAP_HEARTBEAT_MS", 5 * 60 * 1000);
const RECONCILE_MS = parseEnvInt("IMAP_RECONCILE_MS", 30 * 1000);
const FULL_SYNC_MS = parseEnvInt("IMAP_FULL_SYNC_MS", 5 * 60 * 1000);
const HEALTH_CHECK_MS = parseEnvInt("IMAP_HEALTH_CHECK_MS", 60 * 1000);
const RECONNECT_MIN_MS = parseEnvInt("IMAP_RECONNECT_MIN_MS", 1000);
const RECONNECT_MAX_MS = parseEnvInt("IMAP_RECONNECT_MAX_MS", 5 * 60 * 1000);
const DEBUG = parseEnvBool("IMAP_SERVICE_DEBUG", true);

let manager: ImapServiceManager | null = null;

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  // Get status
  if (method === "GET" && pathname === "/status") {
    if (!manager) {
      sendJson(res, 503, { error: "Service not started" });
      return;
    }
    sendJson(res, 200, manager.getStatus());
    return;
  }

  // Trigger reconcile
  if (method === "POST" && pathname === "/reconcile") {
    if (!manager) {
      sendJson(res, 503, { error: "Service not started" });
      return;
    }
    await manager.reconcileNow();
    sendJson(res, 200, { success: true, message: "Reconcile triggered" });
    return;
  }

  // Sync all domains
  if (method === "POST" && pathname === "/sync/all") {
    if (!manager) {
      sendJson(res, 503, { error: "Service not started" });
      return;
    }
    const result = await manager.syncAll();
    sendJson(res, 200, result);
    return;
  }

  // Sync specific domain
  const syncMatch = pathname.match(/^\/sync\/([a-zA-Z0-9_-]+)$/);
  if (method === "POST" && syncMatch) {
    if (!manager) {
      sendJson(res, 503, { error: "Service not started" });
      return;
    }
    const domainId = syncMatch[1];
    const result = await manager.syncDomain(domainId);
    sendJson(res, result.success ? 200 : 404, result);
    return;
  }

  // Not found
  sendJson(res, 404, { error: "Not found" });
}

async function main(): Promise<void> {
  console.log("[imap-service] Starting IMAP service...");
  console.log("[imap-service] Configuration:");
  console.log(`  Port: ${PORT}`);
  console.log(`  Next.js URL: ${NEXTJS_URL}`);
  console.log(`  IDLE timeout: ${IDLE_TIMEOUT_MS}ms`);
  console.log(`  Heartbeat interval: ${HEARTBEAT_MS}ms`);
  console.log(`  Reconcile interval: ${RECONCILE_MS}ms`);
  console.log(`  Full sync interval: ${FULL_SYNC_MS}ms`);
  console.log(`  Health check interval: ${HEALTH_CHECK_MS}ms`);
  console.log(`  Reconnect: ${RECONNECT_MIN_MS}ms - ${RECONNECT_MAX_MS}ms`);
  console.log(`  Debug: ${DEBUG}`);

  // Create realtime publisher for Next.js
  const realtimePublisher = createHttpRealtimePublisher(NEXTJS_URL);

  // Create manager
  manager = new ImapServiceManager({
    scheduler: {
      reconcileMs: RECONCILE_MS,
      fullSyncMs: FULL_SYNC_MS,
      healthCheckMs: HEALTH_CHECK_MS,
    },
    worker: {
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      heartbeatMs: HEARTBEAT_MS,
      reconnectMinMs: RECONNECT_MIN_MS,
      reconnectMaxMs: RECONNECT_MAX_MS,
    },
    syncOptions: {
      publishRealtimeEvent: realtimePublisher,
    },
    debug: DEBUG,
  });

  // Start the manager
  manager.start();

  // Create HTTP server
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("[imap-service] Request error:", error);
      sendJson(res, 500, { error: "Internal server error" });
    });
  });

  server.listen(PORT, () => {
    console.log(`[imap-service] HTTP server listening on port ${PORT}`);
    console.log(`[imap-service] Endpoints:`);
    console.log(`  GET  /health           - Health check`);
    console.log(`  GET  /status           - Get service status`);
    console.log(`  POST /reconcile        - Trigger config reconcile`);
    console.log(`  POST /sync/all         - Sync all domains`);
    console.log(`  POST /sync/:domainId   - Sync specific domain`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[imap-service] Received ${signal}, shutting down...`);

    server.close();

    if (manager) {
      await manager.stop();
    }

    await prisma.$disconnect();

    console.log("[imap-service] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[imap-service] Fatal error:", error);
  process.exit(1);
});
