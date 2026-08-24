import {
  access,
  readFile,
} from 'node:fs/promises';
import { resolve } from 'node:path';

const root =
  process.cwd();

const requiredFiles = [
  'src/shared/realtime/realtimeClient.ts',
  'src/shared/realtime/dashboardScannerMetrics.ts',
  'src/shared/realtime/marketWideScannerMetrics.ts',
  'src/shared/realtime/useMarketWideScannerMetrics.ts',
  'src/shared/realtime/marketWideLiquidations.ts',
  'src/shared/realtime/useMarketWideLiquidations.ts',
  'src/shared/realtime/index.ts',
  'src/pages/ScannerPage.tsx',
];

const missingFiles = [];

for (
  const file
  of requiredFiles
) {
  try {
    await access(
      resolve(
        root,
        file,
      ),
    );
  } catch {
    missingFiles.push(
      file,
    );
  }
}

if (
  missingFiles.length > 0
) {
  console.error(
    'Missing Futures Metrics Terminal files: '
    + missingFiles.join(', '),
  );

  process.exit(1);
}

const sources =
  await Promise.all(
    requiredFiles.map(
      (file) =>
        readFile(
          resolve(
            root,
            file,
          ),
          'utf8',
        ),
    ),
  );

const corpus =
  sources.join('\n');

const requiredMarkers = [
  'RealtimeMarkPrice',
  'fundingRatePct',
  'markPrice?: RealtimeMarkPrice | null',
  'openInterest: number | null',
  'openInterestUpdatedAt: string | null',
  'symbol?: string',
  'MARKET_WIDE_LIQUIDATIONS_PATH',
  'parseMarketWideLiquidation',
  'useMarketWideLiquidations',
  "export * from './marketWideLiquidations'",
  "export * from './useMarketWideLiquidations'",
  'Futures метрики',
  'Mark Price',
  'Funding',
  'Open Interest',
  'Последняя ликвидация:',
  '.side.toUpperCase()} order',
];

const missingMarkers =
  requiredMarkers.filter(
    (marker) =>
      !corpus.includes(
        marker,
      ),
  );

const forbiddenMarkers = [
  'liquidationScore',
  'liquidationSignal',
  'liquidationLong',
  'liquidationShort',
  'profitabilityLabel',
  'trainingApplied',
  'openPosition',
  'closePosition',
];

const forbiddenFound =
  forbiddenMarkers.filter(
    (marker) =>
      corpus.includes(
        marker,
      ),
  );

if (
  missingMarkers.length > 0
  || forbiddenFound.length > 0
) {
  if (
    missingMarkers.length > 0
  ) {
    console.error(
      'Missing Futures Metrics markers: '
      + missingMarkers.join(', '),
    );
  }

  if (
    forbiddenFound.length > 0
  ) {
    console.error(
      'Forbidden trading interpretation markers: '
      + forbiddenFound.join(', '),
    );
  }

  process.exit(1);
}

console.log(
  'NEXUS frontend verified: factual Futures Metrics Terminal Exposure v0.1 is present without liquidation scoring or trading interpretation.',
);
