export type Translator = (key: string, values?: Record<string, unknown>) => string;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

function safeT(t: Translator, key: string, values: Record<string, unknown> | undefined, fallback: string) {
  try {
    return t(key, values);
  } catch {
    return fallback;
  }
}

function getFeatureLabel(t: Translator, featureKey: string): string {
  return safeT(t, `features.${featureKey}`, undefined, featureKey);
}

export function formatPolicyError(tPolicy: Translator, data: unknown): string | null {
  const obj = asObject(data);
  if (!obj) return null;

  const code = asString(obj["code"]);
  const meta = asObject(obj["meta"]);
  if (!code) return null;

  if (code === "USERGROUP_FEATURE_DISABLED") {
    const featureKey = meta ? asString(meta["feature"]) : null;
    if (featureKey) {
      return safeT(
        tPolicy,
        "featureDisabledNamed",
        { feature: getFeatureLabel(tPolicy, featureKey) },
        `${featureKey} is disabled`
      );
    }
    return safeT(tPolicy, "featureDisabled", undefined, "Feature is disabled");
  }

  if (code === "USERGROUP_MAILBOX_LIMIT_REACHED") {
    const limit = meta ? asNumber(meta["limit"]) : null;
    const count = meta ? asNumber(meta["count"]) : null;
    const resource = safeT(tPolicy, "resources.mailboxes", undefined, "Mailbox");
    if (limit !== null && count !== null) {
      return safeT(tPolicy, "quotaExceeded", { resource, count, limit }, "Quota exceeded");
    }
    return safeT(tPolicy, "quotaExceededGeneric", { resource }, "Quota exceeded");
  }

  if (code === "USERGROUP_WORKFLOW_LIMIT_REACHED") {
    const limit = meta ? asNumber(meta["limit"]) : null;
    const count = meta ? asNumber(meta["count"]) : null;
    const resource = safeT(tPolicy, "resources.workflows", undefined, "Workflow");
    if (limit !== null && count !== null) {
      return safeT(tPolicy, "quotaExceeded", { resource, count, limit }, "Quota exceeded");
    }
    return safeT(tPolicy, "quotaExceededGeneric", { resource }, "Quota exceeded");
  }

  if (code === "USERGROUP_DOMAIN_NOT_ALLOWED") {
    return safeT(tPolicy, "domainNotAllowed", undefined, "Domain is not allowed");
  }

  return null;
}

export function getApiErrorMessage(tPolicy: Translator, data: unknown, fallback: string): string {
  return formatPolicyError(tPolicy, data) || asString(asObject(data)?.["error"]) || fallback;
}

