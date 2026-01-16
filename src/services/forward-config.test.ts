import assert from "node:assert/strict";
import test from "node:test";
import { normalizeForwardRuleConfig } from "@/services/forward-config";

test("normalizeForwardRuleConfig upgrades legacy configs", () => {
  const legacyEmail = normalizeForwardRuleConfig("EMAIL", JSON.stringify({ to: "a@example.com" }));
  assert.equal(legacyEmail.ok, true);
  if (!legacyEmail.ok) return;
  assert.equal(legacyEmail.config.version, 2);
  assert.equal(legacyEmail.config.destination.type, "EMAIL");
  assert.equal(legacyEmail.config.destination.to, "a@example.com");

  const legacyWebhook = normalizeForwardRuleConfig(
    "WEBHOOK",
    JSON.stringify({ url: "https://example.com/hook", headers: { Authorization: "Bearer x" } })
  );
  assert.equal(legacyWebhook.ok, true);
  if (!legacyWebhook.ok) return;
  assert.equal(legacyWebhook.config.destination.type, "WEBHOOK");
  assert.equal(legacyWebhook.config.destination.url, "https://example.com/hook");
  assert.deepEqual(legacyWebhook.config.destination.headers, { Authorization: "Bearer x" });
});

test("normalizeForwardRuleConfig accepts v2 configs and enforces type match", () => {
  const v2 = normalizeForwardRuleConfig(
    "DISCORD",
    JSON.stringify({
      version: 2,
      destination: { type: "DISCORD", url: "https://example.com/hook", headers: {} },
      conditions: { kind: "match", field: "subject", operator: "contains", value: "hello" },
      template: { text: "Hi {{subject}}" },
    })
  );
  assert.equal(v2.ok, true);
  if (!v2.ok) return;
  assert.equal(v2.config.destination.type, "DISCORD");

  const mismatch = normalizeForwardRuleConfig(
    "EMAIL",
    JSON.stringify({
      version: 2,
      destination: { type: "WEBHOOK", url: "https://example.com/hook", headers: {} },
    })
  );
  assert.equal(mismatch.ok, false);
});

test("normalizeForwardRuleConfig rejects invalid JSON", () => {
  const bad = normalizeForwardRuleConfig("EMAIL", "{not-json");
  assert.equal(bad.ok, false);
});

