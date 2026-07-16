import { Outlet } from 'react-router';
import { useRobotsMeta } from '@/app/seo/useRobotsMeta';

export function AppLayout() {
  useRobotsMeta('noindex, nofollow, noarchive');

  return <Outlet />;
}
