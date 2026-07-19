import {
  access,
  readFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/DashboardPage.tsx',
  'src/pages/DashboardPage.module.css',
  'src/shared/realtime/dashboardScannerMetrics.ts',
  'src/shared/realtime/useDashboardScannerMetrics.ts',
  'test/dashboard-scanner-metrics.test.mjs',
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
  ...requiredFiles.map((file) =>
    readFile(resolve(root, file), 'utf8'),
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
  'MARKET_SCANNER_METRICS_PATH',
  'fetchMarketScannerMetrics',
  'buildDashboardScannerMetricView',
  'useDashboardScannerMetrics',
  'globalThis.setInterval',
  'scannerSymbols',
  'dashboardScannerRows',
  'scannerLiveCount',
  'view.priceLabel',
  'view.quoteVolumeLabel',
  'view.tradesCountLabel',
  'view.speedLabel',
  "export * from './dashboardScannerMetrics'",
  "export * from './useDashboardScannerMetrics'",
  'dashboard-scanner-metrics.test.mjs',
  '"verify:dashboard-scanner-metrics"',
  'builds a live Dashboard scanner metric view',
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
      'Missing Dashboard scanner files: '
      + missingFiles.join(', '),
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      'Missing Dashboard scanner markers: '
      + missingMarkers.join(', '),
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Dashboard Market Scanner Integration v0.1 is present.',
);
