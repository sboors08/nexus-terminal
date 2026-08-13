import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  validateLevelEngineRealData,
} from '../level-engine/level-engine-real-data-validation.js';
import {
  buildUnifiedDecisionRealDataValidationReport,
} from './unified-decision-real-data-validation.js';

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed)
    || parsed <= 0
    || parsed > maximum
  ) {
    throw new Error(
      `${field} must be a positive integer not greater than ${maximum}`,
    );
  }

  return parsed;
}

function readNonNegativeInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed)
    || parsed < 0
    || parsed > maximum
  ) {
    throw new Error(
      `${field} must be a non-negative integer not greater than ${maximum}`,
    );
  }

  return parsed;
}

function readSymbols(
  value: string | undefined,
): readonly string[] {
  const symbols = (
    value
    ?? 'BTCUSDT,ETHUSDT,SOLUSDT,AVAXUSDT,DOGEUSDT'
  )
    .split(',')
    .map(
      (symbol) =>
        symbol.trim().toUpperCase(),
    )
    .filter(Boolean);

  if (symbols.length === 0) {
    throw new Error(
      'UNIFIED_DECISION_VALIDATION_SYMBOLS must contain at least one symbol',
    );
  }

  return Object.freeze([
    ...new Set(symbols),
  ]);
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const symbols = readSymbols(
    process.env.UNIFIED_DECISION_VALIDATION_SYMBOLS,
  );
  const candlesPerSymbol = readPositiveInteger(
    process.env.UNIFIED_DECISION_VALIDATION_CANDLES,
    1_000,
    'UNIFIED_DECISION_VALIDATION_CANDLES',
    1_500,
  );

  console.log(
    'Fetching real Binance USD-M 1m candles for Unified Decision validation...',
  );

  const sourceReport =
    await validateLevelEngineRealData({
      binanceBaseUrl:
        process.env.BINANCE_BASE_URL
        ?? 'https://fapi.binance.com',
      requestTimeoutMs: readPositiveInteger(
        process.env.BINANCE_REQUEST_TIMEOUT_MS,
        15_000,
        'BINANCE_REQUEST_TIMEOUT_MS',
        60_000,
      ),
      requestDelayMs: readNonNegativeInteger(
        process.env.UNIFIED_DECISION_VALIDATION_REQUEST_DELAY_MS,
        250,
        'UNIFIED_DECISION_VALIDATION_REQUEST_DELAY_MS',
        60_000,
      ),
      symbols,
      timeframes: Object.freeze([
        '1m' as const,
      ]),
      candlesPerTimeframe:
        candlesPerSymbol,
      reviewLimitPerSymbol: 1,
    });
  const report =
    buildUnifiedDecisionRealDataValidationReport(
      sourceReport,
      {
        startAtClosedCandleCount:
          readPositiveInteger(
            process.env.UNIFIED_DECISION_VALIDATION_START_CANDLES,
            19,
            'UNIFIED_DECISION_VALIDATION_START_CANDLES',
            candlesPerSymbol,
          ),
      },
      {
        onReplayProgress: (progress) => {
          if (
            progress.completedStepCount === 1
            || progress.completedStepCount % 100 === 0
            || progress.completedStepCount === progress.totalStepCount
          ) {
            console.log(
              `Replaying ${progress.symbol}: ${progress.completedStepCount}/${progress.totalStepCount} causal prefixes`,
            );
          }
        },
      },
    );
  const outputDirectory = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_VALIDATION_OUTPUT_DIR
    ?? '.tmp/unified-decision-real-data-validation',
  );

  await mkdir(
    outputDirectory,
    { recursive: true },
  );

  const serialized =
    `${JSON.stringify(report, null, 2)}\n`;
  const timestampedPath = resolve(
    outputDirectory,
    `report-${safeTimestamp(report.generatedAt)}.json`,
  );
  const latestPath = resolve(
    outputDirectory,
    'latest.json',
  );

  await Promise.all([
    writeFile(
      timestampedPath,
      serialized,
      'utf8',
    ),
    writeFile(
      latestPath,
      serialized,
      'utf8',
    ),
  ]);

  console.log(
    `Unified Decision real-data validation: ${report.generatedAt}`,
  );
  console.table(
    report.symbolReports.map(
      ({ symbol, dataset }) => ({
        symbol,
        candles:
          dataset.closedCandlesCount,
        replaySteps:
          dataset.totals.replayStepCount,
        observe:
          dataset.totals.stateCounts.observe,
        wait:
          dataset.totals.stateCounts.wait_confirmation,
        skip:
          dataset.totals.stateCounts.skip,
        possibleLong:
          dataset.totals.stateCounts.possible_long,
        possibleShort:
          dataset.totals.stateCounts.possible_short,
        confirmed:
          dataset.totals.stateCounts.setup_confirmed,
        transitions:
          dataset.totals.transitionCount,
        violations:
          dataset.totals.violationCount,
      }),
    ),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.replayStepCount} causal replay steps, `
    + `${report.totals.transitionCount} state/line transitions, `
    + `${report.totals.violationCount} violations`,
  );
  console.log(
    'Historical realtime tape/order book, Setup lifecycle and market contexts: unavailable; no synthetic evidence was created.',
  );
  console.log(
    'Live observation dataset still required for possible long/short, scenario symmetry, stale downgrade and Setup outcome validation: '
    + `${report.empiricalCoverage.requiresLiveObservationDataset}`,
  );
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
