import { Outlet } from 'react-router';
import { useSeoMetadata } from '@/app/seo/useSeoMetadata';
import { FeedbackProvider } from '@/shared/feedback/FeedbackProvider';

export function AppLayout() {
  useSeoMetadata({
    title: 'NEXUS Terminal',
    description: 'Private analytical workspace of the NEXUS trading terminal.',
    robots: 'noindex, nofollow, noarchive, nosnippet',
  });

  return (
    <FeedbackProvider>
      <Outlet />
    </FeedbackProvider>
  );
}
