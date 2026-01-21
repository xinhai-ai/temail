import assert from "node:assert/strict";
import test from "node:test";
import { validateEgressUrl } from "@/lib/egress";

test("validateEgressUrl blocks loopback IPv6", async () => {
  const result = await validateEgressUrl("http://[::1]/");
  assert.equal(result.ok, false);
});

test("validateEgressUrl blocks IPv4-mapped IPv6 (dotted quad)", async () => {
  const result = await validateEgressUrl("http://[::ffff:127.0.0.1]/");
  assert.equal(result.ok, false);
});

test("validateEgressUrl blocks IPv4-mapped IPv6 (hex)", async () => {
  const result = await validateEgressUrl("http://[::ffff:7f00:1]/");
  assert.equal(result.ok, false);
});

test("validateEgressUrl allows public IPv4", async () => {
  const result = await validateEgressUrl("https://1.1.1.1/");
  assert.equal(result.ok, true);
});
