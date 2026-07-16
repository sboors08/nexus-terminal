import { useEffect } from 'react';

const ROBOTS_META_SELECTOR = 'meta[name="robots"]';

export function useRobotsMeta(content: string) {
  useEffect(() => {
    const existingMeta = document.head.querySelector<HTMLMetaElement>(ROBOTS_META_SELECTOR);
    const robotsMeta = existingMeta ?? document.createElement('meta');
    const previousContent = existingMeta?.content;

    if (!existingMeta) {
      robotsMeta.name = 'robots';
      document.head.append(robotsMeta);
    }

    robotsMeta.content = content;

    return () => {
      if (!existingMeta) {
        robotsMeta.remove();
        return;
      }

      if (previousContent) {
        existingMeta.content = previousContent;
      } else {
        existingMeta.removeAttribute('content');
      }
    };
  }, [content]);
}
