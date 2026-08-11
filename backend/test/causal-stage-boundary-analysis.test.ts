import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelEngineRealDataValidationReport,
  LevelEngineValidationDatasetSnapshot,
} from '../src/modules/level-engine/level-engine-real-data-validation.types.js';
import {
  buildCausalStageBoundaryAnalysisReport,
  CausalStageBoundaryAnalysisError,
} from '../src/modules/setup-engine/causal-stage-boundary-analysis.js';
import {
  buildCausalSetupRealDataValidationReport,
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
  open: number,
  high: number,
  low: number,
  close: number,
): LevelEngineCandle {
  const openTime =
    START_TIME_MS
    + index * 60_000;

  return Object.freeze({
    openTime:
      new Date(openTime)
        .toISOString(),
    closeTime:
      new Date(
        openTime + 59_999,
      ).toISOString(),
    open,
    high,
    low,
    close,
    isClosed: true,
  });
}

function candles():
readonly LevelEngineCandle[] {
  return Object.freeze([
    candle(0, 95, 96, 94, 95),
    candle(1, 96, 100, 95, 99),
    candle(2, 96.8, 97, 96, 96.5),
    candle(3, 96, 97, 95, 96),
    candle(4, 97, 99.9, 96, 99),
    candle(5, 98, 98, 95, 96),
    candle(6, 96, 97, 94, 95),
    candle(7, 99.2, 99.8, 99.1, 99.7),
    candle(8, 99.3, 99.9, 99.2, 99.6),
  ]);
}

function dataset():
LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol: 'SOLUSDT',
    sourceTimeframe: '1m',
    candles: candles(),
  });
}

function sourceReport():
LevelEngineRealDataValidationReport {
  const sourceDataset =
    dataset();

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
    requestedTimeframes:
      Object.freeze([
        '1m' as const,
      ]),
    candlesPerTimeframe: 9,
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
              sourceDataset,
            ]),
          detection:
            Object.freeze({
              symbol: 'SOLUSDT',
              requestedTimeframes:
                Object.freeze([
                  '1m' as const,
                ]),
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
        timeframeDatasetCount: 1,
        candleCount: 9,
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

function causalReport() {
  return buildCausalSetupRealDataValidationReport(
    sourceReport(),
    {
      startAtClosedCandleCount: 4,
      pipelineOptions:
        PIPELINE_OPTIONS,
    },
  );
}

test(
  'compares current, next-candle and boundary-crossing policies without changing trading rules',
  () => {
    const progress:
      string[] = [];
    const report =
      buildCausalStageBoundaryAnalysisReport(
        causalReport(),
        {
          onReplayProgress:
            (value) => {
              progress.push(
                `${value.symbol}:${value.completedStepCount}/${value.totalStepCount}`,
              );
            },
        },
      );

    assert.equal(
      report.version,
      'causal-stage-boundary-analysis-v0.1',
    );
    assert.equal(
      report.totals.uniqueLineCount,
      1,
    );
    assert.equal(
      report.totals
        .candidateTrackCount,
      2,
    );
    assert.equal(
      report.totals
        .candidatePairAnomalyCount,
      0,
    );
    assert.equal(
      report.totals.current
        .sameBarApproachCount,
      1,
    );
    assert.equal(
      report.totals.nextClosedCandle
        .approachCount,
      1,
    );
    assert.equal(
      report.totals.nextClosedCandle
        .delayedFromCurrentCount,
      1,
    );
    assert.equal(
      report.totals.nextClosedCandle
        .observationToApproachBars
        .minimumBars,
      1,
    );
    assert.equal(
      report.totals
        .outsideToInsideCrossing
        .sameBarApproachCount,
      1,
    );
    assert.equal(
      report.totals.sameBarReasons
        .enteredBoundaryOnObservationCandle,
      1,
    );
    assert.equal(
      report.symbolReports[0]
        ?.lines[0]
        ?.sameBarReason,
      'entered_boundary_on_observation_candle',
    );
    assert.equal(
      report.comparesPoliciesOnly,
      true,
    );
    assert.equal(
      report.changesTradingRules,
      false,
    );
    assert.equal(
      report.createsLiveSetup,
      false,
    );
    assert.equal(
      report.createsSignal,
      false,
    );
    assert.equal(
      report.usesFutureCandles,
      false,
    );
    assert.equal(
      Object.isFrozen(report),
      true,
    );
    assert.deepEqual(
      progress,
      [
        'SOLUSDT:1/6',
        'SOLUSDT:2/6',
        'SOLUSDT:3/6',
        'SOLUSDT:4/6',
        'SOLUSDT:5/6',
        'SOLUSDT:6/6',
      ],
    );
  },
);

test(
  'is deterministic and rejects a source report with invariant violations',
  () => {
    const source =
      causalReport();
    const first =
      buildCausalStageBoundaryAnalysisReport(
        source,
      );
    const second =
      buildCausalStageBoundaryAnalysisReport(
        source,
      );

    assert.deepEqual(
      first,
      second,
    );

    const invalid = {
      ...source,
      totals: {
        ...source.totals,
        violationCount: 1,
      },
    };

    assert.throws(
      () =>
        buildCausalStageBoundaryAnalysisReport(
          invalid,
        ),
      CausalStageBoundaryAnalysisError,
    );
  },
);
