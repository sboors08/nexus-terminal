import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/AlertsPage.tsx',
  'src/pages/AlertsPage.module.css',
  'src/shared/realtime/alertsRealtime.ts',
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'test/alerts-realtime.test.mjs',
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
  pageSource,
  cssSource,
  helperSource,
  clientSource,
  hookSource,
  testSource,
  indexSource,
  tsconfigSource,
  packageSource,
] = await Promise.all([
  readFile(resolve(root, 'src/pages/AlertsPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/AlertsPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/alertsRealtime.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/realtimeClient.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useRealtimeMarketData.ts'), 'utf8'),
  readFile(resolve(root, 'test/alerts-realtime.test.mjs'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/index.ts'), 'utf8'),
  readFile(resolve(root, 'tsconfig.realtime-test.json'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'buildAlertsRealtimeView',
  'useRealtimeMarketData({',
  'symbols: realtimeSymbols',
  'realtime.status?.state ?? null',
  'realtimeLiveCount',
  'selectedRealtime.currentPriceLabel',
  'selectedRealtime.moveSinceAlertLabel',
  'selectedRealtime.alertPriceLabel',
  'moveSinceAlertPct',
  'alertPriceLabel',
  '.liveStatus_pending .liveDot',
  '.liveStatus_error .liveDot',
  '.priceLabel',
  "export * from './alertsRealtime'",
  'src/shared/realtime/alertsRealtime.ts',
  'test/alerts-realtime.test.mjs',
  '"verify:alerts-realtime"',
  'builds the current Alerts price and move since the alert',
];

const corpus = [
  pageSource,
  cssSource,
  helperSource,
  clientSource,
  hookSource,
  testSource,
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
      `Missing Alerts realtime files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Alerts realtime markers: ${missingMarkers.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Alerts Realtime Integration v0.1 is present.',
);
