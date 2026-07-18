import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredTokens = [
  '--nexus-font-family-sans',
  '--nexus-space-1',
  '--nexus-radius-sm',
  '--nexus-color-long',
  '--nexus-color-short',
  '--nexus-color-stage-observation',
  '--nexus-color-stage-approach',
  '--nexus-color-stage-confirmation',
  '--nexus-color-stage-triggered',
  '--nexus-color-info',
];

const requiredRoutes = [
  "export const APP_ROOT = '/app'",
  "scanner: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.scanner}`",
  "market: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.market}`",
  "workspace: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.workspace}`",
  "alerts: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.alerts}`",
  "marketHistory: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.marketHistory}`",
  "replay: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.replay}`",
  "settings: `${APP_ROOT}/${APP_ROUTE_SEGMENTS.settings}`",
  "export const PUBLIC_LOCALE_ROUTE = '/:locale'",
];

const requiredLocales = [
  "export const DEFAULT_LOCALE: Locale = 'ru'",
  'ru:',
  'en:',
  "'zh-cn':",
  'htmlLang:',
  'direction:',
];

const requiredApiMethods = [
  'getMarketSymbols()',
  'getMarketCandles(symbol: string, timeframe: string)',
  'getSetups()',
  'getSetupById(setupId: string)',
  'getWorkspaceSnapshot(setupId?: string)',
  'getAlerts()',
  'getSetupHistory()',
  'getReplaySession(sessionId?: string)',
  'sendFeedback(payload: FeedbackPayload)',
  'sendSetupFeedback(payload: SetupFeedback)',
];

const requiredMarketModeMarkers = [
  "from '@/assets/bear-market.png'",
  "title: 'BEARISH'",
  "trend: 'TRENDING DOWN'",
  "risk: 'RISK OFF'",
  'automaticScore',
];


const requiredSetupContextMarkers = [
  "params.set('setupId', context.setupId)",
  'getSetupById(resolvedSetupId)',
  'getWorkspaceSnapshot(resolvedSetupId)',
  'buildWorkspaceUrl(ROUTES.workspace',
  'buildReplayUrl(ROUTES.replay',
];

const dataPages = [
  'DashboardPage.tsx',
  'ScannerPage.tsx',
  'MarketPage.tsx',
  'WorkspacePage.tsx',
  'AlertsPage.tsx',
  'MarketHistoryPage.tsx',
  'ReplayPage.tsx',
];

const [
  tokensCss,
  routesSource,
  localeConfigSource,
  contractsSource,
  setupContextSource,
  alertsDataSource,
  historyDataSource,
  replayDataSource,
  ...pageSources
] = await Promise.all([
  readFile(resolve(root, 'src/styles/tokens.css'), 'utf8'),
  readFile(resolve(root, 'src/app/routing/routes.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/i18n/config.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/api/contracts.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/routing/setupContext.ts'), 'utf8'),
  readFile(resolve(root, 'src/features/alerts/alertsData.ts'), 'utf8'),
  readFile(resolve(root, 'src/features/market-history/marketHistoryData.ts'), 'utf8'),
  readFile(resolve(root, 'src/features/replay/replayData.ts'), 'utf8'),
  ...dataPages.map((page) => readFile(resolve(root, 'src/pages', page), 'utf8')),
]);

const missingTokens = requiredTokens.filter((token) => !tokensCss.includes(token));
const missingRoutes = requiredRoutes.filter((route) => !routesSource.includes(route));
const missingLocales = requiredLocales.filter((locale) => !localeConfigSource.includes(locale));
const missingApiMethods = requiredApiMethods.filter((method) => !contractsSource.includes(method));
const dashboardSource = pageSources[0];
const missingMarketModeMarkers = requiredMarketModeMarkers.filter((marker) => !dashboardSource.includes(marker));
const setupContextCorpus = [
  setupContextSource,
  alertsDataSource,
  historyDataSource,
  replayDataSource,
  ...pageSources,
].join('\n');
const missingSetupContextMarkers = requiredSetupContextMarkers.filter((marker) => !setupContextCorpus.includes(marker));
const setupIdMissingFromAlerts = !alertsDataSource.includes('setupId: string;');
const legacySetupQueryPresent = pageSources
  .filter((_, index) => index !== 0 && index !== 2)
  .some((source) => source.includes('&setup=') || source.includes('?symbol=${'));
let bearAssetMissing = false;
try {
  await access(resolve(root, 'src/assets/bear-market.png'));
} catch {
  bearAssetMissing = true;
}


