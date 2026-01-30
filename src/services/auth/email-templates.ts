import "server-only";

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const REQUIRED_ACTION_URL_REGEX = /\{\{\s*(actionUrl|url)\s*\}\}/;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

export function pickEmailTemplate(options: {
  custom: string | null | undefined;
  fallback: string;
  requireActionUrl?: boolean;
}): string {
  const candidate = (options.custom || "").trim();
  if (!candidate) return options.fallback;

  if (options.requireActionUrl && !REQUIRED_ACTION_URL_REGEX.test(candidate)) {
    return options.fallback;
  }

  return candidate;
}

export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>,
  options?: { html?: boolean }
): string {
  const escape = Boolean(options?.html);
  return template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    const value = vars[key] ?? "";
    return escape ? escapeHtml(value) : value;
  });
}

