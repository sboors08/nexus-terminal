import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';
import {
  diagnoseLevelLinesExactPriceOriginCollisions,
  LevelLinesExactPriceOriginCollisionDiagnosticsError,
} from '../src/modules/level-engine/level-lines-exact-price-origin-collision-diagnostics.js';
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
  'reports distinct active origins that share one exact price',
  () => {
    const progress: number[] = [];
    const report =
      diagnoseLevelLinesExactPriceOriginCollisions(
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
              value.completedStepCount,
            );
          },
        },
      );

    assert.equal(
      report.version,
      'level-lines-exact-price-origin-collision-diagnostics-v0.1',
    );
    assert.equal(
      report.status,
      'diagnosed_with_collisions',
    );
    assert.equal(
      report.exactPriceCollisionsObserved,
      true,
    );
    assert.equal(
      report.totals.collisionGroupCount,
      1,
    );
    assert.equal(
      report.totals.uniqueCollidingLineCount,
      2,
    );
    assert.equal(
      report.totals.maximumConcurrentLineCount,
      2,
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );

    const group =
      report.datasets[0]?.groups[0];
    const pair = group?.pairs[0];

    assert.ok(group);
    assert.equal(group.symbol, 'ARKMUSDT');
    assert.equal(group.kind, 'resistance');
    assert.equal(group.price, 100);
    assert.equal(group.distinctLineCount, 2);
    assert.deepEqual(
      group.originCandleIndices,
      [1, 6],
    );
    assert.ok(pair);
    assert.equal(pair.originGapBars, 5);
    assert.equal(
      pair.newerInheritedPriorExactOriginEvidence,
      true,
    );
    assert.equal(
      progress.at(-1),
      exactPriceOriginHistory().length
      - 4
      + 1,
    );
  },
);

test(
  'reports a valid cohort when no simultaneous exact-price origins are observed',
  () => {
    const report =
      diagnoseLevelLinesExactPriceOriginCollisions(
        source(
          exactPriceOriginHistory()
            .slice(0, 6),
        ),
        {
          generatedAt:
            '2026-08-21T14:00:00.000Z',
        },
      );

    assert.equal(
      report.status,
      'diagnosed_without_collisions',
    );
    assert.equal(
      report.totals.collisionGroupCount,
      0,
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );
  },
);

test(
  'is deterministic and keeps the diagnostic safety boundary',
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
      diagnoseLevelLinesExactPriceOriginCollisions(
        value,
        options,
      );
    const second =
      diagnoseLevelLinesExactPriceOriginCollisions(
        value,
        options,
      );

    assert.deepEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(
      Object.isFrozen(first.datasets),
      true,
    );
    assert.equal(
      first.recommendsImmediatePriceMerge,
      false,
    );
    assert.equal(first.changesLevelIdentity, false);
    assert.equal(first.changesTradingRules, false);
    assert.equal(first.createsLiveSetup, false);
    assert.equal(first.createsTradeOrder, false);
    assert.equal(first.createsSignal, false);
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
      usesFutureCandles: true,
    } as unknown as CausalSetupRealDataValidationReport;

    assert.throws(
      () =>
        diagnoseLevelLinesExactPriceOriginCollisions(
          incompatible,
        ),
      LevelLinesExactPriceOriginCollisionDiagnosticsError,
    );
  },
);
