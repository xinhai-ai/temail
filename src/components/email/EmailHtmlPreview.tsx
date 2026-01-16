"use client";

import { useMemo } from "react";

type EmailHtmlPreviewProps = {
  html: string;
  title?: string;
  className?: string;
};

export function EmailHtmlPreview({
  html,
  title = "Email HTML preview",
  className,
}: EmailHtmlPreviewProps) {
  const srcDoc = useMemo(() => {
    const safeHtml = html || "";
    return `<!doctype html><html><head><meta charset="utf-8" /><base target="_blank" /></head><body style="margin:0;padding:12px;font-family:ui-sans-serif,system-ui;">${safeHtml}</body></html>`;
  }, [html]);

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

