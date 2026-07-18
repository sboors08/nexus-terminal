import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'src/shared/realtime/index.ts',
  'test/realtime-client.test.mjs',
  'tsconfig.realtime-test.json',
];

const missingFiles = [];
for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    missingFiles.push(file);
  }
}

const [clientSource, hookSource, viteSource, packageSource] = await Promise.all([
  readFile(resolve(root, 'src/shared/realtime/realtimeClient.ts'), 'utf8'),
  readFile(resolve(root, 'src/shared/realtime/useRealtimeMarketData.ts'), 'utf8'),
  readFile(resolve(root, 'vite.config.ts'), 'utf8'),
  readFile(resolve(root, 'package.json'), 'utf8'),
]);

const requiredMarkers = [
  "'/api/v1/market/realtime/stream'",
  "source.addEventListener('status'",
  "source.addEventListener('snapshot'",
  "source.addEventListener('error'",
  'source?.close()',
  "'reconnecting'",
  'new RealtimeMarketDataClient',
  'client.subscribe(setState)',
  "'/api':",
  '"test:realtime"',
];
const corpus = [clientSource, hookSource, viteSource, packageSource].join('\n');
const missingMarkers = requiredMarkers.filter((marker) => !corpus.includes(marker));

if (missingFiles.length > 0 || missingMarkers.length > 0) {
  if (missingFiles.length > 0) {
    console.error(`Missing realtime client files: ${missingFiles.join(', ')}`);
  }
  if (missingMarkers.length > 0) {
    console.error(`Missing realtime client markers: ${missingMarkers.join(', ')}`);
  }
  process.exit(1);
}

console.log('NEXUS frontend verified: SSE Realtime Client v0.1 is present.');
