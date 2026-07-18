import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  '.env.example',
  'src/app.ts',
  'src/server.ts',
  'src/config/env.ts',
  'src/modules/index.ts',
  'src/modules/health/health.routes.ts',
  'src/modules/realtime-market-data/realtime-market-data.types.ts',
  'src/modules/realtime-market-data/binance-websocket.service.ts',
  'src/modules/realtime-market-data/realtime-market-data.routes.ts',
  'test/health.test.ts',
  'test/binance-websocket.test.ts',
  'test/realtime-delivery.test.ts',
];

await Promise.all(requiredFiles.map((path) => access(resolve(root, path))));

const [packageSource, appSource, serverSource, webSocketSource, realtimeRoutesSource] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8'),
  readFile(resolve(root, 'src/app.ts'), 'utf8'),
  readFile(resolve(root, 'src/server.ts'), 'utf8'),
  readFile(resolve(root, 'src/modules/realtime-market-data/binance-websocket.service.ts'), 'utf8'),
  readFile(resolve(root, 'src/modules/realtime-market-data/realtime-market-data.routes.ts'), 'utf8'),
]);

const packageJson = JSON.parse(packageSource);
const errors = [];

if (packageJson.name !== 'nexus-terminal-backend') {
  errors.push('Unexpected backend package name');
}

for (const script of ['dev', 'build', 'typecheck', 'test', 'check']) {
  if (!packageJson.scripts?.[script]) errors.push(`Missing npm script: ${script}`);
}

if (!appSource.includes("prefix: env.apiPrefix")) {
  errors.push('API modules are not mounted under the configured prefix');
}

if (!appSource.includes("app.addHook('onClose'")) {
  errors.push('Realtime market data is not attached to graceful shutdown');
}

if (!serverSource.includes("process.once('SIGTERM'")) {
  errors.push('Graceful shutdown handler is missing');
}

for (const stream of ['@trade', '@bookTicker']) {
  if (!webSocketSource.includes(stream)) errors.push(`Missing Binance WebSocket stream: ${stream}`);
}

if (!realtimeRoutesSource.includes('/market/realtime/stream')) {
  errors.push('Realtime SSE delivery route is missing');
}

if (!realtimeRoutesSource.includes('text/event-stream')) {
  errors.push('Realtime delivery route does not use SSE');
}

const sourceText = `${appSource}\n${serverSource}\n${webSocketSource}\n${realtimeRoutesSource}`;
if (sourceText.includes('../frontend') || sourceText.includes('../../frontend')) {
  errors.push('Backend must not import frontend implementation files');
}

if (errors.length > 0) {
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('NEXUS backend verified: foundation, Binance realtime ingestion and SSE Realtime Delivery v0.1 are present.');
