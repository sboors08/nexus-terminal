import { Outlet } from 'react-router';
import { useRobotsMeta } from '@/app/seo/useRobotsMeta';
import { FeedbackProvider } from '@/shared/feedback/FeedbackProvider';

export function AppLayout() {
  useRobotsMeta('noindex, nofollow, noarchive');

  return (
    <FeedbackProvider>
      <Outlet />
    </FeedbackProvider>
  );
}
