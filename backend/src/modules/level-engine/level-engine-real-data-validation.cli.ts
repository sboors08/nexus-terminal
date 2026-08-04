import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  isLevelEngineTimeframe,
} from './level-engine.contract.js';
import {
  LEVEL_ENGINE_TIMEFRAMES,
} from './level-engine.types.js';
import type {
  LevelEngineTimeframe,
} from './level-engine.types.js';
import {
  validateLevelEngineRealData,
} from './level-engine-real-data-validation.js';
import {
  buildLevelEngineRealDataReviewHtml,
} from './level-engine-real-data-review-html.js';

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
    !Number.isInteger(parsed)
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
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} must be a non-negative integer`);
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
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    throw new Error(
      'LEVEL_ENGINE_VALIDATION_SYMBOLS must contain at least one symbol',
    );
  }

  return Object.freeze([...new Set(symbols)]);
}

function readTimeframes(
  value: string | undefined,
): readonly LevelEngineTimeframe[] {
  if (!value) {
    return LEVEL_ENGINE_TIMEFRAMES;
  }

  const timeframes = value
    .split(',')
    .map((timeframe) => timeframe.trim())
    .filter(Boolean);

  if (
    timeframes.length === 0
    || timeframes.some(
      (timeframe) => !isLevelEngineTimeframe(timeframe),
    )
  ) {
    throw new Error(
      'LEVEL_ENGINE_VALIDATION_TIMEFRAMES must use 1m,5m,15m,1h,4h',
    );
  }

  return Object.freeze(
    [...new Set(timeframes)] as LevelEngineTimeframe[],
  );
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const report = await validateLevelEngineRealData({
    binanceBaseUrl:
      process.env.BINANCE_BASE_URL
      ?? 'https://fapi.binance.com',
    requestTimeoutMs: readPositiveInteger(
      process.env.BINANCE_REQUEST_TIMEOUT_MS,
      10_000,
      'BINANCE_REQUEST_TIMEOUT_MS',
      30_000,
    ),
    requestDelayMs: readNonNegativeInteger(
      process.env.LEVEL_ENGINE_VALIDATION_REQUEST_DELAY_MS,
      100,
      'LEVEL_ENGINE_VALIDATION_REQUEST_DELAY_MS',
    ),
    symbols: readSymbols(
      process.env.LEVEL_ENGINE_VALIDATION_SYMBOLS,
    ),
    timeframes: readTimeframes(
      process.env.LEVEL_ENGINE_VALIDATION_TIMEFRAMES,
    ),
    candlesPerTimeframe: readPositiveInteger(
      process.env.LEVEL_ENGINE_VALIDATION_CANDLES,
      1_000,
      'LEVEL_ENGINE_VALIDATION_CANDLES',
      1_500,
    ),
    reviewLimitPerSymbol: readPositiveInteger(
      process.env.LEVEL_ENGINE_VALIDATION_REVIEW_LIMIT,
      20,
      'LEVEL_ENGINE_VALIDATION_REVIEW_LIMIT',
      500,
    ),
  });

  const outputDirectory = resolve(
    process.cwd(),
    process.env.LEVEL_ENGINE_VALIDATION_OUTPUT_DIR
      ?? '.tmp/level-engine-validation',
  );
  await mkdir(outputDirectory, { recursive: true });

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const reviewHtml = buildLevelEngineRealDataReviewHtml(report);
  const timestamp = safeTimestamp(report.generatedAt);
  const timestampedPath = resolve(
    outputDirectory,
    `report-${timestamp}.json`,
  );
  const latestPath = resolve(outputDirectory, 'latest.json');
  const timestampedReviewPath = resolve(
    outputDirectory,
    `level-review-${timestamp}.html`,
  );
  const latestReviewPath = resolve(
    outputDirectory,
    'latest-review.html',
  );

  await Promise.all([
    writeFile(timestampedPath, serialized, 'utf8'),
    writeFile(latestPath, serialized, 'utf8'),
    writeFile(timestampedReviewPath, reviewHtml, 'utf8'),
    writeFile(latestReviewPath, reviewHtml, 'utf8'),
  ]);

  const rows = report.symbolReports.flatMap((symbolReport) =>
    symbolReport.timeframeSummaries.map((summary) => ({
      symbol: symbolReport.symbol,
      timeframe: summary.sourceTimeframe,
      candles: summary.closedCandlesCount,
      pivots: summary.pivotSeedCount,
      candidates: summary.candidateCount,
      confirmed: summary.confirmedCount,
      oneTouch: summary.oneTouchCandidateCount,
      per100Candles: summary.candidatesPer100ClosedCandles,
      rejected: summary.rejectedClusterCount,
    })),
  );

  console.log(
    `Level Engine real-data validation: ${report.generatedAt}`,
  );
  console.table(rows);
  console.log(
    `Totals: ${report.totals.candidateCount} candidates, `
    + `${report.totals.confirmedCount} confirmed, `
    + `${report.totals.reviewItemCount} review items`,
  );
  console.log(
    'Review states: '
    + `${report.totals.reviewStateCounts.active} active, `
    + `${report.totals.reviewStateCounts.broken} broken, `
    + `${report.totals.reviewStateCounts.stale} stale, `
    + `${report.totals.reviewStateCounts.pending} pending`,
  );
  console.log(`Full report: ${timestampedPath}`);
  console.log(`Latest report: ${latestPath}`);
  console.log(`Level Review HTML: ${timestampedReviewPath}`);
  console.log(`Latest Level Review: ${latestReviewPath}`);
  console.log('Quality score used: no');
  console.log('Trading setups created: no');
}

main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.stack ?? error.message
    : String(error);
  console.error(message);
  process.exitCode = 1;
});
