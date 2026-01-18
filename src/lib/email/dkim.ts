import "server-only";

import { dkimVerify } from "mailauth";
import { getStorage } from "@/lib/storage";

export type DkimUiStatus = "correct" | "error" | "unknown";

export type DkimUiSignature = {
  signingDomain: string;
  selector?: string;
  result: string;
  comment?: string;
  info?: string;
};

export type DkimUiResult = {
  status: DkimUiStatus;
  summary: string;
  headerFrom?: string[];
  signatures?: DkimUiSignature[];
  error?: string;
};

function looksLikeRfc822(raw: string): boolean {
  const trimmed = raw.trimStart();
  if (!trimmed) return false;

  const headerBodySplit = trimmed.includes("\r\n\r\n") || trimmed.includes("\n\n");
  if (!headerBodySplit) return false;

  // Must contain at least one header line separator early on.
  const sample = trimmed.slice(0, 1000);
  return /[\r\n][A-Za-z0-9-]{1,40}:\s/.test(sample) || /^[A-Za-z0-9-]{1,40}:\s/.test(sample);
}

function getStatusFromResults(results: DkimUiSignature[]): DkimUiStatus {
  if (results.some((entry) => entry.result === "pass")) return "correct";
  if (results.some((entry) => entry.result === "fail" || entry.result === "temperror" || entry.result === "permerror")) {
    return "error";
  }
  return "unknown";
}

/**
 * Verifies DKIM signature.
 * Supports reading raw content from file (rawContentPath) or directly from database (rawContent).
 */
export async function verifyDkim(email: {
  rawContent?: string | null;
  rawContentPath?: string | null;
}): Promise<DkimUiResult> {
  let rawContent: string | null = null;

  // Try to read from file first if path is provided
  if (email.rawContentPath) {
    try {
      const storage = getStorage();
      const buffer = await storage.read(email.rawContentPath);
      rawContent = buffer.toString("utf8");
    } catch (error) {
      // File not found or read error, fall back to database content
      console.error("[dkim] failed to read raw content from file:", error);
    }
  }

  // Fall back to database content for backward compatibility
  if (!rawContent && email.rawContent) {
    rawContent = email.rawContent;
  }

  if (!rawContent || !rawContent.trim()) {
    return { status: "unknown", summary: "DKIM: Unknown (no raw message available)" };
  }

  if (!looksLikeRfc822(rawContent)) {
    return { status: "unknown", summary: "DKIM: Unknown (message is not RFC822 formatted)" };
  }

  try {
    const result = await dkimVerify(rawContent);
    const signatures: DkimUiSignature[] = (result.results || []).map((entry) => ({
      signingDomain: entry.signingDomain,
      selector: entry.selector,
      result: entry.status.result,
      comment: entry.status.comment,
      info: entry.info,
    }));

    if (signatures.length === 0) {
      return {
        status: "unknown",
        summary: "DKIM: Unknown (no DKIM signatures found)",
        headerFrom: result.headerFrom,
      };
    }

    const status = getStatusFromResults(signatures);
    const summary =
      status === "correct"
        ? "DKIM: Pass"
        : status === "error"
          ? "DKIM: Fail"
          : "DKIM: Unknown";

    return {
      status,
      summary,
      headerFrom: result.headerFrom,
      signatures,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "unknown",
      summary: "DKIM: Unknown (verification failed)",
      error: message,
    };
  }
}

