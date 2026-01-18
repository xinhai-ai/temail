export type JsonBodyReadResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

export const DEFAULT_JSON_BODY_MAX_BYTES = 200_000; // 200KB

function parsePositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export async function readJsonBody(
  request: Request,
  options: { maxBytes?: number } = {}
): Promise<JsonBodyReadResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_BODY_MAX_BYTES;
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return { ok: false, status: 500, error: "Invalid server configuration" };
  }

  const contentLength = parsePositiveInt(request.headers.get("content-length"));
  if (contentLength !== null && contentLength > maxBytes) {
    return { ok: false, status: 413, error: "Request body is too large" };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        return { ok: false, status: 413, error: "Request body is too large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  if (totalBytes === 0) {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  const data = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(data));
  } catch {
    return { ok: false, status: 400, error: "Invalid request body" };
  }

  return { ok: true, data: parsed };
}

