import {
  access,
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/modules/realtime-market-data/scanner-windows.ts',
  'src/modules/realtime-market-data/market-scanner-metrics.ts',
  'src/modules/realtime-market-data/market-scanner-metrics-series.ts',
  'src/modules/realtime-market-data/realtime-market-data.types.ts',
  'src/modules/realtime-market-data/binance-websocket.service.ts',
  'src/modules/realtime-market-data/realtime-market-data.routes.ts',
  'test/market-scanner-metrics.test.ts',
  'test/market-scanner-metrics-series.test.ts',
  'test/scanner-window-route.test.ts',
  'test/binance-websocket.test.ts',
];

const missingFiles = [];

for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

if (missingFiles.length > 0) {
  console.error(
    'Missing market scanner files: '
      + missingFiles.join(', '),
  );
  process.exit(1);
}

const sources = await Promise.all([
  ...requiredFiles.map(
    (file) =>
      readFile(resolve(root, file), 'utf8'),
  ),
  readFile(
    resolve(root, 'package.json'),
    'utf8',
  ),
]);

const requiredMarkers = [
  'export const MARKET_SCANNER_WINDOW_IDS',
  'export type MarketScannerWindowId',
  'DEFAULT_MARKET_SCANNER_WINDOW',
  'MARKET_SCANNER_WINDOW_MS',
  'export class MarketScannerMetricsWindow',
  'export class MarketScannerMetricsSeries',
  'scannerWindow: MarketScannerWindowId',
  'getScannerMetrics?(',
  'scannerWindow?: MarketScannerWindowId',
  'new MarketScannerMetricsSeries',
  'isMarketScannerWindowId',
  '/market/realtime/scanner-metrics',
  'invalid_scanner_window',
  'aggregates multiple scanner windows from one trade stream',
  'uses the configured scanner window duration',
  'scanner metrics route forwards and validates scannerWindow',
  '"verify:market-scanner-metrics"',
  'test/market-scanner-metrics-series.test.ts',
  'test/scanner-window-route.test.ts',
];

const corpus = sources.join('\n');

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(marker),
  );

if (missingMarkers.length > 0) {
  console.error(
    'Missing market scanner markers: '
      + missingMarkers.join(', '),
  );
  process.exit(1);
}

console.log(
  'NEXUS backend verified: Scanner Windows and Multi-Window Metrics v0.1 are present.',
);
