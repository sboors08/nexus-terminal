export const APP_ROOT = '/app' as const;

export const APP_ROUTE_SEGMENTS = {
  scanner: 'scanner',
  market: 'market',
  workspace: 'workspace',
  alerts: 'alerts',
  watchlist: 'watchlist',
  marketHistory: 'market-history',
  replay: 'replay',
  settings: 'settings',
} as const;

export const ROUTES = {
  dashboard: APP_ROOT,
  scanner: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.scanner}`,
  market: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.market}`,
  workspace: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.workspace}`,
  alerts: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.alerts}`,
  watchlist: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.watchlist}`,
  marketHistory: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.marketHistory}`,
  replay: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.replay}`,
  settings: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.settings}`,
} as const;

export const PUBLIC_ROUTES = {
  home: '/ru',
  ru: '/ru',
  en: '/en',
  zhCn: '/zh-cn',
} as const;

export const LEGACY_ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  scanner: '/scanner',
  market: '/market',
  workspace: '/workspace',
  alerts: '/alerts',
  watchlist: '/watchlist',
  marketHistory: '/market-history',
  replay: '/replay',
  settings: '/settings',
} as const;

export const PUBLIC_LOCALE_ROUTE = '/:locale' as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
