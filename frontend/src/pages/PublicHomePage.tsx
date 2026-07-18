import { useMemo } from 'react';
import { Link } from 'react-router';
import { ROUTES } from '@/app/routing/routes';
import {
  buildAbsoluteUrl,
  getPublicLocaleAlternates,
  SEO_OG_IMAGE_PATH,
  SEO_PRODUCT_NAME,
} from '@/app/seo/seoConfig';
import { useSeoMetadata } from '@/app/seo/useSeoMetadata';
import {
  buildLocalizedPath,
  LOCALE_CONFIG,
  SUPPORTED_LOCALES,
} from '@/shared/i18n/config';
import { useI18n } from '@/shared/i18n/I18nProvider';
import styles from './PublicHomePage.module.css';



export function PublicHomePage() {
  const { dictionary, locale, htmlLang } = useI18n();
  const copy = dictionary.publicHome;
  const canonical = buildAbsoluteUrl(buildLocalizedPath(locale));
  const ogImage = buildAbsoluteUrl(SEO_OG_IMAGE_PATH);
  const alternates = useMemo(() => getPublicLocaleAlternates(), []);



  useSeoMetadata({
    title: copy.seo.title,
    description: copy.seo.description,
    robots: 'index, follow, max-image-preview:large',
    canonical,
    alternates,
    openGraph: {
      title: copy.seo.title,
      description: copy.seo.description,
      url: canonical,
      image: ogImage,
      locale: copy.seo.ogLocale,
      alternateLocales: copy.seo.ogAlternateLocales,
      siteName: SEO_PRODUCT_NAME,
    },
    twitter: {
      title: copy.seo.title,
      description: copy.seo.description,
      image: ogImage,
    },
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'NEXUS Trading Terminal',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      url: canonical,
      description: copy.seo.description,
      inLanguage: htmlLang,
    },
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.logo} to={buildLocalizedPath(locale)} aria-label="NEXUS">
          <span>N</span>
          <strong>NEXUS</strong>
        </Link>

        <nav className={styles.mainNavigation} aria-label="Primary navigation">
          <a href="#features">{copy.navigation.features}</a>
          <a href="#workflow">{copy.navigation.workflow}</a>
        </nav>

        <div className={styles.headerActions}>
          <nav className={styles.localeNavigation} aria-label={copy.navigation.language}>
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <Link
                key={supportedLocale}
                className={supportedLocale === locale ? styles.activeLocale : undefined}
                to={buildLocalizedPath(supportedLocale)}
                lang={LOCALE_CONFIG[supportedLocale].htmlLang}
                aria-current={supportedLocale === locale ? 'page' : undefined}
              >
                {supportedLocale === 'zh-cn' ? '中文' : supportedLocale.toUpperCase()}
              </Link>
            ))}
          </nav>
          <Link className={styles.headerTerminalLink} to={ROUTES.dashboard}>
            {copy.navigation.terminal}
          </Link>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span />{copy.hero.eyebrow}</div>
            <h1>
              {copy.hero.titleStart}
              <span>{copy.hero.titleAccent}</span>
            </h1>
            <p className={styles.heroDescription}>{copy.hero.description}</p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to={ROUTES.dashboard}>
                {copy.hero.primaryAction}<span aria-hidden="true">↗</span>
              </Link>
              <a className={styles.secondaryAction} href="#features">
                {copy.hero.secondaryAction}<span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className={styles.heroNote}><span>i</span>{copy.hero.note}</p>
          </div>

          <div className={styles.terminalPreview} aria-label={copy.preview.heading}>
            <img
              className={styles.terminalPreviewImage}
              src="/nexus-setup-preview.webp"
              width="855"
              height="705"
              alt={copy.preview.heading}
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </section>

        <section className={styles.features} id="features">
          <div className={styles.sectionIntro}>
            <div className={styles.eyebrow}><span />{copy.features.eyebrow}</div>
            <h2>{copy.features.title}</h2>
            <p>{copy.features.description}</p>
          </div>
          <div className={styles.featureGrid}>
            {copy.features.items.map((item) => (
              <article className={styles.featureCard} key={item.index}>
                <span>{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflow} id="workflow">
          <div className={styles.workflowHeading}>
            <div className={styles.eyebrow}><span />{copy.workflow.eyebrow}</div>
            <h2>{copy.workflow.title}</h2>
          </div>
          <ol className={styles.workflowList}>
            {copy.workflow.steps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div><h3>{step.title}</h3><p>{step.description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.finalCta}>
          <div>
            <span>NEXUS TERMINAL</span>
            <h2>{copy.finalCta.title}</h2>
            <p>{copy.finalCta.description}</p>
          </div>
          <Link to={ROUTES.dashboard}>{copy.finalCta.action}<span aria-hidden="true">↗</span></Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <strong>{copy.footer.product}</strong>
        <p>{copy.footer.disclaimer}</p>
        <span>© {new Date().getFullYear()} NEXUS</span>
      </footer>
    </div>
  );
}
