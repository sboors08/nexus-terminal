import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildUnifiedDecisionRealDataValidationReport,
  replayUnifiedDecisionRealDataDataset,
  UnifiedDecisionRealDataValidationError,
} from '../src/modules/decision-engine/unified-decision-real-data-validation.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../src/modules/level-engine/level-engine-real-data-validation.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';

const START_TIME_MS =
  Date.parse(
    '2026-08-13T12:00:00.000Z',
  );

const LEVEL_OPTIONS:
LevelLinesDetectionOptions = {
  atrPeriod: 2,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  originDepartureAtr: 0.6,
  originDepartureMaxCandles: 4,
  candidateVisibilityMinDepartureAtr: 2,
  candidateVisibilityMaxAgeBars: 5,
  persistentCandidateMinDepartureAtr: 1.5,
  persistentCandidateLookbackBars: 6,
  originEpisodeMaxSpanCandles: 3,
  workedEpisodeMaxSpanCandles: 8,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.5,
  consecutiveBreakCloses: 2,
};

function candle(
  index: number,
  values: {
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly isClosed?: boolean;
  },
): LevelEngineCandle {
  const openTimeMs =
    START_TIME_MS
    + index * 60_000;

  return Object.freeze({
    openTime:
      new Date(openTimeMs)
        .toISOString(),
    closeTime:
      new Date(openTimeMs + 59_999)
        .toISOString(),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    isClosed:
      values.isClosed
      ?? true,
  });
}

function resistanceHistory():
readonly LevelEngineCandle[] {
  return Object.freeze([
    candle(0, {
      open: 95,
      high: 96,
      low: 94,
      close: 95,
    }),
    candle(1, {
      open: 96,
      high: 100,
      low: 95,
      close: 99,
    }),
    candle(2, {
      open: 96.8,
      high: 97,
      low: 96,
      close: 96.5,
    }),
    candle(3, {
      open: 96,
      high: 97,
      low: 95,
      close: 96,
    }),
    candle(4, {
      open: 97,
      high: 99.9,
      low: 96,
      close: 99,
    }),
    candle(5, {
      open: 98,
      high: 98,
      low: 95,
      close: 96,
    }),
    candle(6, {
      open: 96,
      high: 97,
      low: 94,
      close: 95,
    }),
    candle(7, {
      open: 99.2,
      high: 99.8,
      low: 99.1,
      close: 99.7,
    }),
  ]);
}

function dataset(
  sourceTimeframe:
    LevelEngineTimeframe = '1m',
  candles:
    readonly LevelEngineCandle[] =
      resistanceHistory(),
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol: 'SOLUSDT',
    sourceTimeframe,
    candles: Object.freeze([...candles]),
  });
}

function sourceReport(
  datasets:
    readonly LevelEngineValidationDatasetSnapshot[],
): LevelEngineRealDataValidationReport {
  const requestedTimeframes =
    Object.freeze([
      ...new Set(
        datasets.map(
          (value) => value.sourceTimeframe,
        ),
      ),
    ]);

  return Object.freeze({
    version:
      'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion:
      'level-engine-review-diagnostics-v0.1',
    generatedAt:
      '2026-08-13T13:00:00.000Z',
    binanceBaseUrl:
      'https://fapi.binance.com',
    requestedSymbols:
      Object.freeze(['SOLUSDT']),
    requestedTimeframes,
    candlesPerTimeframe: 8,
    reviewLimitPerSymbol: 1,
    reviewPolicy: Object.freeze({
      atrPeriod: 14,
      decisiveBreakAtr: 0.35,
      consecutiveBreakCloses: 2,
      staleAfterBars: 120,
      staleDistanceAtr: 3,
      minimumFutureBars: 2,
    }),
    symbolReports: Object.freeze([
      Object.freeze({
        symbol: 'SOLUSDT',
        datasets: Object.freeze([...datasets]),
        detection: Object.freeze({
          symbol: 'SOLUSDT',
          requestedTimeframes,
          timeframes: Object.freeze([]),
          candidates: Object.freeze([]),
          observationalOnly: true,
          createsSetup: false,
          mergesAcrossTimeframes: false,
        }),
        timeframeSummaries:
          Object.freeze([]),
        reviewQueue: Object.freeze([]),
      }),
    ]),
    totals: Object.freeze({
      symbolCount: 1,
      timeframeDatasetCount:
        datasets.length,
      candleCount:
        datasets.reduce(
          (total, value) =>
            total + value.candles.length,
          0,
        ),
      candidateCount: 0,
      confirmedCount: 0,
      reviewItemCount: 0,
      reviewStateCounts: Object.freeze({
        active: 0,
        broken: 0,
        stale: 0,
        pending: 0,
      }),
    }),
    observationalOnly: true,
    createsSetup: false,
    mergesAcrossTimeframes: false,
    usesQualityScore: false,
  });
}

