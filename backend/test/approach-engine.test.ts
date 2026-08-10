import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateApproaches,
} from '../src/modules/level-engine/approach-engine.js';
import type {
  ApproachEvaluationOptions,
} from '../src/modules/level-engine/approach-engine.types.js';
import {
  trackDepartureExtrema,
} from '../src/modules/level-engine/departure-extremum-tracker.js';
import {
  trackObservationProgress,
} from '../src/modules/level-engine/observation-tracker.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';
import type {
  LevelLine,
  LevelLineStatus,
} from '../src/modules/level-engine/level-lines.types.js';

type CandleTuple = readonly [
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed?: boolean,
];

const START =
  Date.parse(
    '2026-01-01T00:00:00.000Z',
  );

function candleOpenTime(
  index: number,
): string {
  return new Date(
    START + index * 60_000,
  ).toISOString();
}

function candleCloseTime(
  index: number,
): string {
  return new Date(
    START
    + (index + 1) * 60_000
    - 1,
  ).toISOString();
}

function candles(
  values: readonly CandleTuple[],
): readonly LevelEngineCandle[] {
  return values.map(
    (
      value,
      index,
    ) => ({
      openTime:
        candleOpenTime(index),
      closeTime:
        candleCloseTime(index),
      open:
        value[0],
      high:
        value[1],
      low:
        value[2],
      close:
        value[3],
      isClosed:
        value[4]
        ?? true,
    }),
  );
}

interface LineOptions {
  readonly id: string;
  readonly kind:
    'support' | 'resistance';
  readonly price: number;
  readonly status?: LevelLineStatus;
}

function line(
  options: LineOptions,
): LevelLine {
  const status =
    options.status
    ?? 'confirmed';

  return Object.freeze({
    id:
      options.id,
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    price:
      options.price,
    kind:
      options.kind,
    originCandleIndex: 0,
    originExtremumAt:
      candleOpenTime(0),
    originExtremumPrice:
      options.price,
    activeFrom:
      candleCloseTime(0),
    confirmedAt:
      candleCloseTime(0),
    touchCount:
      status === 'worked'
        ? 3
        : 2,
    status,
    workedAt: null,
    supersededAt: null,
    supersessionEvidence: null,
    brokenAt: null,
    breakEvidence: null,
  });
}

function observation(
  sourceCandles:
    readonly LevelEngineCandle[],
  lines: readonly LevelLine[],
) {
  const departureExtremumTracking =
    trackDepartureExtrema({
      symbol:
        'btcusdt',
      timeframe:
        '5m',
      candles:
        sourceCandles,
      lines,
    });

  return trackObservationProgress({
    symbol:
      'btcusdt',
    timeframe:
      '5m',
    candles:
      sourceCandles,
    departureExtremumTracking,
  });
}

function evaluate(
  sourceCandles:
    readonly LevelEngineCandle[],
  lines: readonly LevelLine[],
  options?: ApproachEvaluationOptions,
) {
  return evaluateApproaches(
    {
      symbol:
        'btcusdt',
      timeframe:
        '5m',
      observationTracking:
        observation(
          sourceCandles,
          lines,
        ),
    },
    options,
  );
}

