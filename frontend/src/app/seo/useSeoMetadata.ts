import { useEffect } from 'react';

const MANAGED_ATTRIBUTE = 'data-nexus-seo';
const MANAGED_VALUE = 'managed';

type SeoAlternate = {
  hrefLang: string;
  href: string;
};

type SeoMetadata = {
  title: string;
  description?: string;
  robots: string;
  canonical?: string;
  alternates?: SeoAlternate[];
  openGraph?: {
    title: string;
    description: string;
    url: string;
    image: string;
    locale: string;
    alternateLocales?: string[];
    type?: string;
    siteName?: string;
  };
  twitter?: {
    title: string;
    description: string;
    image: string;
  };
  structuredData?: Record<string, unknown>;
};

function appendMeta(name: string, content: string, property = false) {
  const meta = document.createElement('meta');
  meta.setAttribute(MANAGED_ATTRIBUTE, MANAGED_VALUE);
  meta.setAttribute(property ? 'property' : 'name', name);
  meta.content = content;
  document.head.append(meta);
}

function appendLink(rel: string, href: string, hrefLang?: string) {
  const link = document.createElement('link');
  link.setAttribute(MANAGED_ATTRIBUTE, MANAGED_VALUE);
  link.rel = rel;
  link.href = href;
  if (hrefLang) link.hreflang = hrefLang;
  document.head.append(link);
}

export function useSeoMetadata(metadata: SeoMetadata) {
  const {
    title,
    description,
    robots,
    canonical,
    alternates,
    openGraph,
    twitter,
    structuredData,
  } = metadata;

  useEffect(() => {
    document.head
      .querySelectorAll(`[${MANAGED_ATTRIBUTE}]`)
      .forEach((element) => element.remove());

    document.title = title;
    appendMeta('robots', robots);

    if (description) appendMeta('description', description);
    if (canonical) appendLink('canonical', canonical);
    alternates?.forEach((alternate) => appendLink('alternate', alternate.href, alternate.hrefLang));

    if (openGraph) {
      appendMeta('og:title', openGraph.title, true);
      appendMeta('og:description', openGraph.description, true);
      appendMeta('og:type', openGraph.type ?? 'website', true);
      appendMeta('og:url', openGraph.url, true);
      appendMeta('og:image', openGraph.image, true);
      appendMeta('og:image:width', '1200', true);
      appendMeta('og:image:height', '630', true);
      appendMeta('og:locale', openGraph.locale, true);
      appendMeta('og:site_name', openGraph.siteName ?? 'NEXUS', true);
      openGraph.alternateLocales?.forEach((locale) => appendMeta('og:locale:alternate', locale, true));
    }

    if (twitter) {
      appendMeta('twitter:card', 'summary_large_image');
      appendMeta('twitter:title', twitter.title);
      appendMeta('twitter:description', twitter.description);
      appendMeta('twitter:image', twitter.image);
    }

    if (structuredData) {
      const script = document.createElement('script');
      script.setAttribute(MANAGED_ATTRIBUTE, MANAGED_VALUE);
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.append(script);
    }

    return () => {
      document.head
        .querySelectorAll(`[${MANAGED_ATTRIBUTE}="${MANAGED_VALUE}"]`)
        .forEach((element) => element.remove());
    };
  }, [
    title,
    description,
    robots,
    canonical,
    JSON.stringify(alternates),
    JSON.stringify(openGraph),
    JSON.stringify(twitter),
    JSON.stringify(structuredData),
  ]);
}
