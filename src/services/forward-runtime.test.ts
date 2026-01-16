import assert from "node:assert/strict";
import test from "node:test";
import { buildForwardTemplateVars, matchesForwardConditions, renderForwardTemplate } from "@/services/forward-runtime";

test("renderForwardTemplate replaces variables ({{}} and {{{}}})", () => {
  const email = {
    id: "e1",
    subject: "Hello",
    fromAddress: "from@example.com",
    fromName: "From",
    toAddress: "to@example.com",
    textBody: "Body",
    htmlBody: "<p>Hi</p>",
    receivedAt: new Date("2026-01-16T00:00:00.000Z"),
  };
  const vars = buildForwardTemplateVars(email, "m1");

  assert.equal(renderForwardTemplate("{{subject}}", vars), "Hello");
  assert.equal(renderForwardTemplate("{{{subject}}}", vars), "Hello");
  assert.equal(renderForwardTemplate("From: {{fromName}} <{{fromAddress}}>", vars), "From: From <from@example.com>");
  assert.equal(renderForwardTemplate("{{missing}}", vars), "");
});

test("matchesForwardConditions evaluates nested trees", () => {
  const email = {
    id: "e1",
    subject: "Hello World",
    fromAddress: "from@example.com",
    fromName: "From",
    toAddress: "to@example.com",
    textBody: "This is a test",
    htmlBody: null,
    receivedAt: new Date("2026-01-16T00:00:00.000Z"),
  };

  assert.equal(
    matchesForwardConditions(email, {
      kind: "match",
      field: "subject",
      operator: "contains",
      value: "hello",
    }),
    true
  );

  assert.equal(
    matchesForwardConditions(email, {
      kind: "match",
      field: "subject",
      operator: "contains",
      value: "hello",
      caseSensitive: true,
    }),
    false
  );

  assert.equal(
    matchesForwardConditions(email, {
      kind: "and",
      conditions: [
        { kind: "match", field: "subject", operator: "contains", value: "world" },
        { kind: "match", field: "textBody", operator: "contains", value: "test" },
      ],
    }),
    true
  );

  assert.equal(
    matchesForwardConditions(email, {
      kind: "or",
      conditions: [
        { kind: "match", field: "fromAddress", operator: "equals", value: "nope@example.com" },
        { kind: "match", field: "toAddress", operator: "equals", value: "to@example.com" },
      ],
    }),
    true
  );

  assert.equal(
    matchesForwardConditions(email, {
      kind: "not",
      condition: { kind: "match", field: "subject", operator: "contains", value: "world" },
    }),
    false
  );
});

