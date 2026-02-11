import assert from "node:assert/strict";
import test from "node:test";
import {
  API_RATE_LIMIT_POLICIES,
  RATE_LIMIT_VALIDATION,
  normalizeRateLimitInteger,
  parseApiRateLimitOverridesLoose,
  validateApiRateLimitOverridesStrict,
} from "@/lib/rate-limit-policies";

test("normalizeRateLimitInteger parses and validates bounds", () => {
  assert.equal(normalizeRateLimitInteger("60", RATE_LIMIT_VALIDATION.apiLimit), 60);
  assert.equal(normalizeRateLimitInteger(120, RATE_LIMIT_VALIDATION.apiLimit), 120);
  assert.equal(normalizeRateLimitInteger("0", RATE_LIMIT_VALIDATION.apiLimit), null);
  assert.equal(normalizeRateLimitInteger("-5", RATE_LIMIT_VALIDATION.apiLimit), null);
  assert.equal(normalizeRateLimitInteger("x", RATE_LIMIT_VALIDATION.apiLimit), null);
});

test("parseApiRateLimitOverridesLoose keeps valid known policies only", () => {
  const raw = JSON.stringify({
    "auth.login": { limit: 33, windowMs: 600_000 },
    "unknown.policy": { limit: 1, windowMs: 1_000 },
    "auth.otp": { limit: "invalid" },
  });

  const parsed = parseApiRateLimitOverridesLoose(raw);
  assert.deepEqual(parsed, {
    "auth.login": { limit: 33, windowMs: 600_000 },
  });
});

test("validateApiRateLimitOverridesStrict rejects unknown policy", () => {
  const result = validateApiRateLimitOverridesStrict(
    JSON.stringify({
      "unknown.policy": { limit: 1, windowMs: 1_000 },
    })
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Unknown rate limit policy/);
  }
});

test("validateApiRateLimitOverridesStrict accepts valid payload", () => {
  const result = validateApiRateLimitOverridesStrict(
    JSON.stringify({
      "auth.login": { limit: 40, windowMs: 600_000 },
      "auth.otp": { limit: 30 },
    })
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      "auth.login": { limit: 40, windowMs: 600_000 },
      "auth.otp": { limit: 30 },
    });
  }
});

test("policy list includes auth.login", () => {
  const hasAuthLogin = API_RATE_LIMIT_POLICIES.some((item) => item.id === "auth.login");
  assert.equal(hasAuthLogin, true);
});
