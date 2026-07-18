import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router';
import {
  buildLocalizedPath,
  DEFAULT_LOCALE,
  getLocaleConfig,
  normalizeLocale,
} from '@/shared/i18n/config';
import { I18nProvider } from '@/shared/i18n/I18nProvider';

export function PublicLayout() {
  const { locale: localeParam } = useParams();
  const locale = normalizeLocale(localeParam);

  useEffect(() => {
    if (!locale) return undefined;

    const localeConfig = getLocaleConfig(locale);
    const root = document.documentElement;
    const previousLanguage = root.lang;
    const previousDirection = root.dir;

    root.lang = localeConfig.htmlLang;
    root.dir = localeConfig.direction;

    return () => {
      root.lang = previousLanguage;
      root.dir = previousDirection;
    };
  }, [locale]);

  if (!locale) {
    return <Navigate to={buildLocalizedPath(DEFAULT_LOCALE)} replace />;
  }

  if (localeParam !== locale) {
    return <Navigate to={buildLocalizedPath(locale)} replace />;
  }

  return (
    <I18nProvider locale={locale}>
      <Outlet />
    </I18nProvider>
  );
}
