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
  buildCausalSetupRealDataValidationReport,
} from '../src/modules/setup-engine/causal-setup-real-data-validation.js';
import type {
  SetupDetectionPipelineOptions,
} from '../src/modules/setup-engine/setup-detection-pipeline.types.js';
import {
  SetupCandidateEpisodeRealDataValidationError,
  validateSetupCandidateEpisodeRealData,
} from '../src/modules/setup-engine/setup-candidate-episode-real-data-validation.js';

const START_TIME_MS = Date.parse(
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
  },
): LevelEngineCandle {
  const openTimeMs =
    START_TIME_MS + index * 60_000;

  return Object.freeze({
    openTime:
      new Date(openTimeMs).toISOString(),
    closeTime:
      new Date(
        openTimeMs + 59_999,
      ).toISOString(),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    isClosed: true,
  });
}

function resistanceHistory(
  includeRearm: boolean,
): readonly LevelEngineCandle[] {
  const initial = [
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
  ];

  if (!includeRearm) {
    return Object.freeze(initial);
  }

  return Object.freeze([
    ...initial,
    candle(8, {
      open: 99,
      high: 99.2,
      low: 95.5,
      close: 96,
    }),
    candle(9, {
      open: 96,
      high: 99.75,
      low: 95.8,
      close: 99.6,
    }),
    candle(10, {
      open: 99.6,
      high: 99.7,
      low: 99.2,
      close: 99.4,
    }),
  ]);
}

function dataset(
  includeRearm: boolean,
): LevelEngineValidationDatasetSnapshot {
  return Object.freeze({
    symbol: 'SOLUSDT',
    sourceTimeframe: '1m',
    candles: resistanceHistory(includeRearm),
  });
}

function levelSource(
  includeRearm: boolean,
): LevelEngineRealDataValidationReport {
  const sourceDataset = dataset(includeRearm);

  return Object.freeze({
    version:
      'level-engine-real-data-validation-v0.1',
    reviewDiagnosticsVersion:
      'level-engine-review-diagnostics-v0.1',
    generatedAt:
      '2026-07-26T13:00:00.000Z',
    binanceBaseUrl:
      'https://fapi.binance.com',
    requestedSymbols: Object.freeze([
      'SOLUSDT',
    ]),
    requestedTimeframes: Object.freeze([
      '1m' as const,
    ]),
    candlesPerTimeframe:
      sourceDataset.candles.length,
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
        datasets: Object.freeze([
          sourceDataset,
        ]),
        detection: Object.freeze({
          symbol: 'SOLUSDT',
          requestedTimeframes:
            Object.freeze([
              '1m' as const,
            ]),
          timeframes: Object.freeze([]),
          candidates: Object.freeze([]),
          observationalOnly: true,
          createsSetup: false,
          mergesAcrossTimeframes: false,
        }),
        timeframeSummaries: Object.freeze([]),
        reviewQueue: Object.freeze([]),
      }),
    ]),
    totals: Object.freeze({
      symbolCount: 1,
      timeframeDatasetCount: 1,
      candleCount:
        sourceDataset.candles.length,
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

function causalSource(includeRearm: boolean) {
  return buildCausalSetupRealDataValidationReport(
    levelSource(includeRearm),
    {
      startAtClosedCandleCount: 4,
      pipelineOptions: PIPELINE_OPTIONS,
    },
  );
}

test(
  'validates real-candle rearm, same-episode suppression and restart equivalence',
  () => {
    const progress: string[] = [];
    const report =
      validateSetupCandidateEpisodeRealData(
        causalSource(true),
        {
          generatedAt:
            '2026-08-21T00:00:00.000Z',
          sourceDatasetHash: 'fixture-sha256',
        },
        {
          onReplayProgress: (value) => {
            progress.push(
              `${value.phase}:${value.completedStepCount}`,
            );
          },
        },
      );

    assert.equal(
      report.version,
      'setup-candidate-episode-real-data-validation-v0.1',
    );
    assert.equal(
      report.status,
      'validated_with_observed_rearms',
    );
    assert.equal(
      report.totals.candidateTrackCount,
      6,
    );
    assert.equal(
      report.totals.uniqueLineSetupPairCount,
      4,
    );
    assert.equal(
      report.totals.rearmedPairCount,
      2,
    );
    assert.equal(
      report.totals.rearmCount,
      2,
    );
    assert.ok(
      report.totals
        .duplicateSuppressionObservationCount
        > 0,
    );
    assert.equal(
      report.totals.restartMismatchCount,
      0,
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );
    assert.equal(
      report.permanentDuplicateCutoffEliminated,
      true,
    );
    assert.equal(
      report.restartEquivalent,
      true,
    );
    assert.equal(
      report.sameEpisodeChurnDetected,
      false,
    );
    assert.equal(
      report.datasets[0]?.pairs.filter(
        (pair) => pair.episodeCount === 2,
      ).length,
      2,
    );
    assert.equal(
      report.datasets[0]?.pairs.filter(
        (pair) => pair.episodeCount === 1,
      ).length,
      2,
    );
    assert.equal(
      report.datasets[0]?.candidates.every(
        (candidate) =>
          candidate.candidateId
            === candidate.episodeId
          && candidate.createdAt
            === candidate.startedAt,
      ),
      true,
    );
    assert.equal(
      progress.some(
        (value) =>
          value.startsWith('baseline:'),
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
  'reports a valid bounded cohort when no rearm is observed',
  () => {
    const report =
      validateSetupCandidateEpisodeRealData(
        causalSource(false),
        {
          generatedAt:
            '2026-08-21T00:00:00.000Z',
        },
      );

    assert.equal(
      report.status,
      'validated_without_observed_rearms',
    );
    assert.equal(
      report.totals.rearmCount,
      0,
    );
    assert.equal(
      report.permanentDuplicateCutoffEliminated,
      false,
    );
    assert.equal(
      report.restartEquivalent,
      true,
    );
    assert.equal(
      report.totals.violationCount,
      0,
    );
  },
);

test(
  'is deterministic for the same saved candles and timestamp',
  () => {
    const source = causalSource(true);
    const options = {
      generatedAt:
        '2026-08-21T00:00:00.000Z',
      sourceDatasetHash: 'fixture-sha256',
    } as const;
    const first =
      validateSetupCandidateEpisodeRealData(
        source,
        options,
      );
    const second =
      validateSetupCandidateEpisodeRealData(
        source,
        options,
      );

    assert.deepEqual(first, second);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(
      Object.isFrozen(first.datasets),
      true,
    );
    assert.equal(
      Object.isFrozen(
        first.datasets[0]?.candidates,
      ),
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
    assert.equal(
      first.changesTradingRules,
      false,
    );
    assert.equal(first.createsSignal, false);
    assert.equal(
      first.createsTradeOrder,
      false,
    );
    assert.equal(first.usesFutureCandles, false);
  },
);

test(
  'rejects an incompatible source report',
  () => {
    const source = causalSource(false);
    const incompatible = {
      ...source,
      changesTradingRules: true,
    } as unknown as typeof source;

    assert.throws(
      () =>
        validateSetupCandidateEpisodeRealData(
          incompatible,
        ),
      SetupCandidateEpisodeRealDataValidationError,
    );
  },
);
