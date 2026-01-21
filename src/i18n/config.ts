export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "temail_locale";

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

