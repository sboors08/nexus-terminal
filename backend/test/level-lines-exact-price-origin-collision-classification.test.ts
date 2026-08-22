import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyLevelLinesExactPriceOriginCollisions,
  LevelLinesExactPriceOriginCollisionClassificationError,
} from '../src/modules/level-engine/level-lines-exact-price-origin-collision-classification.js';
import type {
  LevelLinesExactPriceOriginCollisionDiagnosticsReport,
  LevelLinesExactPriceOriginCollisionGroupReport,
  LevelLinesExactPriceOriginCollisionPairReport,
} from '../src/modules/level-engine/level-lines-exact-price-origin-collision-diagnostics.types.js';

function pair(
  key: string,
  olderLineId: string,
  newerLineId: string,
  options: Readonly<{
    originGapBars: number;
    coactiveObservationCount: number;
    olderStatus: 'candidate' | 'confirmed' | 'worked';
    newerStatus?: 'confirmed' | 'worked';
    inherited: boolean;
    olderOriginMinute?: number;
  }>,
): LevelLinesExactPriceOriginCollisionPairReport {
  const olderOriginMinute =
    options.olderOriginMinute ?? 0;
  const newerOriginMinute =
    olderOriginMinute
    + options.originGapBars;
  const firstCoactiveMinute =
    newerOriginMinute + 2;
  const lastCoactiveMinute =
    firstCoactiveMinute
    + options.coactiveObservationCount - 1;
  const timestamp = (minute: number) =>
    new Date(
      Date.UTC(2026, 7, 21, 12, minute),
    ).toISOString();

  return Object.freeze({
    key,
    olderLineId,
    newerLineId,
    olderOriginExtremumAt:
      timestamp(olderOriginMinute),
    newerOriginExtremumAt:
      timestamp(newerOriginMinute),
    originGapBars: options.originGapBars,
    firstCoactiveAt:
      timestamp(firstCoactiveMinute),
    lastCoactiveAt:
      timestamp(lastCoactiveMinute),
    coactiveObservationCount:
      options.coactiveObservationCount,
    olderStatusAtFirstCoactive:
      options.olderStatus,
    newerStatusAtFirstCoactive:
      options.newerStatus ?? 'confirmed',
    newerInheritedPriorExactOriginEvidence:
      options.inherited,
  });
}

function group(
  key: string,
  pairs:
    readonly LevelLinesExactPriceOriginCollisionPairReport[],
): LevelLinesExactPriceOriginCollisionGroupReport {
  const distinctLineIds = Object.freeze(
    [...new Set(
      pairs.flatMap((item) => [
        item.olderLineId,
        item.newerLineId,
      ]),
    )],
  );

  return Object.freeze({
    key,
    symbol: 'ARKMUSDT',
    timeframe: '1m',
    kind: 'support',
    price: 0.106,
    firstObservedAt:
      '2026-08-21T12:10:00.000Z',
    lastObservedAt:
      '2026-08-21T14:00:00.000Z',
    observationCount: pairs.reduce(
      (total, item) =>
        total + item.coactiveObservationCount,
      0,
    ),
    maximumConcurrentLineCount:
      Math.min(3, distinctLineIds.length),
    distinctLineCount: distinctLineIds.length,
    distinctLineIds,
    originCandleIndices: Object.freeze([]),
    originExtremumAts: Object.freeze([]),
    membershipTransitionCount: pairs.length,
    inheritedPriorExactOriginLineCount:
      pairs.filter(
        (item) =>
          item.newerInheritedPriorExactOriginEvidence,
      ).length,
    episodes: Object.freeze([]),
    pairs: Object.freeze([...pairs]),
  });
}