test(
  'enters APPROACH at the inclusive 0.50 percent support boundary',
  () => {
    const result =
      evaluate(
        candles([
          [101, 105, 100, 104],
          [104, 120, 103, 118],
          [118, 119, 100.5, 100.5],
        ]),
        [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      );

    assert.equal(
      result.version,
      'approach-engine-v0.1',
    );
    assert.deepEqual(
      result.evaluations,
      [
        {
          lineId: 'support-100',
          symbol: 'BTCUSDT',
          timeframe: '5m',
          kind: 'support',
          levelPrice: 100,
          currentPrice: 100.5,
          currentCandleIndex: 2,
          currentCandleOpenTime:
            candleOpenTime(2),
          observedAt:
            candleCloseTime(2),
          observationProgress: 0.975,
          observationStage:
            'OBSERVATION',
          distanceToLevelPercent: 0.5,
          maxDistanceToLevelPercent: 0.5,
          stage: 'APPROACH',
        },
      ],
    );
    assert.equal(
      result.evaluatesApproach,
      true,
    );
    assert.equal(
      result.createsRealtimeConfirmation,
      false,
    );
    assert.equal(
      result.createsSetup,
      false,
    );
    assert.equal(
      result.createsSignal,
      false,
    );
  },
);

test(
  'keeps a support outside APPROACH when the close is farther than 0.50 percent',
  () => {
    const result =
      evaluate(
        candles([
          [101, 105, 100, 104],
          [104, 120, 103, 118],
          [118, 119, 100.5001, 100.5001],
        ]),
        [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      );
    const value =
      result.evaluations[0];

    assert.ok(value);
    assert.ok(
      value.distanceToLevelPercent
      > 0.5,
    );
    assert.equal(
      value.stage,
      null,
    );
  },
);

test(
  'applies the same inclusive boundary to resistance',
  () => {
    const result =
      evaluate(
        candles([
          [99, 100, 95, 96],
          [96, 97, 80, 82],
          [82, 99.5, 81, 99.5],
        ]),
        [
          line({
            id: 'resistance-100',
            kind: 'resistance',
            price: 100,
          }),
        ],
      );
    const value =
      result.evaluations[0];

    assert.ok(value);
    assert.equal(
      value.observationStage,
      'OBSERVATION',
    );
    assert.equal(
      value.distanceToLevelPercent,
      0.5,
    );
    assert.equal(
      value.stage,
      'APPROACH',
    );
  },
);

test(
  'requires OBSERVATION before distance alone can enter APPROACH',
  () => {
    const result =
      evaluate(
        candles([
          [100.1, 100.4, 100, 100.3],
          [100.3, 100.5, 100.1, 100.4],
          [100.4, 100.49, 100.3, 100.49],
        ]),
        [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      );
    const value =
      result.evaluations[0];

    assert.ok(value);
    assert.ok(
      Math.abs(
        value.observationProgress
        - 0.02,
      ) < 1e-12,
    );
    assert.equal(
      value.observationStage,
      null,
    );
    assert.ok(
      value.distanceToLevelPercent
      < 0.5,
    );
    assert.equal(
      value.stage,
      null,
    );
  },
);

test(
  'keeps nearby lines independent with their own percentage distance',
  () => {
    const result =
      evaluate(
        candles([
          [111, 115, 89, 112],
          [112, 130, 111, 128],
          [128, 129, 100.4, 100.4],
        ]),
        [
          line({
            id: 'support-90',
            kind: 'support',
            price: 90,
          }),
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      );

    assert.deepEqual(
      result.evaluations.map(
        (value) => ({
          lineId:
            value.lineId,
          levelPrice:
            value.levelPrice,
          stage:
            value.stage,
        }),
      ),
      [
        {
          lineId: 'support-90',
          levelPrice: 90,
          stage: null,
        },
        {
          lineId: 'support-100',
          levelPrice: 100,
          stage: 'APPROACH',
        },
      ],
    );
  },
);

test(
  'ignores a trailing open candle and preserves immutable causal output',
  () => {
    const allCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 100.5, 100.5],
        [100.5, 140, 90, 90, false],
      ]);
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
      });
    const prefix =
      evaluate(
        allCandles.slice(0, 3),
        [support],
      );
    const withOpenCandle =
      evaluate(
        allCandles,
        [support],
      );

    assert.equal(
      withOpenCandle
        .ignoredOpenCandlesCount,
      1,
    );
    assert.deepEqual(
      withOpenCandle.evaluations,
      prefix.evaluations,
    );
    assert.equal(
      Object.isFrozen(prefix),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.evaluations,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.evaluations[0],
      ),
      true,
    );
    assert.equal(
      prefix.usesFutureCandles,
      false,
    );
  },
);

test(
  'uses absolute distance after the close crosses the level and rejects invalid options',
  () => {
    const sourceCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 99.6, 99.6],
      ]);
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
      });
    const result =
      evaluate(
        sourceCandles,
        [support],
      );
    const value =
      result.evaluations[0];

    assert.ok(value);
    assert.ok(
      value.observationProgress > 1,
    );
    assert.ok(
      Math.abs(
        value.distanceToLevelPercent
        - 0.4,
      ) < 1e-12,
    );
    assert.equal(
      value.stage,
      'APPROACH',
    );

    assert.throws(
      () =>
        evaluate(
          sourceCandles,
          [support],
          {
            maxDistanceToLevelPercent: 0,
          },
        ),
      /must be a positive finite number/,
    );
  },
);
