import type { Locale } from '@/shared/i18n/config';
import { enDictionary } from './en';
import { ruDictionary } from './ru';
import type { TranslationDictionary } from './types';
import { zhCnDictionary } from './zh-cn';

export const DICTIONARIES = {
  ru: ruDictionary,
  en: enDictionary,
  'zh-cn': zhCnDictionary,
} satisfies Record<Locale, TranslationDictionary>;

export function getDictionary(locale: Locale): TranslationDictionary {
  return DICTIONARIES[locale];
}

export type { TranslationDictionary } from './types';