function source(
  groups:
    readonly LevelLinesExactPriceOriginCollisionGroupReport[],
  options: Readonly<{
    sourceViolationCount?: number;
  }> = {},
): LevelLinesExactPriceOriginCollisionDiagnosticsReport {
  const pairCount = groups.reduce(
    (total, item) =>
      total + item.pairs.length,
    0,
  );
  const lineIds = new Set(
    groups.flatMap(
      (item) => item.distinctLineIds,
    ),
  );
  const sourceViolationCount =
    options.sourceViolationCount ?? 0;

  return Object.freeze({
    version:
      'level-lines-exact-price-origin-collision-diagnostics-v0.1',
    sourceVersion:
      'causal-setup-real-data-validation-v0.1',
    sourceGeneratedAt:
      '2026-08-21T11:00:00.000Z',
    generatedAt:
      '2026-08-21T15:00:00.000Z',
    sourceDatasetHash: 'source-hash',
    requestedSymbols: Object.freeze([
      'ARKMUSDT',
    ]),
    datasets: Object.freeze([
      Object.freeze({
        symbol: 'ARKMUSDT',
        sourceTimeframe: '1m' as const,
        firstClosedAt:
          '2026-08-21T11:00:00.000Z',
        lastClosedAt:
          '2026-08-21T15:00:00.000Z',
        groups: Object.freeze([...groups]),
        violations: sourceViolationCount > 0
          ? Object.freeze([
            Object.freeze({
              code:
                'collision_scope_mismatch' as const,
              symbol: 'ARKMUSDT',
              observedAt: null,
              groupKey: null,
              lineId: null,
              message: 'source violation',
            }),
          ])
          : Object.freeze([]),
        totals: Object.freeze({
          closedCandlesCount: 100,
          replayStepCount: 82,
          activeLineObservationCount: 200,
          collisionObservationCount:
            groups.reduce(
              (total, item) =>
                total + item.observationCount,
              0,
            ),
          collisionGroupCount: groups.length,
          collisionEpisodeCount: groups.length,
          collisionPairCount: pairCount,
          uniqueCollidingLineCount: lineIds.size,
          inheritedPriorExactOriginLineCount:
            groups.reduce(
              (total, item) =>
                total
                + item
                  .inheritedPriorExactOriginLineCount,
              0,
            ),
          maximumConcurrentLineCount:
            groups.reduce(
              (maximum, item) =>
                Math.max(
                  maximum,
                  item.maximumConcurrentLineCount,
                ),
              0,
            ),
          violationCount: sourceViolationCount,
        }),
        usesFutureCandles: false as const,
      }),
    ]),
    totals: Object.freeze({
      symbolCount: 1,
      datasetCount: 1,
      closedCandlesCount: 100,
      replayStepCount: 82,
      activeLineObservationCount: 200,
      collisionObservationCount:
        groups.reduce(
          (total, item) =>
            total + item.observationCount,
          0,
        ),
      collisionGroupCount: groups.length,
      collisionEpisodeCount: groups.length,
      collisionPairCount: pairCount,
      uniqueCollidingLineCount: lineIds.size,
      inheritedPriorExactOriginLineCount:
        groups.reduce(
          (total, item) =>
            total
            + item
              .inheritedPriorExactOriginLineCount,
          0,
        ),
      maximumConcurrentLineCount:
        groups.reduce(
          (maximum, item) =>
            Math.max(
              maximum,
              item.maximumConcurrentLineCount,
            ),
          0,
        ),
      violationCount: sourceViolationCount,
    }),
    appliedOptions: Object.freeze({
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
    }),
    status: groups.length > 0
      ? 'diagnosed_with_collisions' as const
      : 'diagnosed_without_collisions' as const,
    exactPriceCollisionsObserved:
      groups.length > 0,
    repeatedOriginWhilePriorLineActiveObserved:
      groups.length > 0,
    independentStructureConfirmed: false as const,
    duplicateOriginConfirmed: false as const,
    recommendsImmediatePriceMerge: false as const,
    offlineOnly: true as const,
    reusesSavedRealCandles: true as const,
    syntheticObservationsCreated: false as const,
    changesLevelIdentity: false as const,
    changesTradingRules: false as const,
    createsLiveSetup: false as const,
    createsTradeOrder: false as const,
    createsSignal: false as const,
    usesFutureCandles: false as const,
  });
}

