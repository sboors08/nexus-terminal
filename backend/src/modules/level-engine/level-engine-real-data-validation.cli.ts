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
  buildLevelEngineLifecycleRealDataValidationReport,
} from './level-engine-lifecycle-real-data-validation.js';
import {
  buildLevelEngineCausalReplayRealDataValidationReport,
} from './level-engine-causal-replay-real-data-validation.js';
import {
  buildLevelEngineFrozenSample,
} from './level-engine-frozen-sample.js';
import {
  buildLevelEngineLifecycleRealDataReviewHtml,
} from './level-engine-lifecycle-real-data-review-html.js';

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
  const sourceReport = await validateLevelEngineRealData({
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
  const lifecycleReport =
    buildLevelEngineLifecycleRealDataValidationReport(
      sourceReport,
    );
  console.log(
    'Running Level Engine causal replay on fetched datasets...',
  );
  let causalReplayDatasetStartedAt = Date.now();
  const report =
    buildLevelEngineCausalReplayRealDataValidationReport(
      lifecycleReport,
      {
        onDatasetStart: (dataset, datasetIndex, datasetCount) => {
          causalReplayDatasetStartedAt = Date.now();
          console.log(
            `[${datasetIndex}/${datasetCount}] Replay `
            + `${dataset.symbol} ${dataset.sourceTimeframe}...`,
          );
        },
        onDatasetComplete: (
          dataset,
          replay,
          datasetIndex,
          datasetCount,
        ) => {
          console.log(
            `[${datasetIndex}/${datasetCount}] Completed `
            + `${dataset.symbol} ${dataset.sourceTimeframe}: `
            + `${replay.totals.candidateTrackCount} tracks, `
            + `${Date.now() - causalReplayDatasetStartedAt} ms`,
          );
        },
      },
    );
  const frozenSample = buildLevelEngineFrozenSample(
    report,
    {
      limit: readPositiveInteger(
        process.env.LEVEL_ENGINE_FROZEN_SAMPLE_LIMIT,
        120,
        'LEVEL_ENGINE_FROZEN_SAMPLE_LIMIT',
        5_000,
      ),
    },
  );

  const outputDirectory = resolve(
    process.cwd(),
    process.env.LEVEL_ENGINE_VALIDATION_OUTPUT_DIR
      ?? '.tmp/level-engine-validation',
  );
  await mkdir(outputDirectory, { recursive: true });

  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const frozenSampleSerialized =
    `${JSON.stringify(frozenSample, null, 2)}\n`;
  const reviewHtml = buildLevelEngineLifecycleRealDataReviewHtml(lifecycleReport);
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
  const timestampedFrozenSamplePath = resolve(
    outputDirectory,
    `frozen-sample-${timestamp}.json`,
  );
  const latestFrozenSamplePath = resolve(
    outputDirectory,
    'latest-frozen-sample.json',
  );

  await Promise.all([
    writeFile(timestampedPath, serialized, 'utf8'),
    writeFile(latestPath, serialized, 'utf8'),
    writeFile(timestampedReviewPath, reviewHtml, 'utf8'),
    writeFile(latestReviewPath, reviewHtml, 'utf8'),
    writeFile(
      timestampedFrozenSamplePath,
      frozenSampleSerialized,
      'utf8',
    ),
    writeFile(
      latestFrozenSamplePath,
      frozenSampleSerialized,
      'utf8',
    ),
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
  const causalRows = report.timeframeCausalReplaySummaries.map(
    (summary) => ({
      timeframe: summary.sourceTimeframe,
      datasets: summary.datasetCount,
      replaySteps: summary.replayStepCount,
      tracks: summary.candidateTrackCount,
      confirmedTracks: summary.confirmedCandidateTrackCount,
      cycles: summary.cycleTrackCount,
      flips: summary.flipCycleTrackCount,
      reclaims: summary.reclaimCycleTrackCount,
      disappearances: summary.candidateDisappearanceCount,
      reappearances: summary.candidateReappearanceCount,
      selectedConfirmedPreBreak:
        summary.selectedCycleConfirmationStateCounts
          .confirmed_before_break,
      selectedConfirmedUnbroken:
        summary.selectedCycleConfirmationStateCounts
          .confirmed_unbroken,
      selectedBrokeUnconfirmed:
        summary.selectedCycleConfirmationStateCounts
          .not_confirmed_broken,
      selectedStillCandidate:
        summary.selectedCycleConfirmationStateCounts
          .not_confirmed_unbroken,
      selectedMissing:
        summary.selectedCycleConfirmationStateCounts
          .cycle_not_observed,
      seenMedianBars: summary.candidateFirstSeenLagBars.medianBars,
      activeMedianBars:
        summary.candidateFirstSeenFromActiveFromLagBars.medianBars,
    }),
  );

  console.log(
    `Level Engine real-data validation: ${report.generatedAt}`,
  );
  console.table(rows);
  console.log('Causal replay by timeframe:');
  console.table(causalRows);
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
  console.log(
    'Lifecycle: '
    + `${report.totals.lifecycleCycleCount} cycles, `
    + `${report.totals.lifecycleBreakCount} breaks, `
    + `${report.totals.lifecycleFlipCount} flips, `
    + `${report.totals.lifecycleReclaimCount} reclaims`,
  );
  console.log(
    'Selected transitions: '
    + `${report.totals.transitionCounts.origin} origin, `
    + `${report.totals.transitionCounts.flip} flip, `
    + `${report.totals.transitionCounts.reclaim} reclaim`,
  );
  console.log(
    'Touch history: '
    + `${report.totals.sourceTouchEpisodeCount} source, `
    + `${report.totals.selectedCycleTouchEpisodeCount} selected-cycle, `
    + `${report.totals.discardedSourceTouchEpisodeCount} discarded`,
  );
  console.log(
    'Source snapshot detectedAt vs first reconstructed break: '
    + `${report.totals.preBreakDetectionCount} before break, `
    + `${report.totals.lateOrPostBreakDetectionCount} late/post-break, `
    + `${report.totals.noBreakObservedCount} without observed break`,
  );
  console.log(
    'Causal replay: '
    + `${report.totals.replayDatasetCount} datasets, `
    + `${report.totals.replayStepCount} steps, `
    + `${report.totals.causalCandidateTrackCount} candidate tracks, `
    + `${report.totals.causalCycleTrackCount} cycle tracks`,
  );
  console.log(
    'Source candidate first-seen vs first reconstructed break: '
    + `${report.totals.reviewFirstSeenBeforeBreakCount} before break, `
    + `${report.totals.reviewFirstSeenAtOrAfterBreakCount} at/after break, `
    + `${report.totals.reviewFirstSeenNoBreakCount} without break, `
    + `${report.totals.reviewFirstSeenNotObservedCount} not observed`,
  );
  console.log(
    'Source candidate first-confirmed vs first reconstructed break: '
    + `${report.totals.reviewFirstConfirmedBeforeBreakCount} before break, `
    + `${report.totals.reviewFirstConfirmedAtOrAfterBreakCount} at/after break, `
    + `${report.totals.reviewFirstConfirmedNoBreakCount} without break, `
    + `${report.totals.reviewFirstConfirmedNotObservedCount} not observed`,
  );
  const selectedObserved =
    report.totals.selectedCycleFirstObservedTimingCounts;
  const selectedConfirmed =
    report.totals.selectedCycleConfirmationStateCounts;
  console.log(
    'Selected-cycle first observation vs its own break: '
    + `${selectedObserved.before_break} before break, `
    + `${selectedObserved.at_break + selectedObserved.after_break} at/after break, `
    + `${selectedObserved.no_break} unbroken, `
    + `${selectedObserved.not_observed} not observed`,
  );
  console.log(
    'Selected-cycle confirmation vs its own break: '
    + `${selectedConfirmed.confirmed_before_break} confirmed before break, `
    + `${selectedConfirmed.confirmed_at_break + selectedConfirmed.confirmed_after_break} confirmed at/after break, `
    + `${selectedConfirmed.confirmed_unbroken} confirmed and unbroken, `
    + `${selectedConfirmed.not_confirmed_broken} broke before confirmation, `
    + `${selectedConfirmed.not_confirmed_unbroken} still candidate/unbroken, `
    + `${selectedConfirmed.cycle_not_observed} cycle not observed`,
  );
  console.log(
    'Candidate lag bars (median/max): '
    + `seen ${report.totals.candidateFirstSeenLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.candidateFirstSeenLagBars.maximumBars ?? 'вЂ”'}, `
    + `from activeFrom `
    + `${report.totals.candidateFirstSeenFromActiveFromLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.candidateFirstSeenFromActiveFromLagBars.maximumBars ?? 'вЂ”'}, `
    + `confirmed ${report.totals.candidateConfirmedLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.candidateConfirmedLagBars.maximumBars ?? 'вЂ”'}`,
  );
  console.log(
    'Transition lag bars (median/max): '
    + `origin ${report.totals.originStartLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.originStartLagBars.maximumBars ?? 'вЂ”'}, `
    + `flip ${report.totals.flipStartLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.flipStartLagBars.maximumBars ?? 'вЂ”'}, `
    + `reclaim ${report.totals.reclaimStartLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.reclaimStartLagBars.maximumBars ?? 'вЂ”'}, `
    + `break ${report.totals.breakObservationLagBars.medianBars ?? 'вЂ”'}/`
    + `${report.totals.breakObservationLagBars.maximumBars ?? 'вЂ”'}`,
  );
  console.log(
    'Detector stability: '
    + `${report.totals.causalCandidateDisappearanceCount} disappearances, `
    + `${report.totals.causalCandidateReappearanceCount} reappearances`,
  );
  console.log(`Full report: ${timestampedPath}`);
  console.log(`Latest report: ${latestPath}`);
  console.log(`Level Review HTML: ${timestampedReviewPath}`);
  console.log(`Latest Level Review: ${latestReviewPath}`);
  console.log(
    'Frozen sample: '
    + `${frozenSample.selection.selectedItemCount}/`
    + `${frozenSample.selection.availableItemCount} items, `
    + `${frozenSample.selection.datasetCount} datasets`,
  );
  console.log(`Frozen sample JSON: ${timestampedFrozenSamplePath}`);
  console.log(`Latest frozen sample: ${latestFrozenSamplePath}`);
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
