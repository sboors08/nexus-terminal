import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/MarketPage.tsx',
  'src/pages/MarketPage.module.css',
  'src/shared/realtime/marketRealtime.ts',
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'test/market-realtime.test.mjs',
  'test/realtime-client.test.mjs',
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
  realtimeClientTestSource,
  indexSource,
  tsconfigSource,
  packageSource,
] = await Promise.all([
  readFile(resolve(root, 'src/pages/MarketPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/MarketPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/marketRealtime.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/realtimeClient.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useRealtimeMarketData.ts'), 'utf8'),
  readFile(resolve(root, 'test/realtime-client.test.mjs'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/index.ts'), 'utf8'),
  readFile(resolve(root, 'tsconfig.realtime-test.json'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'useRealtimeMarketData({',
  'buildMarketRealtimeView',
  'realtimeMarket.priceLabel',
  'realtimeMarket.bidLabel',
  'realtimeMarket.askLabel',
  'realtimeMarket.spreadLabel',
  'realtime.reconnect',
  '.realtimeStrip',
  '.liveDotConnected',
  '.liveDotPending',
  '.liveDotError',
  "export * from './marketRealtime'",
  'src/shared/realtime/marketRealtime.ts',
  'test/market-realtime.test.mjs',
  '"verify:market-realtime"',
  'symbols?: readonly string[]',
  '?symbols=',
  'symbolsKey',
  'symbols: realtimeSymbols',
  'realtimeLiveCount',
  'builds and receives multiple realtime symbols through one SSE connection',
];

const corpus = [
  pageSource,
  cssSource,
  helperSource,
  clientSource,
  hookSource,
  realtimeClientTestSource,
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
      `Missing Market realtime files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Market realtime markers: ${missingMarkers.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Market List Realtime Integration v0.1 is present.',
);