test(
  'classifies active reconfirmation and worked retention as separate resolution paths',
  () => {
    const input = source([
      group('ARKMUSDT|1m|support|0.106', [
        pair(
          'active-pair',
          'line-a',
          'line-b',
          {
            originGapBars: 4,
            coactiveObservationCount: 8,
            olderStatus: 'confirmed',
            inherited: true,
          },
        ),
        pair(
          'worked-pair',
          'line-b',
          'line-c',
          {
            originGapBars: 60,
            coactiveObservationCount: 80,
            olderStatus: 'worked',
            inherited: true,
            olderOriginMinute: 10,
          },
        ),
      ]),
    ]);

    const report =
      classifyLevelLinesExactPriceOriginCollisions(
        input,
        {
          generatedAt:
            '2026-08-21T16:00:00.000Z',
          sourceReportHash: 'report-hash',
        },
      );

    assert.equal(
      report.status,
      'classified_with_split_resolution',
    );
    assert.equal(
      report.totals.activeOriginReconfirmationCount,
      1,
    );
    assert.equal(
      report.totals.workedOriginRetentionRearmCount,
      1,
    );
    assert.equal(
      report.totals.gapBuckets.bars1To9,
      1,
    );
    assert.equal(
      report.totals.gapBuckets.bars60Plus,
      1,
    );
    assert.equal(
      report.allObservedPairsInheritedPriorOriginEvidence,
      true,
    );
    assert.equal(
      report.requiresSplitResolutionContract,
      true,
    );
    assert.equal(
      report.recommendsSingleGlobalPriceMerge,
      false,
    );
  },
);

test(
  'keeps non-inherited origins unresolved instead of inventing independence',
  () => {
    const input = source([
      group('ARKMUSDT|1m|support|0.106', [
        pair(
          'unresolved-pair',
          'line-a',
          'line-b',
          {
            originGapBars: 12,
            coactiveObservationCount: 1,
            olderStatus: 'candidate',
            inherited: false,
          },
        ),
        pair(
          'post-work-pair',
          'line-b',
          'line-c',
          {
            originGapBars: 35,
            coactiveObservationCount: 11,
            olderStatus: 'worked',
            inherited: false,
            olderOriginMinute: 15,
          },
        ),
      ]),
    ]);

    const report =
      classifyLevelLinesExactPriceOriginCollisions(
        input,
        {
          generatedAt:
            '2026-08-21T16:00:00.000Z',
        },
      );

    assert.equal(
      report.totals.unresolvedCoactiveOriginCount,
      1,
    );
    assert.equal(
      report.totals.postWorkIndependentOriginCandidateCount,
      1,
    );
    assert.equal(
      report.independentOriginConfirmed,
      false,
    );
    assert.equal(
      report.allObservedPairsInheritedPriorOriginEvidence,
      false,
    );
  },
);

test(
  'reports malformed pair membership without classifying the pair',
  () => {
    const validPair = pair(
      'invalid-membership',
      'line-a',
      'line-b',
      {
        originGapBars: 8,
        coactiveObservationCount: 4,
        olderStatus: 'confirmed',
        inherited: true,
      },
    );
    const malformedGroup = {
      ...group(
        'ARKMUSDT|1m|support|0.106',
        [validPair],
      ),
      distinctLineIds: Object.freeze([
        'line-a',
      ]),
      distinctLineCount: 1,
    };

    const report =
      classifyLevelLinesExactPriceOriginCollisions(
        source([malformedGroup]),
        {
          generatedAt:
            '2026-08-21T16:00:00.000Z',
        },
      );

    assert.equal(report.status, 'invalid');
    assert.equal(report.totals.pairCount, 0);
    assert.equal(report.totals.violationCount, 1);
    assert.equal(
      report.violations[0]?.code,
      'pair_line_membership_mismatch',
    );
  },
);

test(
  'rejects collision reports that already contain source violations',
  () => {
    assert.throws(
      () =>
        classifyLevelLinesExactPriceOriginCollisions(
          source([], {
            sourceViolationCount: 1,
          }),
        ),
      (error: unknown) => {
        assert.ok(
          error instanceof
            LevelLinesExactPriceOriginCollisionClassificationError,
        );
        assert.equal(
          error.code,
          'source_violation_present',
        );
        return true;
      },
    );
  },
);
