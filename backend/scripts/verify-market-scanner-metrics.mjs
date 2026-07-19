import {
  access,
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/modules/realtime-market-data/market-scanner-metrics.ts',
  'src/modules/realtime-market-data/realtime-market-data.types.ts',
  'src/modules/realtime-market-data/binance-websocket.service.ts',
  'src/modules/realtime-market-data/realtime-market-data.routes.ts',
  'test/market-scanner-metrics.test.ts',
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
    `Missing market scanner metrics files: ${missingFiles.join(', ')}`,
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
  'export interface MarketScannerMetrics',
  'export class MarketScannerMetricsWindow',
  'windowMs',
  'quoteVolume',
  'tradesCount',
  'tradesPerMinute',
  'buyQuoteVolume',
  'sellQuoteVolume',
  'getScannerMetrics?(symbol?: string)',
  'private readonly scannerMetrics',
  'new MarketScannerMetricsWindow',
  '?.addTrade(trade)',
  '/market/realtime/scanner-metrics',
  'scanner_metrics_unavailable',
  'symbols_not_subscribed',
  'returns empty market scanner metrics before trades arrive',
  'aggregates price volume trades and direction for one minute',
  'removes trades older than the rolling window',
  'ignores duplicate trade ids',
  '"verify:market-scanner-metrics"',
  'test/market-scanner-metrics.test.ts',
];

const corpus = sources.join('\n');

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(marker),
  );

if (missingMarkers.length > 0) {
  console.error(
    `Missing market scanner metrics markers: ${missingMarkers.join(', ')}`,
  );
  process.exit(1);
}

console.log(
  'NEXUS backend verified: Market Scanner Metrics v0.1 are present.',
);
