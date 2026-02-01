import assert from "node:assert/strict";
import test from "node:test";
import { isReservedMailboxPrefix, normalizeMailboxPrefix } from "@/lib/mailbox-prefix";

test("mailbox prefix normalization", () => {
  assert.equal(normalizeMailboxPrefix(" Admin "), "admin");
  assert.equal(normalizeMailboxPrefix(""), "");
});

test("reserved mailbox prefixes", () => {
  assert.equal(isReservedMailboxPrefix("admin"), true);
  assert.equal(isReservedMailboxPrefix("Admin"), true);
  assert.equal(isReservedMailboxPrefix("admin1"), true);
  assert.equal(isReservedMailboxPrefix("admin-test"), true);
  assert.equal(isReservedMailboxPrefix("no-reply"), true);
  assert.equal(isReservedMailboxPrefix("noreply2"), true);
  assert.equal(isReservedMailboxPrefix("administer"), false);
  assert.equal(isReservedMailboxPrefix("user"), false);
});

