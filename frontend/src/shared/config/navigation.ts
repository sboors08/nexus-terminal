import { ROUTES, type AppRoute } from '@/app/routing/routes';

export type NavigationItem = {
  label: string;
  shortLabel: string;
  path: AppRoute;
  end?: boolean;
};

export const PRIMARY_NAVIGATION: readonly NavigationItem[] = [
  { label: 'Dashboard', shortLabel: 'DB', path: ROUTES.dashboard, end: true },
  { label: 'Scanner', shortLabel: 'SC', path: ROUTES.scanner },
  { label: 'Workspace', shortLabel: 'WS', path: ROUTES.workspace },
  { label: 'Alerts', shortLabel: 'AL', path: ROUTES.alerts },
  { label: 'Market History', shortLabel: 'MH', path: ROUTES.marketHistory },
  { label: 'Replay', shortLabel: 'RP', path: ROUTES.replay },
  { label: 'Settings', shortLabel: 'ST', path: ROUTES.settings },
] as const;
