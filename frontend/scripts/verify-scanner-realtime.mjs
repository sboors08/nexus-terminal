import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/shared/realtime/scannerRealtime.ts',
  'test/scanner-realtime.test.mjs',
];

const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const [pageSource, cssSource, helperSource, indexSource, packageSource] = await Promise.all([
  readFile(resolve(root, 'src/pages/ScannerPage.tsx'), 'utf8'),
  readFile(resolve(root, 'src/pages/ScannerPage.module.css'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/scannerRealtime.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/index.ts'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  'useRealtimeMarketData({ symbol: selectedSetup.symbol })',
  'realtime.snapshots[selectedSetup.symbol]',
  'buildScannerRealtimeMarketView',
  'TEST SETUPS · LIVE MARKET',
  'Последние сделки',
  'formatScannerQuantity(trade.quantity)',
  '.realtimeStrip',
  '.tradesPanel',
  "export * from './scannerRealtime'",
  '"verify:scanner-realtime"',
  'test/scanner-realtime.test.mjs',
];

const corpus = [pageSource, cssSource, helperSource, indexSource, packageSource].join('\n');
const missingMarkers = requiredMarkers.filter((marker) => !corpus.includes(marker));

if (missingFiles.length > 0 || missingMarkers.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Missing Scanner realtime files: ${missingFiles.join(', ')}`);
  }
  if (missingMarkers.length > 0) {
    console.error(`Missing Scanner realtime markers: ${missingMarkers.join(', ')}`);
  }
  process.exit(1);
}

console.log('NEXUS frontend verified: Scanner Realtime Integration v0.1 is present.');