test(
  'replays closed 1m prefixes through the production Unified Decision contract without fabricating missing sources',
  () => {
    const progress: number[] = [];
    const report =
      replayUnifiedDecisionRealDataDataset(
        dataset(),
        {
          startAtClosedCandleCount: 4,
          levelLinesOptions:
            LEVEL_OPTIONS,
        },
        {
          onReplayProgress: (value) => {
            assert.equal(
              Object.isFrozen(value),
              true,
            );
            progress.push(
              value.completedStepCount,
            );
          },
        },
      );

    assert.equal(
      report.totals.replayStepCount,
      5,
    );
    assert.deepEqual(
      progress,
      [1, 2, 3, 4, 5],
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );
    assert.equal(
      report.totals.deterministicMismatchCount,
      0,
    );
    assert.equal(
      report.totals.futureLeakageCount,
      0,
    );
    assert.equal(
      report.totals.directionCounts.none,
      5,
    );
    assert.equal(
      report.totals.scenarioCounts.none,
      5,
    );
    assert.equal(
      report.totals.stateCounts.possible_long,
      0,
    );
    assert.equal(
      report.totals.stateCounts.possible_short,
      0,
    );
    assert.equal(
      report.totals.stateCounts.setup_confirmed,
      0,
    );
    assert.ok(
      report.transitions.length > 0,
    );

    for (const observation of report.observations) {
      assert.equal(
        observation.sources.candleCloseAt,
        observation.observedAt,
      );
      assert.deepEqual(
        observation.sources.realtimeTape,
        {
          availability: 'unavailable',
          observedAt: null,
        },
      );
      assert.deepEqual(
        observation.sources.orderBook,
        observation.sources.realtimeTape,
      );
      assert.deepEqual(
        observation.sources.setupLifecycle,
        observation.sources.realtimeTape,
      );
      assert.deepEqual(
        observation.sources.btcMarketMode,
        observation.sources.realtimeTape,
      );
      assert.deepEqual(
        observation.sources.symbolImpulse,
        observation.sources.realtimeTape,
      );
    }

    assert.equal(
      report.historicalRealtimeEvidenceAvailable,
      false,
    );
    assert.equal(
      report.validatesOfflineFallback,
      true,
    );
    assert.equal(
      report.validatesPossibleDirectionScenarios,
      false,
    );
    assert.equal(
      report.validatesSetupOutcomes,
      false,
    );
    assert.equal(
      report.empiricalCoverage
        .requiresLiveObservationDataset,
      true,
    );
    assert.equal(
      report.empiricalCoverage
        .scenarioSymmetryValidatedFromRealObservations,
      false,
    );
    assert.deepEqual(
      report.scenarioSymmetry.map(
        (row) => row.realObservationCount,
      ),
      [0, 0, 0, 0],
    );
  },
);

test(
  'ignores a trailing open candle without allowing it to affect causal observations',
  () => {
    const baseline =
      replayUnifiedDecisionRealDataDataset(
        dataset(),
        {
          startAtClosedCandleCount: 4,
          levelLinesOptions:
            LEVEL_OPTIONS,
        },
      );
    const withOpen =
      replayUnifiedDecisionRealDataDataset(
        dataset(
          '1m',
          Object.freeze([
            ...resistanceHistory(),
            candle(8, {
              open: 99.7,
              high: 120,
              low: 80,
              close: 110,
              isClosed: false,
            }),
          ]),
        ),
        {
          startAtClosedCandleCount: 4,
          levelLinesOptions:
            LEVEL_OPTIONS,
        },
      );

    assert.equal(
      withOpen.ignoredOpenCandlesCount,
      1,
    );
    assert.deepEqual(
      withOpen.observations,
      baseline.observations,
    );
    assert.deepEqual(
      withOpen.transitions,
      baseline.transitions,
    );
    assert.deepEqual(
      withOpen.totals,
      baseline.totals,
    );
  },
);

test(
  'builds a deterministic versioned report from only production 1m source datasets',
  () => {
    const source = sourceReport([
      dataset('1m'),
      dataset('5m'),
    ]);
    const options = {
      startAtClosedCandleCount: 4,
      levelLinesOptions:
        LEVEL_OPTIONS,
    } as const;
    const first =
      buildUnifiedDecisionRealDataValidationReport(
        source,
        options,
      );
    const second =
      buildUnifiedDecisionRealDataValidationReport(
        source,
        options,
      );

    assert.deepEqual(first, second);
    assert.equal(
      first.version,
      'unified-decision-real-data-validation-v0.1',
    );
    assert.equal(
      first.sourceDatasets.length,
      1,
    );
    assert.equal(
      first.totals.datasetCount,
      1,
    );
    assert.equal(
      first.totals.replayStepCount,
      5,
    );
    assert.equal(
      first.totals.violationCount,
      0,
    );
    assert.equal(
      first.offlineOnly,
      true,
    );
    assert.equal(
      first.reusesFetchedDatasets,
      true,
    );
    assert.equal(
      first.changesTradingRules,
      false,
    );
    assert.equal(
      first.createsTradeOrder,
      false,
    );
    assert.equal(
      first.createsSignal,
      false,
    );
    assert.equal(
      first.createsScore,
      false,
    );
    assert.equal(
      first.estimatesProfitability,
      false,
    );
    assert.equal(
      first.appliesTraining,
      false,
    );
    assert.equal(
      Object.isFrozen(first),
      true,
    );
    assert.equal(
      Object.isFrozen(first.symbolReports),
      true,
    );
  },
);

test(
  'rejects non-causal candle ordering and source reports without a 1m dataset',
  () => {
    const open = candle(7, {
      open: 99,
      high: 100,
      low: 98,
      close: 99,
      isClosed: false,
    });
    const laterClosed = candle(8, {
      open: 99,
      high: 100,
      low: 98,
      close: 99,
    });

    assert.throws(
      () =>
        replayUnifiedDecisionRealDataDataset(
          dataset(
            '1m',
            Object.freeze([
              ...resistanceHistory().slice(0, 7),
              open,
              laterClosed,
            ]),
          ),
          {
            startAtClosedCandleCount: 4,
            levelLinesOptions:
              LEVEL_OPTIONS,
          },
        ),
      UnifiedDecisionRealDataValidationError,
    );

    assert.throws(
      () =>
        buildUnifiedDecisionRealDataValidationReport(
          sourceReport([dataset('5m')]),
          {
            startAtClosedCandleCount: 4,
            levelLinesOptions:
              LEVEL_OPTIONS,
          },
        ),
      UnifiedDecisionRealDataValidationError,
    );
  },
);
