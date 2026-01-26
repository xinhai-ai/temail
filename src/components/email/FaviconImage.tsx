"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

type Provider = "auto" | "google" | "im";

type FaviconImageProps = {
  domain: string | null;
  size?: number;
  provider?: Provider;
  className?: string;
  imgClassName?: string;
  fallback: React.ReactNode;
  title?: string;
};

export function FaviconImage({
  domain,
  size = 32,
  provider = "auto",
  className,
  imgClassName,
  fallback,
  title,
}: FaviconImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const url = useMemo(() => {
    if (!domain) return null;
    const params = new URLSearchParams();
    params.set("domain", domain);
    params.set("size", String(size));
    if (provider !== "auto") {
      params.set("provider", provider);
    }
    return `/api/favicons?${params.toString()}`;
  }, [domain, provider, size]);

  return (
    <div className={cn("relative overflow-hidden", className)} title={title}>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          loaded && !errored ? "opacity-0" : "opacity-100"
        )}
        aria-hidden
      >
        {fallback}
      </div>
      {!errored && url ? (
        <Image
          src={url}
          width={size}
          height={size}
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName
          )}
          alt=""
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          draggable={false}
          unoptimized
        />
      ) : null}
    </div>
  );
}
