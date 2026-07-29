import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  LevelV2ShadowRuntimeService,
  cloneLevelV2ShadowEvaluation,
  evaluateLevelV2ShadowComparison,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  LevelV2ShadowComparableLevel,
  LevelV2ShadowRuntimeOptions,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  SetupDetectionKlineChange,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';
import {
  LEVEL_V2_SHADOW_REGRESSION_FIXTURES,
} from './fixtures/level-v2-shadow-regression-fixtures.js';

class TestSource
implements SetupDetectionRuntimeSource {
  readonly histories =
    new Map<
      string,
      BinanceOneMinuteKlineUpdate[]
    >();

  readonly listeners =
    new Set<
      (
        event:
          SetupDetectionKlineChange,
      ) => void
    >();

  getSymbols():
  string[] {
    return [
      ...this.histories.keys(),
    ];
  }

  getKlines(
    symbolValue: string,
    limit = 1_000,
  ): BinanceOneMinuteKlineUpdate[] {
    const symbol =
      symbolValue
        .trim()
        .toUpperCase();

    return (
      this.histories.get(symbol)
      ?? []
    )
      .slice(-limit)
      .map(
        (item) => ({
          ...item,
        }),
      );
  }

  getState(): null {
    return null;
  }

  subscribeKlineChanges(
    listener:
      (
        event:
          SetupDetectionKlineChange,
      ) => void,
  ): () => void {
    this.listeners.add(
      listener,
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }
}

const runtimeOptions:
LevelV2ShadowRuntimeOptions = {
  ...DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  maxCandles:
    100,
  foundationOptions: {
    atrPeriod:
      2,
    swingLeftCandles:
      1,
    swingRightCandles:
      1,
    minReactionAtr:
      0.4,
    maxReactionLookaheadCandles:
      3,
    plateauToleranceAtr:
      0.05,
    maxPlateauWidthCandles:
      3,
    maxTouchMergeCandles:
      1,
    touchMergeToleranceAtr:
      0.1,
  },
  zonesScoreOptions: {
    minTouches:
      2,
    minTouchSpacingCandles:
      2,
    clusterToleranceAtr:
      0.5,
    maxClusterTolerancePct:
      0.5,
    corePaddingAtr:
      0.05,
    outerPaddingAtr:
      0.1,
    liquidityPaddingAtr:
      0.2,
    acceptanceWindowCandles:
      50,
    maxClosesInsideRatio:
      1,
    maxCrossingsCount:
      100,
    minStructureEdgePosition:
      0.5,
    minLevelScore:
      0,
    freshnessHalfLifeCandles:
      100,
  },
  lifecycleOptions: {
    minActiveTouches:
      3,
    minTouchSpacingCandles:
      2,
    breakoutClosesRequired:
      2,
    breakoutConfirmationPct:
      0.05,
    reactionConfirmationPct:
      0.05,
    maxTestingCandles:
      12,
    maxActiveAgeCandles:
      100,
    maxRetestWaitCandles:
      50,
  },
  evaluationOptions: {
    v1DetectorOptions: {
      pivotWindow:
        1,
      minTouches:
        2,
      minTouchSpacingCandles:
        2,
      maxDistancePct:
        0.5,
      zonePaddingPct:
        0.05,
    },
    maxMatchDistancePct:
      0.75,
  },
  now: () =>
    new Date(
      '2026-07-29T13:00:00.000Z',
    ),
};

function comparable(
  values:
    Partial<
      LevelV2ShadowComparableLevel
    > = {},
): LevelV2ShadowComparableLevel {
  return {
    id:
      values.id
      ?? 'v2-resistance-1',
    symbol:
      values.symbol
      ?? 'SOLUSDT',
    timeframe:
      values.timeframe
      ?? '1m',
    kind:
      values.kind
      ?? 'resistance',
    referencePrice:
      values.referencePrice
      ?? 100,
    zoneLow:
      values.zoneLow
      ?? 99.8,
    zoneHigh:
      values.zoneHigh
      ?? 100.2,
    touchesCount:
      values.touchesCount
      ?? 3,
    status:
      values.status
      ?? 'active',
    eligibleForSetups:
      values.eligibleForSetups
      ?? true,
    score:
      values.score
      ?? 80,
  };
}

function evaluateManual(
  levels:
    readonly LevelV2ShadowComparableLevel[],
  maxMatchDistancePct = 0.75,
) {
  return evaluateLevelV2ShadowComparison(
    'SOLUSDT',
    '1m',
    LEVEL_V2_SHADOW_REGRESSION_FIXTURES
      .cleanResistance,
    levels,
    {
      v1DetectorOptions: {
        pivotWindow:
          1,
        minTouches:
          2,
        minTouchSpacingCandles:
          2,
        maxDistancePct:
          0.5,
        zonePaddingPct:
          0.05,
      },
      maxMatchDistancePct,
    },
  );
}

function runFixture(
  candles:
    readonly BinanceOneMinuteKlineUpdate[],
) {
  const source =
    new TestSource();

  source.histories.set(
    'SOLUSDT',
    [
      ...candles,
    ],
  );

  const runtime =
    new LevelV2ShadowRuntimeService(
      source,
      runtimeOptions,
    );

  runtime.start();

  const snapshot =
    runtime.getSnapshot(
      'SOLUSDT',
    );

  runtime.stop();

  assert.ok(
    snapshot,
  );

  return snapshot;
}

test(
  'matches same-kind v1 and v2 levels within the configured distance',
  () => {
    const evaluation =
      evaluateManual([
        comparable(),
      ]);

    assert.ok(
      evaluation.summary
        .matchedLevelsCount
        >= 1,
    );

    assert.equal(
      evaluation.matches[0]
        ?.kind,
      'resistance',
    );
  },
);

test(
  'does not match opposite level kinds',
  () => {
    const evaluation =
      evaluateManual([
        comparable({
          kind:
            'support',
        }),
      ]);

    assert.equal(
      evaluation.summary
        .matchedLevelsCount,
      0,
    );
  },
);

test(
  'respects the maximum matching distance',
  () => {
    const evaluation =
      evaluateManual(
        [
          comparable({
            referencePrice:
              110,
            zoneLow:
              109.8,
            zoneHigh:
              110.2,
          }),
        ],
        0.1,
      );

    assert.equal(
      evaluation.summary
        .matchedLevelsCount,
      0,
    );
  },
);

test(
  'uses one-to-one matching for nearby levels',
  () => {
    const evaluation =
      evaluateManual([
        comparable({
          id:
            'v2-nearest',
          referencePrice:
            100,
        }),
        comparable({
          id:
            'v2-second',
          referencePrice:
            100.02,
        }),
      ]);

    const matchedIds =
      new Set(
        evaluation.matches.map(
          (match) =>
            match.v2LevelId,
        ),
      );

    assert.equal(
      matchedIds.size,
      evaluation.matches.length,
    );
  },
);

test(
  'aggregates lifecycle and setup eligibility counts',
  () => {
    const evaluation =
      evaluateManual([
        comparable({
          id:
            'active',
          status:
            'active',
          eligibleForSetups:
            true,
        }),
        comparable({
          id:
            'broken',
          referencePrice:
            103,
          zoneLow:
            102.8,
          zoneHigh:
            103.2,
          status:
            'broken',
          eligibleForSetups:
            false,
        }),
      ]);

    assert.equal(
      evaluation.summary
        .lifecycleStatuses.active,
      1,
    );

    assert.equal(
      evaluation.summary
        .lifecycleStatuses.broken,
      1,
    );

    assert.equal(
      evaluation.summary
        .setupEligibleV2LevelsCount,
      1,
    );
  },
);

test(
  'returns a defensive evaluation clone',
  () => {
    const evaluation =
      evaluateManual([
        comparable(),
      ]);

    const cloned =
      cloneLevelV2ShadowEvaluation(
        evaluation,
      );

    if (
      cloned.matches[0]
    ) {
      cloned.matches[0]
        .v2Score = 1;
    }

    assert.notEqual(
      evaluation.matches[0]
        ?.v2Score,
      1,
    );
  },
);

test(
  'rejects invalid comparison options',
  () => {
    assert.throws(
      () =>
        evaluateManual(
          [
            comparable(),
          ],
          -1,
        ),
      /maxMatchDistancePct/u,
    );
  },
);

test(
  'rejects duplicate comparable level ids',
  () => {
    assert.throws(
      () =>
        evaluateManual([
          comparable({
            id:
              'duplicate',
          }),
          comparable({
            id:
              'duplicate',
            referencePrice:
              101,
            zoneLow:
              100.8,
            zoneHigh:
              101.2,
          }),
        ]),
      /unique/u,
    );
  },
);

test(
  'shadow runtime stores a v1-v2 evaluation for retained candles',
  () => {
    const snapshot =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .cleanResistance,
      );

    assert.equal(
      snapshot.evaluation
        .summary.v2LevelsCount,
      snapshot.levels.length,
    );

    assert.ok(
      snapshot.evaluation
        .summary.v1LevelsCount
        >= 1,
    );
  },
);

