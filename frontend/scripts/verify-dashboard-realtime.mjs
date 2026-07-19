import {
  access,
  readFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/DashboardPage.tsx',
  'src/pages/DashboardPage.module.css',
  'src/shared/realtime/dashboardRealtime.ts',
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'test/dashboard-realtime.test.mjs',
];

const missingFiles = [];

for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const sources = await Promise.all([
  readFile(
    resolve(root, 'src/pages/DashboardPage.tsx'),
    'utf8',
  ),
  readFile(
    resolve(root, 'src/pages/DashboardPage.module.css'),
    'utf8',
  ),
  readFile(
    resolve(
      root,
      'src/shared/realtime/dashboardRealtime.ts',
    ),
    'utf8',
  ),
  readFile(
    resolve(root, 'src/shared/realtime/realtimeClient.ts'),
    'utf8',
  ),
  readFile(
    resolve(
      root,
      'src/shared/realtime/useRealtimeMarketData.ts',
    ),
    'utf8',
  ),
  readFile(
    resolve(root, 'test/dashboard-realtime.test.mjs'),
    'utf8',
  ),
  readFile(
    resolve(root, 'src/shared/realtime/index.ts'),
    'utf8',
  ),
  readFile(
    resolve(root, 'tsconfig.realtime-test.json'),
    'utf8',
  ),
  readFile(
    resolve(root, 'package.json'),
    'utf8',
  ),
]);

const corpus = sources.join('\n');

const requiredMarkers = [
  'buildDashboardRealtimeView',
  'normalizeDashboardRealtimeSymbol',
  'useRealtimeMarketData({',
  'symbols: realtimeSymbols',
  'dashboardRealtime.connectionLabel',
  'dashboardRealtime.liveCount',
  'btcRealtime.priceLabel',
  'realtime.sourceLabel',
  'styles.realtimeStatus',
  '.realtimeStatus_live',
  '.sourceLive',
  "export * from './dashboardRealtime'",
  'src/shared/realtime/dashboardRealtime.ts',
  'test/dashboard-realtime.test.mjs',
  '"verify:dashboard-realtime"',
  'shows a clear label when stream change is unavailable',
  "'\\u043d\\u0435\\u0442 \\u0434\\u0430\\u043d\\u043d\\u044b\\u0445'",
];

const missingMarkers = requiredMarkers.filter(
  (marker) => !corpus.includes(marker),
);

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
) {
  if (missingFiles.length > 0) {
    console.error(
      'Missing Dashboard realtime files: '
      + missingFiles.join(', '),
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      'Missing Dashboard realtime markers: '
      + missingMarkers.join(', '),
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Dashboard Realtime Integration v0.1 is present.',
);
