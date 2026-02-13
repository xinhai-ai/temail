import assert from "node:assert/strict";
import test from "node:test";
import { MemoryKvStore } from "@/lib/cache/memory-store";

test("memory cache respects ttl expiration", async () => {
  const store = new MemoryKvStore({ maxEntries: 100 });
  await store.set("k1", "v1", { ttlMs: 30 });
  assert.equal(await store.get("k1"), "v1");
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(await store.get("k1"), null);
});

test("memory cache keeps LRU entries when max entries is reached", async () => {
  const store = new MemoryKvStore({ maxEntries: 2 });
  await store.set("a", "1");
  await store.set("b", "2");
  assert.equal(await store.get("a"), "1"); // refresh access order
  await store.set("c", "3");

  assert.equal(await store.get("a"), "1");
  assert.equal(await store.get("b"), null);
  assert.equal(await store.get("c"), "3");
});

test("memory cache can clear keys by prefix", async () => {
  const store = new MemoryKvStore({ maxEntries: 10 });
  await store.set("ns:one", "1");
  await store.set("ns:two", "2");
  await store.set("other:one", "3");

  const removed = await store.clearByPrefix("ns:");
  assert.equal(removed, 2);
  assert.equal(await store.get("ns:one"), null);
  assert.equal(await store.get("ns:two"), null);
  assert.equal(await store.get("other:one"), "3");
});

test("memory cache rate limit follows fixed window behavior", async () => {
  const store = new MemoryKvStore({ maxEntries: 10 });
  const config = { limit: 2, windowMs: 1_000 };

  const first = await store.rateLimit("rk", { ...config, nowMs: 0 });
  const second = await store.rateLimit("rk", { ...config, nowMs: 200 });
  const third = await store.rateLimit("rk", { ...config, nowMs: 500 });
  const fourth = await store.rateLimit("rk", { ...config, nowMs: 1_100 });

  assert.deepEqual(first, { allowed: true });
  assert.deepEqual(second, { allowed: true });
  assert.deepEqual(third, { allowed: false, retryAfterMs: 500 });
  assert.deepEqual(fourth, { allowed: true });
});