test(
  'regression corpus detects clean resistance and support boundaries',
  () => {
    const resistance =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .cleanResistance,
      );

    const support =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .cleanSupport,
      );

    assert.ok(
      resistance.levels.some(
        (level) =>
          level.currentKind
            === 'resistance',
      ),
    );

    assert.ok(
      support.levels.some(
        (level) =>
          level.currentKind
            === 'support',
      ),
    );
  },
);

test(
  'regression corpus ignores an unfinished tail candle',
  () => {
    const base =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .cleanResistance,
      );

    const openTail =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .openCandleTail,
      );

    assert.deepEqual(
      openTail.evaluation,
      base.evaluation,
    );
  },
);

test(
  'regression corpus does not confirm a break from one wick excursion',
  () => {
    const snapshot =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .wickFalseBreak,
      );

    assert.equal(
      snapshot.levels.some(
        (level) =>
          level.status
            === 'broken',
      ),
      false,
    );
  },
);

test(
  'regression corpus confirms a break after consecutive acceptance closes',
  () => {
    const snapshot =
      runFixture(
        LEVEL_V2_SHADOW_REGRESSION_FIXTURES
          .confirmedBreak,
      );

    assert.ok(
      snapshot.lifecycleEvents.some(
        (event) =>
          event.type
            === 'broken',
      ),
    );
  },
);
