export const APP_ROOT = '/app' as const;

export const APP_ROUTE_SEGMENTS = {
  scanner: 'scanner',
  workspace: 'workspace',
  alerts: 'alerts',
  marketHistory: 'market-history',
  replay: 'replay',
  settings: 'settings',
} as const;

export const ROUTES = {
  dashboard: APP_ROOT,
  scanner: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.scanner}`,
  workspace: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.workspace}`,
  alerts: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.alerts}`,
  marketHistory: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.marketHistory}`,
  replay: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.replay}`,
  settings: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.settings}`,
} as const;

export const LEGACY_ROUTES = {
  root: '/',
  dashboard: '/dashboard',
  scanner: '/scanner',
  workspace: '/workspace',
  alerts: '/alerts',
  marketHistory: '/market-history',
  replay: '/replay',
  settings: '/settings',
} as const;

export const PUBLIC_LOCALE_ROUTE = '/:locale' as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
