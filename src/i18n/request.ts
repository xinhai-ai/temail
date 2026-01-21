import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale, isLocale } from "@/i18n/config";
import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";

export default getRequestConfig(async () => {
  const locale = await getLocale();

  return {
    locale,
    messages: locale === "zh" ? zhMessages : enMessages,
  };
});

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language");
  const headerLocale = getPreferredLocaleFromAcceptLanguage(acceptLanguage);
  if (headerLocale) {
    return headerLocale;
  }

  return DEFAULT_LOCALE;
}

function getPreferredLocaleFromAcceptLanguage(value: string | null): Locale | null {
  if (!value) return null;

  const candidates = value
    .split(",")
    .map((part) => part.trim().split(";")[0]?.trim())
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function normalizeLocale(value: string): Locale | null {
  const lower = value.toLowerCase();
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "zh" || lower.startsWith("zh-")) return "zh";
  return null;
}
