export const ROUTES = {
  dashboard: '/',
  scanner: '/scanner',
  workspace: '/workspace',
  alerts: '/alerts',
  marketHistory: '/market-history',
  replay: '/replay',
  settings: '/settings',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
