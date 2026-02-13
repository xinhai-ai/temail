export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { getCacheMode, initializeCache } = await import("@/lib/cache");
  await initializeCache();
  console.log(`[instrumentation] Cache mode: ${getCacheMode()}`);

  // IMAP service now runs as an independent process
  // Start with: npm run imap:service
  // Or together with Next.js: npm run dev:all
  if (process.env.IMAP_SERVICE_ENABLED === "1") {
    console.log("[instrumentation] IMAP service mode: external (port 3001)");
  } else {
    console.log("[instrumentation] IMAP service not enabled. Set IMAP_SERVICE_ENABLED=1 or use npm run dev:all");
  }
}
