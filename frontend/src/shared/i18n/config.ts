export type TextDirection = 'ltr' | 'rtl';

export type LocaleConfig = {
  locale: string;
  htmlLang: string;
  direction: TextDirection;
  label: string;
};

export const LOCALE_CONFIG = {
  ru: {
    locale: 'ru',
    htmlLang: 'ru',
    direction: 'ltr',
    label: 'Русский',
  },
  en: {
    locale: 'en',
    htmlLang: 'en',
    direction: 'ltr',
    label: 'English',
  },
  'zh-cn': {
    locale: 'zh-cn',
    htmlLang: 'zh-CN',
    direction: 'ltr',
    label: '简体中文',
  },
} as const satisfies Record<string, LocaleConfig>;

export type Locale = keyof typeof LOCALE_CONFIG;

export const DEFAULT_LOCALE: Locale = 'ru';
export const SUPPORTED_LOCALES = Object.keys(LOCALE_CONFIG) as Locale[];

export function normalizeLocale(value: string | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();

  return normalizedValue in LOCALE_CONFIG ? (normalizedValue as Locale) : null;
}

export function getLocaleConfig(locale: Locale): (typeof LOCALE_CONFIG)[Locale] {
  return LOCALE_CONFIG[locale];
}

export function buildLocalizedPath(locale: Locale, path = ''): string {
  const normalizedPath = path.replace(/^\/+/, '');

  return normalizedPath ? `/${locale}/${normalizedPath}` : `/${locale}`;
}
