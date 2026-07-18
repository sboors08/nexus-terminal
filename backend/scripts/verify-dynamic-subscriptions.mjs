import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/modules/realtime-market-data/realtime-market-data.types.ts',
  'src/modules/realtime-market-data/binance-websocket.service.ts',
  'src/modules/realtime-market-data/realtime-market-data.routes.ts',
  'test/dynamic-subscriptions.test.ts',
];

const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const [typesSource, serviceSource, routesSource, testSource, packageSource] = await Promise.all([
  readFile(resolve(root, requiredFiles[0]), 'utf8'),
  readFile(resolve(root, requiredFiles[1]), 'utf8'),
  readFile(resolve(root, requiredFiles[2]), 'utf8'),
  readFile(resolve(root, requiredFiles[3]), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'acquireSymbol(symbol: string)',
  'dynamicSymbolReferences',
  'restartForSubscriptionChange',
  'NEXUS subscriptions changed',
  'realtimeMarketDataService.acquireSymbol(symbol)',
  'releaseSymbol?.()',
  'INJUSDT',
  '"verify:dynamic-subscriptions"',
  'test/dynamic-subscriptions.test.ts',
];

const corpus = [
  typesSource,
  serviceSource,
  routesSource,
  testSource,
  packageSource,
].join('\n');

const missingMarkers = requiredMarkers.filter((marker) => !corpus.includes(marker));

if (missingFiles.length > 0 || missingMarkers.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Missing dynamic subscription files: ${missingFiles.join(', ')}`);
  }
  if (missingMarkers.length > 0) {
    console.error(`Missing dynamic subscription markers: ${missingMarkers.join(', ')}`);
  }
  process.exit(1);
}

console.log('NEXUS backend verified: Dynamic Market Subscriptions v0.1 are present.');
