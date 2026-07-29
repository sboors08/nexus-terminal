import assert from 'node:assert/strict';
import test from 'node:test';

import {
  registerLevelV2Lifecycle,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.js';
import {
  buildLevelV2ZonesScore,
  DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.js';
import type {
  LevelV2Candle,
  LevelV2Extremum,
  LevelV2FoundationResult,
  LevelV2TouchEvent,
} from '../src/modules/setup-engine/level-v2/level-v2.types.js';
import type {
  LevelV2DetectedZone,
  LevelV2ZonesScoreOptions,
} from '../src/modules/setup-engine/level-v2/level-v2-zones-score.types.js';

const BASE_TIME =
  Date.parse(
    '2026-07-29T12:00:00.000Z',
  );

function candle(
  index: number,
  close: number,
  high: number,
  low: number,
): LevelV2Candle {
  const openTime =
    BASE_TIME
    + index * 60_000;

  return {
    openTime:
      new Date(
        openTime,
      ).toISOString(),
    closeTime:
      new Date(
        openTime + 59_999,
      ).toISOString(),
    open:
      close,
    high,
    low,
    close,
    baseVolume:
      null,
    quoteVolume:
      null,
    tradesCount:
      null,
    isClosed:
      true,
  };
}

function candlesFor(
  kind:
    'swing_high'
    | 'swing_low',
): LevelV2Candle[] {
  return Array.from(
    {
      length:
        40,
    },
    (
      _,
      index,
    ) => {
      const close =
        95
        + (
          index % 4
        ) * 0.2;

      return kind === 'swing_high'
        ? candle(
            index,
            close,
            101,
            close - 0.5,
          )
        : candle(
            index,
            close,
            close + 0.5,
            89,
          );
    },
  );
}

function extremum(
  id: string,
  kind:
    'swing_high'
    | 'swing_low',
  candleIndex: number,
  extremePrice: number,
  qualityScore: number,
): LevelV2Extremum {
  const occurredAt =
    new Date(
      BASE_TIME
      + candleIndex * 60_000
      + 59_999,
    ).toISOString();

  return {
    id,
    kind,
    candleIndex,
    segmentStartIndex:
      candleIndex,
    segmentEndIndex:
      candleIndex,
    occurredAt,
    confirmedAt:
      new Date(
        BASE_TIME
        + (
          candleIndex + 1
        ) * 60_000
        + 59_999,
      ).toISOString(),
    extremePrice,
    atr:
      2,
    reactionDistance:
      4,
    reactionAtr:
      2,
    reactionDurationCandles:
      1,
    leftProminenceAtr:
      1,
    rightProminenceAtr:
      1,
    qualityScore,
  };
}

function touch(
  item:
    LevelV2Extremum,
): LevelV2TouchEvent {
  return {
    id:
      `touch-${item.id}`,
    kind:
      item.kind,
    extremumIds: [
      item.id,
    ],
    representativeExtremumId:
      item.id,
    firstCandleIndex:
      item.candleIndex,
    lastCandleIndex:
      item.candleIndex,
    occurredAt:
      item.occurredAt,
    extremePrice:
      item.extremePrice,
    qualityScore:
      item.qualityScore,
  };
}

function foundation(
  candles:
    readonly LevelV2Candle[],
  extrema:
    readonly LevelV2Extremum[],
): LevelV2FoundationResult {
  return {
    closedCandlesCount:
      candles.length,
    atr:
      candles.map(
        (
          _,
          candleIndex,
        ) => ({
          candleIndex,
          trueRange:
            2,
          atr:
            2,
        }),
      ),
    extrema,
    touchEvents:
      extrema.map(
        touch,
      ),
  };
}

const options:
LevelV2ZonesScoreOptions = {
  ...DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
  clusterToleranceAtr:
    1,
  maxClusterTolerancePct:
    1,
  maxClosesInsideRatio:
    1,
  maxCrossingsCount:
    100,
  minStructureEdgePosition:
    0.5,
  minLevelScore:
    0,
};

function detectOne(
  kind:
    'swing_high'
    | 'swing_low',
  prices:
    readonly number[],
  weights:
    readonly number[],
): LevelV2DetectedZone {
  const candles =
    candlesFor(
      kind,
    );

  const extrema =
    prices.map(
      (
        price,
        index,
      ) =>
        extremum(
          `${kind}-${index}`,
          kind,
          5 + index * 10,
          price,
          weights[index]
          ?? 1,
        ),
    );

  const result =
    buildLevelV2ZonesScore(
      'TESTUSDT',
      '1m',
      candles,
      foundation(
        candles,
        extrema,
      ),
      options,
    );

  const level =
    result.levels[0];

  assert.ok(
    level,
    'Expected one accepted Level v2 zone',
  );

  return level;
}

function assertLifecycleGeometry(
  level:
    LevelV2DetectedZone,
): void {
  const zone =
    level.zone;

  assert.ok(
    zone.outerLow
      <= zone.coreLow,
  );

  assert.ok(
    zone.coreLow
      <= zone.referencePrice,
  );

  assert.ok(
    zone.referencePrice
      <= zone.coreHigh,
  );

  assert.ok(
    zone.coreHigh
      <= zone.outerHigh,
  );

  assert.doesNotThrow(
    () =>
      registerLevelV2Lifecycle(
        level,
        level.lastTouchCandleIndex,
        level.lastTouchAt,
      ),
  );
}

test(
  'keeps a quality-weighted resistance reference inside the core zone',
  () => {
    const level =
      detectOne(
        'swing_high',
        [
          100,
          100.1,
          100.2,
        ],
        [
          5,
          5,
          100,
        ],
      );

    assert.equal(
      level.zone
        .referencePrice,
      100.2,
    );

    assertLifecycleGeometry(
      level,
    );

    assert.ok(
      level.zone
        .liquidityLow
      >= level.zone
        .outerHigh,
    );
  },
);

test(
  'keeps a quality-weighted support reference inside the core zone',
  () => {
    const level =
      detectOne(
        'swing_low',
        [
          90,
          89.9,
          89.8,
        ],
        [
          5,
          5,
          100,
        ],
      );

    assert.equal(
      level.zone
        .referencePrice,
      89.8,
    );

    assertLifecycleGeometry(
      level,
    );

    assert.ok(
      level.zone
        .liquidityHigh
      <= level.zone
        .outerLow,
    );
  },
);

test(
  'preserves valid lifecycle geometry when the weighted reference is central',
  () => {
    const resistance =
      detectOne(
        'swing_high',
        [
          100,
          100.1,
          100.2,
        ],
        [
          20,
          100,
          20,
        ],
      );

    const support =
      detectOne(
        'swing_low',
        [
          90,
          89.9,
          89.8,
        ],
        [
          20,
          100,
          20,
        ],
      );

    assertLifecycleGeometry(
      resistance,
    );

    assertLifecycleGeometry(
      support,
    );
  },
);
