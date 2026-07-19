import {
  access,
  readFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'src/pages/WorkspacePage.tsx',
  'src/pages/WorkspacePage.module.css',
  'src/shared/realtime/workspaceRealtime.ts',
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/useRealtimeMarketData.ts',
  'test/workspace-realtime.test.mjs',
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
  readFile(
    resolve(root, 'src/pages/WorkspacePage.tsx'),
    'utf8',
  ),
  readFile(
    resolve(root, 'src/pages/WorkspacePage.module.css'),
    'utf8',
  ),
  readFile(
    resolve(
      root,
      'src/shared/realtime/workspaceRealtime.ts',
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
    resolve(root, 'test/workspace-realtime.test.mjs'),
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

const requiredMarkers = [
  'buildWorkspaceRealtimeView',
  'useRealtimeMarketData({',
  'symbol: selectedSetup.symbol',
  'snapshot.candles',
  'realtime.status?.state ?? null',
  'realtimeWorkspace.priceLabel',
  'realtimeWorkspace.priceY',
  'realtimeWorkspace.axisLabels',
  "showCurrentPrice={realtimeWorkspace.rangePosition === 'inside'}",
  'styles.rangeWarning',
  '.liveIndicator_pending',
  '.liveIndicator_error',
  '.priceSourceLive',
  "export * from './workspaceRealtime'",
  'src/shared/realtime/workspaceRealtime.ts',
  'test/workspace-realtime.test.mjs',
  '"verify:workspace-realtime"',
  'builds the live Workspace price and chart position',
  'clamps a Workspace price outside the candle range',
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

if (
  missingFiles.length > 0
  || missingMarkers.length > 0
) {
  if (missingFiles.length > 0) {
    console.error(
      `Missing Workspace realtime files: ${missingFiles.join(', ')}`,
    );
  }

  if (missingMarkers.length > 0) {
    console.error(
      `Missing Workspace realtime markers: ${missingMarkers.join(', ')}`,
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: Workspace Realtime Integration v0.1 is present.',
);
