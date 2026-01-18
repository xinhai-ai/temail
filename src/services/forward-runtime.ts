import type { ForwardCondition } from "@/services/forward-config";

const MAX_REGEX_PATTERN_LENGTH = 200;
const MAX_MATCH_INPUT_LENGTH = 10_000;

export type ForwardEmail = {
  id: string;
  subject: string;
  fromAddress: string;
  fromName?: string | null;
  toAddress: string;
  textBody?: string | null;
  htmlBody?: string | null;
  receivedAt: Date;
};

export function buildForwardTemplateVars(
  email: ForwardEmail,
  mailboxId: string,
  options?: { previewUrl?: string }
) {
  return {
    id: email.id,
    subject: email.subject,
    fromAddress: email.fromAddress,
    fromName: email.fromName || "",
    toAddress: email.toAddress,
    textBody: email.textBody || "",
    htmlBody: email.htmlBody || "",
    previewUrl: options?.previewUrl || "",
    receivedAt: email.receivedAt.toISOString(),
    mailboxId,
  };
}

function readTemplatePath(vars: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = vars;
  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current === null || current === undefined) return "";
  return typeof current === "string" ? current : String(current);
}

export function renderForwardTemplate(template: string, vars: Record<string, unknown>) {
  return template.replace(
    /\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}|\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_, rawKey, escapedKey) => readTemplatePath(vars, rawKey || escapedKey)
  );
}

function normalizeText(value: string, caseSensitive: boolean | undefined) {
  return caseSensitive ? value : value.toLowerCase();
}

function matchesLeafCondition(
  email: ForwardEmail,
  field: "subject" | "fromAddress" | "toAddress" | "textBody",
  operator: "contains" | "equals" | "startsWith" | "endsWith" | "regex",
  expectedValue: string,
  caseSensitive: boolean | undefined
) {
  const raw = (() => {
    if (field === "textBody") return email.textBody || "";
    return email[field] || "";
  })();

  const candidate = raw.slice(0, MAX_MATCH_INPUT_LENGTH);
  const normalizedCandidate = normalizeText(candidate, caseSensitive);
  const normalizedExpected = normalizeText(expectedValue, caseSensitive);

  switch (operator) {
    case "contains":
      return normalizedCandidate.includes(normalizedExpected);
    case "equals":
      return normalizedCandidate === normalizedExpected;
    case "startsWith":
      return normalizedCandidate.startsWith(normalizedExpected);
    case "endsWith":
      return normalizedCandidate.endsWith(normalizedExpected);
    case "regex": {
      const pattern = expectedValue;
      if (!pattern || pattern.length > MAX_REGEX_PATTERN_LENGTH) return false;
      try {
        const re = new RegExp(pattern, caseSensitive ? "" : "i");
        return re.test(candidate);
      } catch {
        return false;
      }
    }
  }
}

export function matchesForwardConditions(email: ForwardEmail, condition: ForwardCondition): boolean {
  switch (condition.kind) {
    case "and":
      return condition.conditions.every((c) => matchesForwardConditions(email, c));
    case "or":
      return condition.conditions.some((c) => matchesForwardConditions(email, c));
    case "not":
      return !matchesForwardConditions(email, condition.condition);
    case "match":
      return matchesLeafCondition(
        email,
        condition.field,
        condition.operator,
        condition.value,
        condition.caseSensitive
      );
  }
}
