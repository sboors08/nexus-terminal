import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredTokens = [
  '--nexus-font-family-sans',
  '--nexus-space-1',
  '--nexus-radius-sm',
  '--nexus-color-long',
  '--nexus-color-short',
  '--nexus-color-stage-observation',
  '--nexus-color-stage-approach',
  '--nexus-color-stage-confirmation',
  '--nexus-color-stage-triggered',
  '--nexus-color-info',
];

const requiredRoutes = [
  "export const APP_ROOT = '/app'",
  "scanner: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.scanner}`",
  "workspace: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.workspace}`",
  "alerts: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.alerts}`",
  "marketHistory: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.marketHistory}`",
  "replay: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.replay}`",
  "settings: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.settings}`",
  "export const PUBLIC_LOCALE_ROUTE = '/:locale'",
];

const requiredLocales = [
  "export const DEFAULT_LOCALE: Locale = 'ru'",
  "ru:",
  "en:",
  "'zh-cn':",
  'htmlLang:',
  'direction:',
];

const [tokensCss, routesSource, localeConfigSource] = await Promise.all([
  readFile(resolve(root, 'src/styles/tokens.css'), 'utf8'),
  readFile(resolve(root, 'src/app/routing/routes.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/i18n/config.ts'), 'utf8'),
]);

const missingTokens = requiredTokens.filter((token) => !tokensCss.includes(token));
const missingRoutes = requiredRoutes.filter((route) => !routesSource.includes(route));
const missingLocales = requiredLocales.filter((locale) => !localeConfigSource.includes(locale));

if (missingTokens.length > 0 || missingRoutes.length > 0 || missingLocales.length > 0) {
  if (missingTokens.length > 0) {
    console.error(`Missing design tokens: ${missingTokens.join(', ')}`);
  }

  if (missingRoutes.length > 0) {
    console.error(`Missing routes: ${missingRoutes.join(', ')}`);
  }

  if (missingLocales.length > 0) {
    console.error(`Missing i18n configuration: ${missingLocales.join(', ')}`);
  }

  process.exit(1);
}

console.log('NEXUS foundation verified: routes, locales and mandatory design tokens are present.');
