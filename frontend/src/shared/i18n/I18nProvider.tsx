import { createContext, useContext, type PropsWithChildren } from 'react';
import { getLocaleConfig, type Locale } from '@/shared/i18n/config';
import { getDictionary, type TranslationDictionary } from '@/shared/i18n/dictionaries';

type I18nContextValue = {
  locale: Locale;
  htmlLang: string;
  direction: 'ltr' | 'rtl';
  dictionary: TranslationDictionary;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = PropsWithChildren<{
  locale: Locale;
}>;

export function I18nProvider({ locale, children }: I18nProviderProps) {
  const localeConfig = getLocaleConfig(locale);
  const value: I18nContextValue = {
    locale,
    htmlLang: localeConfig.htmlLang,
    direction: localeConfig.direction,
    dictionary: getDictionary(locale),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
