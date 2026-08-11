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
  buildCausalSetupRealDataValidationReport,
} from './causal-setup-real-data-validation.js';

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  maximum: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed =
    Number(value);

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

  const parsed =
    Number(value);

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
  const symbols =
    (
      value
      ?? 'BTCUSDT,ETHUSDT,SOLUSDT,AVAXUSDT,DOGEUSDT'
    )
      .split(',')
      .map(
        (symbol) =>
          symbol
            .trim()
            .toUpperCase(),
      )
      .filter(Boolean);

  if (symbols.length === 0) {
    throw new Error(
      'CAUSAL_SETUP_VALIDATION_SYMBOLS must contain at least one symbol',
    );
  }

  return Object.freeze([
    ...new Set(symbols),
  ]);
}

function safeTimestamp(
  value: string,
): string {
  return value.replace(
    /[:.]/g,
    '-',
  );
}

async function main(): Promise<void> {
  const symbols =
    readSymbols(
      process.env
        .CAUSAL_SETUP_VALIDATION_SYMBOLS,
    );
  const candlesPerSymbol =
    readPositiveInteger(
      process.env
        .CAUSAL_SETUP_VALIDATION_CANDLES,
      1_000,
      'CAUSAL_SETUP_VALIDATION_CANDLES',
      1_500,
    );

  console.log(
    'Fetching real Binance USD-M 1m candles for causal Setup validation...',
  );

  const sourceReport =
    await validateLevelEngineRealData({
      binanceBaseUrl:
        process.env.BINANCE_BASE_URL
        ?? 'https://fapi.binance.com',
      requestTimeoutMs:
        readPositiveInteger(
          process.env
            .BINANCE_REQUEST_TIMEOUT_MS,
          15_000,
          'BINANCE_REQUEST_TIMEOUT_MS',
          60_000,
        ),
      requestDelayMs:
        readNonNegativeInteger(
          process.env
            .CAUSAL_SETUP_VALIDATION_REQUEST_DELAY_MS,
          250,
          'CAUSAL_SETUP_VALIDATION_REQUEST_DELAY_MS',
          60_000,
        ),
      symbols,
      timeframes:
        Object.freeze([
          '1m' as const,
        ]),
      candlesPerTimeframe:
        candlesPerSymbol,
      reviewLimitPerSymbol: 1,
    });
  const report =
    buildCausalSetupRealDataValidationReport(
      sourceReport,
      {
        startAtClosedCandleCount:
          readPositiveInteger(
            process.env
              .CAUSAL_SETUP_VALIDATION_START_CANDLES,
            19,
            'CAUSAL_SETUP_VALIDATION_START_CANDLES',
            candlesPerSymbol,
          ),
      },
      {
        onReplayProgress:
          (progress) => {
            if (
              progress.completedStepCount
                === 1
              || progress.completedStepCount
                % 100 === 0
              || progress.completedStepCount
                === progress.totalStepCount
            ) {
              console.log(
                `Replaying ${progress.symbol}: ${progress.completedStepCount}/${progress.totalStepCount} causal prefixes`,
              );
            }
          },
      },
    );
  const outputDirectory =
    resolve(
      process.cwd(),
      process.env
        .CAUSAL_SETUP_VALIDATION_OUTPUT_DIR
      ?? '.tmp/causal-setup-validation',
    );

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const serialized =
    `${JSON.stringify(report, null, 2)}\n`;
  const timestamp =
    safeTimestamp(
      report.generatedAt,
    );
  const timestampedPath =
    resolve(
      outputDirectory,
      `report-${timestamp}.json`,
    );
  const latestPath =
    resolve(
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
    `Causal Setup real-data validation: ${report.generatedAt}`,
  );
  console.table(
    report.symbolReports.map(
      ({
        symbol,
        dataset,
      }) => ({
        symbol,
        candles:
          dataset
            .closedCandlesCount,
        replaySteps:
          dataset.totals
            .replayStepCount,
        levels:
          dataset.totals
            .uniqueLevelCount,
        candidates:
          dataset.totals
            .candidateTrackCount,
        observation:
          dataset.totals
            .observationReachedCount,
        approach:
          dataset.totals
            .approachReachedCount,
        confirmation:
          dataset.totals
            .confirmationReachedCount,
        disappearances:
          dataset.totals
            .candidateDisappearanceCount,
        reappearances:
          dataset.totals
            .candidateReappearanceCount,
        violations:
          dataset.totals
            .violationCount,
      }),
    ),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.replayStepCount} causal replay steps, `
    + `${report.totals.uniqueLevelCount} unique levels, `
    + `${report.totals.candidateTrackCount} setup candidate tracks`,
  );
  console.log(
    'Candidate types: '
    + `${report.totals.breakoutCandidateCount} breakout, `
    + `${report.totals.bounceCandidateCount} bounce; `
    + `${report.totals.longCandidateCount} long, `
    + `${report.totals.shortCandidateCount} short`,
  );
  console.log(
    'Causal stages: '
    + `${report.totals.observationReachedCount} observation, `
    + `${report.totals.approachReachedCount} approach, `
    + `${report.totals.confirmationReachedCount} confirmation`,
  );
  console.log(
    'Latency bars (median/max): '
    + 'level-confirmed -> observation '
    + `${report.totals.levelConfirmedToObservationBars.medianBars ?? '—'}/`
    + `${report.totals.levelConfirmedToObservationBars.maximumBars ?? '—'}, `
    + 'observation -> approach '
    + `${report.totals.observationToApproachBars.medianBars ?? '—'}/`
    + `${report.totals.observationToApproachBars.maximumBars ?? '—'}`,
  );
  console.log(
    `Invariant violations: ${report.totals.violationCount}`,
  );
  console.log(
    'Historical realtime evidence: unavailable; '
    + 'confirmation and breakout/rejection outcome were not validated.',
  );
  console.log(
    'Synthetic realtime evidence used: no',
  );
  console.log(
    'Trading rules changed: no',
  );
  console.log(
    'Quality score or training used: no',
  );
  console.log(
    `Full report: ${timestampedPath}`,
  );
  console.log(
    `Latest report: ${latestPath}`,
  );

  if (report.totals.violationCount > 0) {
    throw new Error(
      'Causal Setup real-data validation found invariant violations',
    );
  }
}

main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.stack
          ?? error.message
        : String(error);

    console.error(message);
    process.exitCode = 1;
  },
);
