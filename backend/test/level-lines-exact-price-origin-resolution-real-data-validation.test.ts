import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';
import {
  LevelLinesExactPriceOriginResolutionRealDataValidationError,
  validateLevelLinesExactPriceOriginResolutionOnRealData,
} from '../src/modules/level-engine/level-lines-exact-price-origin-resolution-real-data-validation.js';
import type {
  CausalSetupRealDataValidationReport,
} from '../src/modules/setup-engine/causal-setup-real-data-validation.types.js';

const START_TIME_MS = Date.parse(
  '2026-08-21T12:00:00.000Z',
);

const LEVEL_OPTIONS = Object.freeze({
  atrPeriod: 2,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  originDepartureAtr: 0.6,
  originDepartureMaxCandles: 4,
  candidateVisibilityMinDepartureAtr: 2,
  candidateVisibilityMaxAgeBars: 20,
  persistentCandidateMinDepartureAtr: 1.5,
  persistentCandidateLookbackBars: 3,
  originEpisodeMaxSpanCandles: 3,
  workedEpisodeMaxSpanCandles: 8,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.5,
  consecutiveBreakCloses: 2,
}) satisfies LevelLinesDetectionOptions;

function candle(
  index: number,
  values: readonly [
    open: number,
    high: number,
    low: number,
    close: number,
  ],
): LevelEngineCandle {
  const openTime =
    START_TIME_MS + index * 60_000;

  return Object.freeze({
    openTime:
      new Date(openTime).toISOString(),
    closeTime:
      new Date(
        openTime + 59_999,
      ).toISOString(),
    open: values[0],
    high: values[1],
    low: values[2],
    close: values[3],
    isClosed: true,
  });
}

function exactPriceOriginHistory():
readonly LevelEngineCandle[] {
  return Object.freeze([
    candle(0, [95, 96, 94, 95]),
    candle(1, [96, 100, 95, 99]),
    candle(2, [96.8, 97, 96, 96.5]),
    candle(3, [96, 97, 95, 96]),
    candle(4, [97, 99, 96, 98]),
    candle(5, [96, 97, 95, 96]),
    candle(6, [96, 100, 95, 99]),
    candle(7, [96.8, 97, 96, 96.5]),
    candle(8, [96, 97, 95, 96]),
  ]);
}

function source(
  candles: readonly LevelEngineCandle[],
): CausalSetupRealDataValidationReport {
  return {
    version:
      'causal-setup-real-data-validation-v0.1',
    sourceValidationVersion:
      'level-engine-real-data-validation-v0.1',
    generatedAt:
      '2026-08-21T13:00:00.000Z',
    requestedSymbols: Object.freeze([
      'ARKMUSDT',
    ]),
    sourceDatasets: Object.freeze([
      Object.freeze({
        symbol: 'ARKMUSDT',
        sourceTimeframe: '1m',
        candles,
      }),
    ]),
    symbolReports: Object.freeze([]),
    totals: Object.freeze({
      symbolCount: 1,
      datasetCount: 1,
      closedCandlesCount: candles.length,
      ignoredOpenCandlesCount: 0,
      replayStepCount: 0,
      activeLevelObservationCount: 0,
      uniqueLevelCount: 0,
      emittedCandidateCount: 0,
      candidateTrackCount: 0,
      breakoutCandidateCount: 0,
      bounceCandidateCount: 0,
      longCandidateCount: 0,
      shortCandidateCount: 0,
      observationReachedCount: 0,
      approachReachedCount: 0,
      confirmationReachedCount: 0,
      duplicateCandidateObservationCount: 0,
      candidateDisappearanceCount: 0,
      candidateReappearanceCount: 0,
      violationCount: 0,
      levelConfirmedToObservationBars:
        Object.freeze({
          sampleCount: 0,
          minimumBars: null,
          medianBars: null,
          averageBars: null,
          maximumBars: null,
        }),
      observationToApproachBars:
        Object.freeze({
          sampleCount: 0,
          minimumBars: null,
          medianBars: null,
          averageBars: null,
          maximumBars: null,
        }),
      approachToConfirmationBars:
        Object.freeze({
          sampleCount: 0,
          minimumBars: null,
          medianBars: null,
          averageBars: null,
          maximumBars: null,
        }),
    }),
    appliedOptions: Object.freeze({
      startAtClosedCandleCount: 4,
      pipelineOptions: Object.freeze({
        maxCandles: 100,
        levelLinesOptions:
          LEVEL_OPTIONS,
        candidateOptions: Object.freeze({
          expiresAfterSec: 3_600,
        }),
        setupTypes: Object.freeze([
          'level_breakout' as const,
          'level_bounce' as const,
        ]),
      }),
      historicalRealtimeEvidenceMode:
        'unavailable',
    }),
    offlineOnly: true,
    reusesFetchedDatasets: true,
    historicalRealtimeEvidenceAvailable:
      false,
    realtimeConfirmationValidated: false,
    outcomeClassificationValidated: false,
    changesTradingRules: false,
    createsLiveSetup: false,
    createsSignal: false,
    usesQualityScore: false,
    appliesTraining: false,
    usesFutureCandles: false,
    usesFutureRealtimeEvidence: false,
  };
}

