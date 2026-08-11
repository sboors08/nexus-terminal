import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineTimeframe,
} from '../src/modules/level-engine/level-engine.types.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../src/modules/level-engine/level-engine-real-data-validation.types.js';
import {
  buildCausalSetupRealDataValidationReport,
  CausalSetupRealDataValidationError,
  replayCausalSetupRealDataDataset,
} from '../src/modules/setup-engine/causal-setup-real-data-validation.js';
import type {
  SetupDetectionPipelineOptions,
} from '../src/modules/setup-engine/setup-detection-pipeline.types.js';

const START_TIME_MS =
  Date.parse(
    '2026-07-26T12:00:00.000Z',
  );

const PIPELINE_OPTIONS:
SetupDetectionPipelineOptions = {
  maxCandles: 100,
  levelLinesOptions: {
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
  },
  candidateOptions: {
    expiresAfterSec: 3_600,
  },
  setupTypes: [
    'level_breakout',
    'level_bounce',
  ],
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
      new Date(
        openTimeMs,
      ).toISOString(),
    closeTime:
      new Date(
        openTimeMs
        + 59_999,
      ).toISOString(),
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
    candles:
      Object.freeze([
        ...candles,
      ]),
  });
}

function sourceReport(
  datasets:
    readonly LevelEngineValidationDatasetSnapshot[],
): LevelEngineRealDataValidationReport {
  const requestedTimeframes =
    Object.freeze(
      [...new Set(
        datasets.map(
          (value) =>
            value.sourceTimeframe,
        ),
      )],
    );
  const candleCount =
    datasets.reduce(
      (
        total,
        value,
      ) => total
        + value.candles.length,
      0,
    );

  return Object.freeze({
    version:
      'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion:
      'level-engine-review-diagnostics-v0.1',
    generatedAt:
      '2026-07-26T13:00:00.000Z',
    binanceBaseUrl:
      'https://fapi.binance.com',
    requestedSymbols:
      Object.freeze([
        'SOLUSDT',
      ]),
    requestedTimeframes,
    candlesPerTimeframe: 8,
    reviewLimitPerSymbol: 1,
    reviewPolicy:
      Object.freeze({
        atrPeriod: 14,
        decisiveBreakAtr: 0.35,
        consecutiveBreakCloses: 2,
        staleAfterBars: 120,
        staleDistanceAtr: 3,
        minimumFutureBars: 2,
      }),
    symbolReports:
      Object.freeze([
        Object.freeze({
          symbol: 'SOLUSDT',
          datasets:
            Object.freeze([
              ...datasets,
            ]),
          detection:
            Object.freeze({
              symbol: 'SOLUSDT',
              requestedTimeframes,
              timeframes:
                Object.freeze([]),
              candidates:
                Object.freeze([]),
              observationalOnly: true,
              createsSetup: false,
              mergesAcrossTimeframes:
                false,
            }),
          timeframeSummaries:
            Object.freeze([]),
          reviewQueue:
            Object.freeze([]),
        }),
      ]),
    totals:
      Object.freeze({
        symbolCount: 1,
        timeframeDatasetCount:
          datasets.length,
        candleCount,
        candidateCount: 0,
        confirmedCount: 0,
        reviewItemCount: 0,
        reviewStateCounts:
          Object.freeze({
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
  'replays sequential closed prefixes through the production causal Setup pipeline',
  () => {
    const progress:
      number[] = [];
    const report =
      replayCausalSetupRealDataDataset(
        dataset(),
        {
          startAtClosedCandleCount: 4,
          pipelineOptions:
            PIPELINE_OPTIONS,
        },
        {
          onReplayProgress:
            (value) => {
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
      report.closedCandlesCount,
      8,
    );
    assert.equal(
      report.totals
        .replayStepCount,
      5,
    );
    assert.deepEqual(
      progress,
      [1, 2, 3, 4, 5],
    );
    assert.equal(
      report.totals
        .candidateTrackCount,
      2,
    );
    assert.equal(
      report.totals
        .breakoutCandidateCount,
      1,
    );
    assert.equal(
      report.totals
        .bounceCandidateCount,
      1,
    );
    assert.equal(
      report.totals
        .observationReachedCount,
      2,
    );
    assert.equal(
      report.totals
        .approachReachedCount,
      2,
    );
    assert.equal(
      report.totals
        .confirmationReachedCount,
      0,
    );
    assert.equal(
      report.totals
        .violationCount,
      0,
    );

    const breakout =
      report.candidateTracks.find(
        (track) =>
          track.setupType
          === 'level_breakout',
      );
    const bounce =
      report.candidateTracks.find(
        (track) =>
          track.setupType
          === 'level_bounce',
      );

    assert.ok(breakout);
    assert.ok(bounce);
    assert.equal(
      breakout.direction,
      'long',
    );
    assert.equal(
      bounce.direction,
      'short',
    );
    assert.equal(
      breakout.observation
        .stage,
      'OBSERVATION',
    );
    assert.equal(
      breakout.approach
        ?.stage,
      'APPROACH',
    );
    assert.ok(
      (
        breakout.observation
          .context
          .observationProgress
        ?? 0
      ) >= 0.5,
    );
    assert.ok(
      (
        breakout.approach
          ?.context
          .distanceToLevelPercent
        ?? Number.POSITIVE_INFINITY
      ) <= 0.5,
    );
    assert.equal(
      breakout.confirmation,
      null,
    );
    assert.equal(
      report
        .historicalRealtimeEvidenceAvailable,
      false,
    );
    assert.equal(
      report
        .realtimeConfirmationValidated,
      false,
    );
    assert.equal(
      report
        .outcomeClassificationValidated,
      false,
    );
    assert.equal(
      report.usesFutureCandles,
      false,
    );
  },
);

test(
  'ignores a trailing open candle without allowing it to affect the replay',
  () => {
    const open =
      candle(8, {
        open: 99.7,
        high: 120,
        low: 80,
        close: 110,
        isClosed: false,
      });
    const withOpen =
      dataset(
        '1m',
        Object.freeze([
          ...resistanceHistory(),
          open,
        ]),
      );
    const report =
      replayCausalSetupRealDataDataset(
        withOpen,
        {
          startAtClosedCandleCount: 4,
          pipelineOptions:
            PIPELINE_OPTIONS,
        },
      );

    assert.equal(
      report.closedCandlesCount,
      8,
    );
    assert.equal(
      report
        .ignoredOpenCandlesCount,
      1,
    );
    assert.equal(
      report.totals
        .candidateTrackCount,
      2,
    );
    assert.equal(
      report.lastClosedAt,
      resistanceHistory()
        .at(-1)
        ?.closeTime,
    );
  },
);

test(
  'builds a deterministic aggregate report from only the production 1m datasets',
  () => {
    const source =
      sourceReport([
        dataset('1m'),
        dataset('5m'),
      ]);
    const first =
      buildCausalSetupRealDataValidationReport(
        source,
        {
          startAtClosedCandleCount: 4,
          pipelineOptions:
            PIPELINE_OPTIONS,
        },
      );
    const second =
      buildCausalSetupRealDataValidationReport(
        source,
        {
          startAtClosedCandleCount: 4,
          pipelineOptions:
            PIPELINE_OPTIONS,
        },
      );

    assert.deepEqual(
      first,
      second,
    );
    assert.equal(
      first.version,
      'causal-setup-real-data-validation-v0.1',
    );
    assert.equal(
      first.sourceDatasets.length,
      1,
    );
    assert.equal(
      first.sourceDatasets[0]
        ?.sourceTimeframe,
      '1m',
    );
    assert.equal(
      first.totals.datasetCount,
      1,
    );
    assert.equal(
      first.totals
        .candidateTrackCount,
      2,
    );
    assert.equal(
      first.appliedOptions
        .pipelineOptions
        .levelLinesOptions
        .touchTolerancePercent,
      0.15,
    );
    assert.equal(
      first.appliedOptions
        .pipelineOptions
        .levelLinesOptions
        .decisiveBreakAtr,
      0.5,
    );
    assert.equal(
      first.offlineOnly,
      true,
    );
    assert.equal(
      first.changesTradingRules,
      false,
    );
    assert.equal(
      first.createsSignal,
      false,
    );
    assert.equal(
      first.usesQualityScore,
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
      Object.isFrozen(
        first.appliedOptions,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        first.symbolReports,
      ),
      true,
    );
  },
);

test(
  'rejects non-causal candle ordering and reports without a 1m dataset',
  () => {
    const open =
      candle(7, {
        open: 99,
        high: 100,
        low: 98,
        close: 99,
        isClosed: false,
      });
    const laterClosed =
      candle(8, {
        open: 99,
        high: 100,
        low: 98,
        close: 99,
      });

    assert.throws(
      () =>
        replayCausalSetupRealDataDataset(
          dataset(
            '1m',
            Object.freeze([
              ...resistanceHistory()
                .slice(0, 7),
              open,
              laterClosed,
            ]),
          ),
          {
            startAtClosedCandleCount:
              4,
            pipelineOptions:
              PIPELINE_OPTIONS,
          },
        ),
      CausalSetupRealDataValidationError,
    );

    assert.throws(
      () =>
        buildCausalSetupRealDataValidationReport(
          sourceReport([
            dataset('5m'),
          ]),
          {
            startAtClosedCandleCount:
              4,
            pipelineOptions:
              PIPELINE_OPTIONS,
          },
        ),
      /must include the production 1m timeframe/,
    );
  },
);

test(
  'rejects a replay start beyond the available closed history',
  () => {
    assert.throws(
      () =>
        replayCausalSetupRealDataDataset(
          dataset(),
          {
            startAtClosedCandleCount: 9,
            pipelineOptions:
              PIPELINE_OPTIONS,
          },
        ),
      (
        error: unknown,
      ) =>
        error
          instanceof CausalSetupRealDataValidationError
        && /fewer than startAtClosedCandleCount 9/.test(
          error.message,
        ),
    );
  },
);