const [
  publicHomeSource,
  seoMetadataSource,
  appLayoutSource,
  appRoutesSource,
  indexHtmlSource,
  robotsSource,
  sitemapSource,
  packageSource,
] = await Promise.all([
  readFile(resolve(root, 'src/pages/PublicHomePage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/app/seo/useSeoMetadata.ts'), 'utf8'),
  readFile(resolve(root, 'src/app/layout/AppLayout.tsx'), 'utf8'),
  readFile(resolve(root, 'src/app/routing/AppRoutes.tsx'), 'utf8'),
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'public/robots.txt'), 'utf8'),
  readFile(resolve(root, 'public/sitemap.xml'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredSeoMarkers = [
  "robots: 'index, follow, max-image-preview:large'",
  "robots: 'noindex, nofollow, noarchive, nosnippet'",
  "appendLink('canonical'",
  "appendLink('alternate'",
  "appendMeta('og:title'",
  "appendMeta('twitter:card'",
  "'@type': 'SoftwareApplication'",
  '<Navigate to={PUBLIC_ROUTES.home} replace />',
  'Disallow: /app',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
  '"generate:seo": "node scripts/generate-seo.mjs"',
  '<link rel="manifest" href="/site.webmanifest" />',
];

const seoCorpus = [
  publicHomeSource,
  seoMetadataSource,
  appLayoutSource,
  appRoutesSource,
  indexHtmlSource,
  robotsSource,
  sitemapSource,
  packageSource,
].join('\n');
const missingSeoMarkers = requiredSeoMarkers.filter((marker) => !seoCorpus.includes(marker));
const requiredSeoAssets = [
  'public/favicon.svg',
  'public/site.webmanifest',
  'public/nexus-og.png',
  'scripts/generate-seo.mjs',
];
const missingSeoAssets = [];
for (const asset of requiredSeoAssets) {
  try {
    await access(resolve(root, asset));
  } catch {
    missingSeoAssets.push(asset);
  }
}


const [
  appShellSource,
  appShellCss,
  dashboardCss,
  scannerCss,
  workspaceCss,
  alertsCss,
  replayCss,
] = await Promise.all([
  readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8'),
  readFile(resolve(root, 'src/app/layout/AppShell.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/DashboardPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/ScannerPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/WorkspacePage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/AlertsPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/pages/ReplayPage.module.css'), 'utf8'),
]);

const requiredMobileMarkers = [
  'MOBILE_PRIMARY_LINKS',
  'mobileNavigation',
  'mobileMorePanel',
  '@media (max-width: 820px)',
  'scroll-snap-type: x mandatory',
  'grid-template-columns: minmax(0, 1fr) auto auto',
  'bottom: 72px',
];
const mobileCorpus = [
  appShellSource,
  appShellCss,
  dashboardCss,
  scannerCss,
  workspaceCss,
  alertsCss,
  replayCss,
].join('\n');
const missingMobileMarkers = requiredMobileMarkers.filter((marker) => !mobileCorpus.includes(marker));

const directFixtureImports = pageSources.flatMap((source, index) => (
  source.includes("from '@/features/") && source.includes('Data')
    ? [dataPages[index]]
    : []
));

if (
  missingTokens.length > 0
  || missingRoutes.length > 0
  || missingLocales.length > 0
  || missingApiMethods.length > 0
  || missingMarketModeMarkers.length > 0
  || missingSetupContextMarkers.length > 0
  || setupIdMissingFromAlerts
  || legacySetupQueryPresent
  || bearAssetMissing
  || missingSeoMarkers.length > 0
  || missingSeoAssets.length > 0
  || missingMobileMarkers.length > 0
  || directFixtureImports.length > 0
) {
  if (missingTokens.length > 0) console.error(`Missing design tokens: ${missingTokens.join(', ')}`);
  if (missingRoutes.length > 0) console.error(`Missing routes: ${missingRoutes.join(', ')}`);
  if (missingLocales.length > 0) console.error(`Missing i18n configuration: ${missingLocales.join(', ')}`);
  if (missingApiMethods.length > 0) console.error(`Missing Mock API methods: ${missingApiMethods.join(', ')}`);
  if (missingMarketModeMarkers.length > 0) console.error(`Missing BTC Market Mode markers: ${missingMarketModeMarkers.join(', ')}`);
  if (missingSetupContextMarkers.length > 0) console.error(`Missing Setup Context markers: ${missingSetupContextMarkers.join(', ')}`);
  if (setupIdMissingFromAlerts) console.error('Alert view data does not include setupId.');
  if (legacySetupQueryPresent) console.error('Legacy symbol-only or setup query links remain in data pages.');
  if (bearAssetMissing) console.error('Missing BTC Market Mode asset: src/assets/bear-market.png');
  if (missingSeoMarkers.length > 0) console.error(`Missing SEO Foundation markers: ${missingSeoMarkers.join(', ')}`);
  if (missingSeoAssets.length > 0) console.error(`Missing SEO Foundation assets: ${missingSeoAssets.join(', ')}`);
  if (missingMobileMarkers.length > 0) console.error(`Missing Mobile Adaptation markers: ${missingMobileMarkers.join(', ')}`);
  if (directFixtureImports.length > 0) {
    console.error(`Data pages import fixtures directly: ${directFixtureImports.join(', ')}`);
  }
  process.exit(1);
}

console.log('NEXUS foundation verified: routes, locales, design tokens, unified Mock API, BTC Market Mode, Setup Context and SEO Foundation and Mobile Adaptation are present.');
