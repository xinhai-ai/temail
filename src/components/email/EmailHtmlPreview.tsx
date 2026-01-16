"use client";

import { useMemo } from "react";

type EmailHtmlPreviewProps = {
  html: string;
  title?: string;
  className?: string;
  allowRemoteResources?: boolean;
};

export function EmailHtmlPreview({
  html,
  title = "Email HTML preview",
  className,
  allowRemoteResources = false,
}: EmailHtmlPreviewProps) {
  const srcDoc = useMemo(() => {
    const safeHtml = html || "";
    const csp = [
      "default-src 'none'",
      allowRemoteResources ? "img-src https: http: data:" : "img-src data:",
      "style-src 'unsafe-inline'",
      "font-src data:",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ");
    return `<!doctype html><html><head><meta charset="utf-8" /><meta http-equiv="Content-Security-Policy" content="${csp}" /><base target="_blank" /></head><body style="margin:0;padding:12px;font-family:ui-sans-serif,system-ui;">${safeHtml}</body></html>`;
  }, [html, allowRemoteResources]);

  return (
    <iframe
      title={title}
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      className={className ?? "w-full h-[480px] rounded-md border bg-white"}
    />
  );
}
