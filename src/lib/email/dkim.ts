import "server-only";

import { dkimVerify } from "mailauth";

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

export async function verifyDkim(rawContent: string | null | undefined): Promise<DkimUiResult> {
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

