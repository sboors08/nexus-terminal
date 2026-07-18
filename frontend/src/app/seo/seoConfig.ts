import { buildLocalizedPath, DEFAULT_LOCALE, type Locale } from '@/shared/i18n/config';

const FALLBACK_SITE_ORIGIN = 'http://localhost:5173';

export const SEO_PRODUCT_NAME = 'NEXUS';
export const SEO_OG_IMAGE_PATH = '/nexus-og.png';

export function getSiteOrigin(): string {
  const configuredOrigin = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : FALLBACK_SITE_ORIGIN;

  return (configuredOrigin || runtimeOrigin || FALLBACK_SITE_ORIGIN).replace(/\/$/, '');
}

export function buildAbsoluteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteOrigin()}${normalizedPath}`;
}

export function getPublicLocaleAlternates(): Array<{ hrefLang: string; href: string }> {
  const locales: Locale[] = ['ru', 'en', 'zh-cn'];
  const alternates = locales.map((locale) => ({
    hrefLang: locale === 'zh-cn' ? 'zh-CN' : locale,
    href: buildAbsoluteUrl(buildLocalizedPath(locale)),
  }));

  return [
    ...alternates,
    {
      hrefLang: 'x-default',
      href: buildAbsoluteUrl(buildLocalizedPath(DEFAULT_LOCALE)),
    },
  ];
}
