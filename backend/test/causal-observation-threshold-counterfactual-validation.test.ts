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
  buildCausalObservationThresholdCounterfactualValidationReport,
  CausalObservationThresholdCounterfactualValidationError,
} from '../src/modules/setup-engine/causal-observation-threshold-counterfactual-validation.js';
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

function currentCandidateCandles():
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

function earlyOnlyCandles():
readonly LevelEngineCandle[] {
  return Object.freeze([
    ...currentCandidateCandles().slice(
      0,
      7,
    ),
    candle(7, 95, 96.2, 94.5, 96),
    candle(8, 96, 96.7, 94.8, 96.5),
  ]);
}

function sourceReport(
  candles: readonly LevelEngineCandle[],
): LevelEngineRealDataValidationReport {
  const sourceDataset:
  LevelEngineValidationDatasetSnapshot =
    Object.freeze({
      symbol: 'SOLUSDT',
      sourceTimeframe: '1m',
      candles,
    });

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
    candlesPerTimeframe:
      candles.length,
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
        candleCount:
          candles.length,
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

function causalReport(
  candles: readonly LevelEngineCandle[],
) {
  return buildCausalSetupRealDataValidationReport(
    sourceReport(candles),
    {
      startAtClosedCandleCount: 4,
      pipelineOptions:
        PIPELINE_OPTIONS,
    },
  );
}

test(
  'reproduces the current 0.50 cohort and measures every threshold independently',
  () => {
    const progress: string[] = [];
    const report =
      buildCausalObservationThresholdCounterfactualValidationReport(
        causalReport(
          currentCandidateCandles(),
        ),
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
      'causal-observation-threshold-counterfactual-validation-v0.1',
    );
    assert.deepEqual(
      report.progressThresholds,
      [0.5, 0.4, 0.3, 0.2, 0.1],
    );
    assert.equal(
      report.totals.universeLineCount,
      1,
    );
    assert.equal(
      report.totals.currentCandidateLineCount,
      1,
    );
    assert.equal(
      report.totals.candidateTrackCount,
      2,
    );
    assert.equal(
      report.totals.anomalies.totalCount,
      0,
    );
    assert.equal(
      progress.at(-1),
      'SOLUSDT:6/6',
    );

    const line =
      report.symbolReports[0]
        ?.lines[0];

    assert.ok(line);
    assert.equal(
      line.currentCandidate,
      true,
    );
    assert.equal(
      line.currentCandidateCount,
      2,
    );
    assert.ok(
      line.geometryObservationCount > 0,
    );

    const current =
      line.policies.find(
        (value) =>
          value.policy
          === 'progress_0_50',
      );

    assert.ok(current?.firstEntry);
    assert.equal(
      current.firstEntry
        .observedCandleIndex,
      line.currentObservation
        ?.observedCandleIndex,
    );
    assert.equal(
      current.firstApproach
        ?.observedCandleIndex
      ?? null,
      line.currentApproach
        ?.observedCandleIndex
      ?? null,
    );
    assert.equal(
      current.currentCandidateEntry,
      true,
    );
    assert.equal(
      current.additionalCounterfactualEntry,
      false,
    );
    assert.equal(
      current.episodes.length,
      current.churn.reappearanceCount
      + 1,
    );
    assert.equal(
      current.churn.disappearanceCount,
      current.churn
        .progressRegressionDisappearanceCount
      + current.churn
        .geometryUnavailableDisappearanceCount,
    );
    assert.ok(
      current.episodes.every(
        (episode) =>
          episode.continuousObservationBars
            > 0,
      ),
    );

    const entries =
      line.policies.map(
        (value) =>
          value.firstEntry
            ?.observedCandleIndex
          ?? null,
      ).filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

    assert.deepEqual(
      entries,
      [...entries].sort(
        (left, right) =>
          right - left,
      ),
    );
    assert.ok(
      Object.isFrozen(report)
      && Object.isFrozen(
        report.symbolReports,
      )
      && Object.isFrozen(
        current.episodes,
      ),
    );
    assert.equal(
      report.offlineOnly,
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
      report.usesFutureCandlesForEntry,
      false,
    );
    assert.equal(
      report
        .usesFutureCandlesForOutcomeEvaluation,
      true,
    );
    assert.deepEqual(
      buildCausalObservationThresholdCounterfactualValidationReport(
        causalReport(
          currentCandidateCandles(),
        ),
      ),
      report,
    );
  },
);

test(
  'includes a causally available line that enters early thresholds but never reaches 0.50',
  () => {
    const report =
      buildCausalObservationThresholdCounterfactualValidationReport(
        causalReport(
          earlyOnlyCandles(),
        ),
      );

    assert.equal(
      report.totals.universeLineCount,
      1,
    );
    assert.equal(
      report.totals.currentCandidateLineCount,
      0,
    );
    assert.equal(
      report.totals.nonCandidateUniverseLineCount,
      1,
    );
    assert.equal(
      report.totals.anomalies.totalCount,
      0,
    );

    const current =
      report.totals.policies.find(
        (value) =>
          value.policy
          === 'progress_0_50',
      );
    const early =
      report.totals.policies.find(
        (value) =>
          value.policy
          === 'progress_0_30',
      );

    assert.ok(current);
    assert.ok(early);
    assert.equal(
      current.entryLineCount,
      0,
    );
    assert.equal(
      early.entryLineCount,
      1,
    );
    assert.equal(
      early
        .additionalCounterfactualEntryLineCount,
      1,
    );
    assert.equal(
      early.approachReachedLineCount,
      0,
    );
    assert.equal(
      early.noSubsequentApproachLineCount,
      1,
    );
    assert.equal(
      early.additionalNoApproachLineCount,
      1,
    );
    assert.equal(
      early.continuousObservationBars
        .sampleCount,
      early.entryEpisodeCount,
    );
  },
);

test(
  'rejects an incompatible causal validation source',
  () => {
    const source =
      causalReport(
        currentCandidateCandles(),
      );

    assert.throws(
      () =>
        buildCausalObservationThresholdCounterfactualValidationReport(
          {
            ...source,
            changesTradingRules:
              true as false,
          },
        ),
      CausalObservationThresholdCounterfactualValidationError,
    );
  },
);