test(
  'validates observed production resolution and preserves history across restart replay',
  () => {
    const progress: string[] = [];
    const report =
      validateLevelLinesExactPriceOriginResolutionOnRealData(
        source(
          exactPriceOriginHistory(),
        ),
        {
          generatedAt:
            '2026-08-21T14:00:00.000Z',
          sourceDatasetHash:
            'fixture-sha256',
        },
        {
          onReplayProgress: (value) => {
            progress.push(
              `${value.pass}:${value.completedStepCount}`,
            );
          },
        },
      );

    assert.equal(
      report.version,
      'level-lines-exact-price-origin-resolution-real-data-validation-v0.1',
    );
    assert.equal(
      report.status,
      'validated_with_observed_resolution',
    );
    assert.equal(
      report.totals.uniqueDecisionCount,
      1,
    );
    assert.equal(
      report.totals
        .activeIdentityReuseDecisionCount,
      1,
    );
    assert.equal(
      report.totals
        .workedIdentityRearmDecisionCount,
      0,
    );
    assert.equal(
      report.fullHistoryPreserved,
      true,
    );
    assert.equal(
      report.residualCurrentCollisionsObserved,
      false,
    );
    assert.equal(
      report.restartReplayEquivalent,
      true,
    );
    assert.equal(
      report.totals
        .restartReplayMismatchCount,
      0,
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );
    assert.equal(
      report.datasets[0]
        ?.primaryReplayFingerprint,
      report.datasets[0]
        ?.restartReplayFingerprint,
    );
    assert.equal(
      progress.some(
        (value) =>
          value.startsWith('primary:'),
      ),
      true,
    );
    assert.equal(
      progress.some(
        (value) =>
          value.startsWith('restart:'),
      ),
      true,
    );
  },
);

test(
  'is deterministic and keeps the offline safety boundary',
  () => {
    const value = source(
      exactPriceOriginHistory(),
    );
    const options = {
      generatedAt:
        '2026-08-21T14:00:00.000Z',
      sourceDatasetHash:
        'fixture-sha256',
    } as const;
    const first =
      validateLevelLinesExactPriceOriginResolutionOnRealData(
        value,
        options,
      );
    const second =
      validateLevelLinesExactPriceOriginResolutionOnRealData(
        value,
        options,
      );

    assert.deepEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(
      Object.isFrozen(first.datasets),
      true,
    );
    assert.equal(first.offlineOnly, true);
    assert.equal(
      first.reusesSavedRealCandles,
      true,
    );
    assert.equal(
      first.syntheticObservationsCreated,
      false,
    );
    assert.equal(first.usesExactPriceOnly, true);
    assert.equal(first.mergesNearbyPrices, false);
    assert.equal(
      first.changesLevelIdentityFormula,
      false,
    );
    assert.equal(first.changesTradingRules, false);
    assert.equal(first.createsLiveSetup, false);
    assert.equal(first.createsTradeOrder, false);
    assert.equal(first.createsSignal, false);
    assert.equal(first.appliesTraining, false);
    assert.equal(first.usesFutureCandles, false);
  },
);

test(
  'rejects an incompatible source safety contract',
  () => {
    const compatible = source(
      exactPriceOriginHistory(),
    );
    const incompatible = {
      ...compatible,
      changesTradingRules: true,
    } as unknown as CausalSetupRealDataValidationReport;

    assert.throws(
      () =>
        validateLevelLinesExactPriceOriginResolutionOnRealData(
          incompatible,
        ),
      LevelLinesExactPriceOriginResolutionRealDataValidationError,
    );
  },
);
