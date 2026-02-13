import assert from "node:assert/strict";
import test from "node:test";
import { rateLimit } from "@/lib/api-rate-limit";

test("rateLimit blocks requests beyond the configured window limit", async () => {
  const key = `test-rate-limit:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const first = await rateLimit(key, { limit: 1, windowMs: 1_000 });
  const second = await rateLimit(key, { limit: 1, windowMs: 1_000 });

  assert.deepEqual(first, { allowed: true });
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.equal(Number.isFinite(second.retryAfterMs), true);
    assert.equal(second.retryAfterMs >= 0, true);
    assert.equal(second.retryAfterMs <= 1_000, true);
  }
});
