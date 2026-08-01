import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/WatchlistPage.tsx',
  'src/pages/WatchlistPage.module.css',
  'src/shared/realtime/watchlistRealtime.ts',
  'test/watchlist-realtime.test.mjs',
  'test/watchlist-realtime-ui.test.mjs',
];

const missingFiles = [];

for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const [
  routesSource,
  appRoutesSource,
  appShellSource,
  pageSource,
  cssSource,
  helperSource,
  indexSource,
  uiTestSource,
  tsconfigSource,
  packageSource,
] = await Promise.all([
  readFile(resolve(root, 'src/app/routing/routes.ts'), 'utf8'),
  readFile(resolve(root, 'src/app/routing/AppRoutes.tsx'), 'utf8'),
  readFile(resolve(root, 'src/app/layout/AppShell.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/WatchlistPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/WatchlistPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/watchlistRealtime.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/index.ts'), 'utf8'),
  readFile(resolve(root, 'test/watchlist-realtime-ui.test.mjs'), 'utf8'),
  readFile(resolve(root, 'tsconfig.realtime-test.json'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  "watchlist: 'watchlist'",
  'ROUTES.watchlist',
  'WatchlistPage',
  'WATCHLIST_INSTRUMENTS',
  'WATCHLIST_SYMBOLS',
  'symbols: WATCHLIST_SYMBOLS',
  'buildWatchlistRealtimeView',
  'Binance USDⓈ-M Futures',
  'ОЖИДАНИЕ ПОТОКА',
  'ОШИБКА ПОТОКА',
  '.panelStatusLive',
  '.panelStatusPending',
  '.panelStatusError',
  "export * from './watchlistRealtime'",
  'src/shared/realtime/watchlistRealtime.ts',
  'test/watchlist-realtime.test.mjs',
  'test/watchlist-realtime-ui.test.mjs',
  '"verify:watchlist-realtime"',
];

const corpus = [
  routesSource,
  appRoutesSource,
  appShellSource,
  pageSource,
  cssSource,
  helperSource,
  indexSource,
  uiTestSource,
  tsconfigSource,
  packageSource,
].join('\n');

const missingMarkers = requiredMarkers.filter(
  (marker) => !corpus.includes(marker),
);

const legacyMarkers = [
  'Binance Spot',
  'за которыми ты следишь',
  'symbol: instrument.symbol',
  'styles.liveDot',
];

const presentLegacyMarkers = legacyMarkers.filter(
  (marker) => pageSource.includes(marker),
);

const realtimeHookCount =
  pageSource.match(
    /useRealtimeMarketData\(/gu,
  )?.length
  ?? 0;

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
  || presentLegacyMarkers.length > 0
  || realtimeHookCount !== 1
) {
  if (missingFiles.length > 0) {
    console.error(
      `Missing Watchlist files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Watchlist integrity markers: ${missingMarkers.join(', ')}`,
    );
  }

  if (presentLegacyMarkers.length > 0) {
    console.error(
      `Legacy Watchlist markers remain: ${presentLegacyMarkers.join(', ')}`,
    );
  }

  if (realtimeHookCount !== 1) {
    console.error(
      `Expected one Watchlist realtime hook, found ${realtimeHookCount}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(
    'NEXUS frontend verified: Watchlist Data Integrity v0.1 is present.',
  );
}