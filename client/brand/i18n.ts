import { directionOf, type Language, setLanguage, useLanguage } from './preferences';
import { STARTER_STRINGS } from './strings';

// A small English/Arabic helper for the shipped app. SYNAPSE-OWNED (client/brand/**).
//
//   const appStrings = defineStrings({
//     en: { greeting: 'Hello {name}' },
//     ar: { greeting: 'مرحبًا {name}' },
//   });
//   const { t } = useI18n(appStrings);
//   t('greeting', { name: 'Lina' });
//
// English is the source: every key needs an English string, and TypeScript checks that the
// Arabic catalogue has the same keys. A missing Arabic string falls back to English.

export type Catalogue<K extends string> = { en: Record<K, string>; ar: Record<K, string> };

export function defineStrings<K extends string>(catalogue: Catalogue<K>): Catalogue<K> {
  return catalogue;
}

export type Params = Record<string, string | number>;

export function translate<K extends string>(
  catalogue: Catalogue<K>,
  lang: Language,
  key: K,
  params?: Params,
): string {
  const template = catalogue[lang][key] || catalogue.en[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

// Western digits in Arabic by default: Noon dashboards use them (synapse-arabic-rtl skill).
export function formatNumber(value: number, lang: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeOf(lang), options).format(value);
}

export function formatDate(value: Date, lang: Language, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeOf(lang), options ?? { dateStyle: 'medium' }).format(value);
}

// Gregorian calendar and Western digits in Arabic (Noon data is Gregorian); day-month in English.
export function localeOf(lang: Language): string {
  return lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
}

// "3 hours ago" / "قبل 3 ساعات", with Arabic dual and plural forms from Intl.
export function formatRelative(iso: string, lang: Language, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  // A data clock a little ahead of the browser must not read as "in 3 minutes".
  const seconds = Math.min(0, Math.round((then - now) / 1000));
  // 'always', not 'auto': "1 day ago" is honest where "yesterday" may name the wrong date.
  const format = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'always' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return lang === 'ar' ? 'الآن' : 'just now';
}

export function useI18n<K extends string = keyof typeof STARTER_STRINGS.en>(
  catalogue?: Catalogue<K>,
) {
  const lang = useLanguage();
  const strings = (catalogue ?? STARTER_STRINGS) as unknown as Catalogue<K>;
  return {
    lang,
    dir: directionOf(lang),
    setLang: setLanguage,
    t: (key: K, params?: Params) => translate(strings, lang, key, params),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, lang, options),
    formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) =>
      formatDate(value, lang, options),
    formatRelative: (iso: string) => formatRelative(iso, lang),
  };
}
