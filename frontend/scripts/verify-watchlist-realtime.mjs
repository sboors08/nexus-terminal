import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/WatchlistPage.tsx',
  'src/pages/WatchlistPage.module.css',
  'src/shared/realtime/watchlistRealtime.ts',
  'test/watchlist-realtime.test.mjs',
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
  readFile(resolve(root, 'tsconfig.realtime-test.json'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  "watchlist: 'watchlist'",
  'ROUTES.watchlist',
  'WatchlistPage',
  'WATCHLIST_INSTRUMENTS',
  'useRealtimeMarketData({',
  'buildWatchlistRealtimeView',
  '.instrumentRow',
  "export * from './watchlistRealtime'",
  'src/shared/realtime/watchlistRealtime.ts',
  'test/watchlist-realtime.test.mjs',
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
  tsconfigSource,
  packageSource,
].join('\n');

const missingMarkers = requiredMarkers.filter(
  (marker) => !corpus.includes(marker),
);

if (missingFiles.length > 0 || missingMarkers.length > 0) {
  if (missingFiles.length > 0) {
    console.error(
      `Missing Watchlist realtime files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Watchlist realtime markers: ${missingMarkers.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Watchlist Realtime Integration v0.1 is present.',
);
