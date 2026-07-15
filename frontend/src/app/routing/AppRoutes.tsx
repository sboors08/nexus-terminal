import { Navigate, Route, Routes } from 'react-router';
import { AppShell } from '@/app/layout/AppShell';
import { ROUTES } from '@/app/routing/routes';
import { AlertsPage } from '@/pages/AlertsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MarketHistoryPage } from '@/pages/MarketHistoryPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ReplayPage } from '@/pages/ReplayPage';
import { ScannerPage } from '@/pages/ScannerPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { WorkspacePage } from '@/pages/WorkspacePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path={ROUTES.scanner} element={<ScannerPage />} />
        <Route path={ROUTES.workspace} element={<WorkspacePage />} />
        <Route path={ROUTES.alerts} element={<AlertsPage />} />
        <Route path={ROUTES.marketHistory} element={<MarketHistoryPage />} />
        <Route path={ROUTES.replay} element={<ReplayPage />} />
        <Route path={ROUTES.settings} element={<SettingsPage />} />
        <Route path="/dashboard" element={<Navigate to={ROUTES.dashboard} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
