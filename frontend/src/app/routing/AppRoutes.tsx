import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/app/layout/AppLayout';
import { AppShell } from '@/app/layout/AppShell';
import { PublicLayout } from '@/app/layout/PublicLayout';
import {
  APP_ROOT,
  APP_ROUTE_SEGMENTS,
  LEGACY_ROUTES,
  PUBLIC_LOCALE_ROUTE,
  ROUTES,
} from '@/app/routing/routes';
import { AlertsPage } from '@/pages/AlertsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MarketHistoryPage } from '@/pages/MarketHistoryPage';
import { MarketPage } from '@/pages/MarketPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PublicHomePage } from '@/pages/PublicHomePage';
import { ReplayPage } from '@/pages/ReplayPage';
import { ScannerPage } from '@/pages/ScannerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WorkspacePage } from '@/pages/WorkspacePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path={APP_ROOT} element={<AppLayout />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path={APP_ROUTE_SEGMENTS.scanner} element={<ScannerPage />} />
          <Route path={APP_ROUTE_SEGMENTS.market} element={<MarketPage />} />
          <Route path={APP_ROUTE_SEGMENTS.workspace} element={<WorkspacePage />} />
          <Route path={APP_ROUTE_SEGMENTS.alerts} element={<AlertsPage />} />
          <Route path={APP_ROUTE_SEGMENTS.marketHistory} element={<MarketHistoryPage />} />
          <Route path={APP_ROUTE_SEGMENTS.replay} element={<ReplayPage />} />
          <Route path={APP_ROUTE_SEGMENTS.settings} element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path={PUBLIC_LOCALE_ROUTE} element={<PublicLayout />}>
        <Route index element={<PublicHomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path={LEGACY_ROUTES.root} element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path={LEGACY_ROUTES.dashboard} element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path={LEGACY_ROUTES.scanner} element={<Navigate to={ROUTES.scanner} replace />} />
      <Route path={LEGACY_ROUTES.market} element={<Navigate to={ROUTES.market} replace />} />
      <Route path={LEGACY_ROUTES.workspace} element={<Navigate to={ROUTES.workspace} replace />} />
      <Route path={LEGACY_ROUTES.alerts} element={<Navigate to={ROUTES.alerts} replace />} />
      <Route path={LEGACY_ROUTES.marketHistory} element={<Navigate to={ROUTES.marketHistory} replace />} />
      <Route path={LEGACY_ROUTES.replay} element={<Navigate to={ROUTES.replay} replace />} />
      <Route path={LEGACY_ROUTES.settings} element={<Navigate to={ROUTES.settings} replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
