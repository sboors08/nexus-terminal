import { Outlet, useParams } from 'react-router';
import { useEffect } from 'react';
import { useRobotsMeta } from '@/app/seo/useRobotsMeta';

export function PublicLayout() {
  const { locale } = useParams();

  useRobotsMeta('index, follow');

  useEffect(() => {
    if (!locale) {
      return undefined;
    }

    const previousLanguage = document.documentElement.lang;
    document.documentElement.lang = locale;

    return () => {
      document.documentElement.lang = previousLanguage;
    };
  }, [locale]);

  return <Outlet />;
}
