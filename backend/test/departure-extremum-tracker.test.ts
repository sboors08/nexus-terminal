import assert from 'node:assert/strict';
import test from 'node:test';

import {
  trackDepartureExtrema,
} from '../src/modules/level-engine/departure-extremum-tracker.js';
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
  readonly status: LevelLineStatus;
  readonly confirmedAt: string | null;
  readonly workedAt?: string | null;
}

function line(
  options: LineOptions,
): LevelLine {
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
      options.confirmedAt,
    touchCount:
      options.status === 'worked'
        ? 3
        : options.confirmedAt
          ? 2
          : 1,
    status:
      options.status,
    workedAt:
      options.workedAt
      ?? null,
    supersededAt: null,
    supersessionEvidence: null,
    brokenAt: null,
    breakEvidence: null,
  });
}

function track(
  sourceCandles:
    readonly LevelEngineCandle[],
  lines: readonly LevelLine[],
) {
  return trackDepartureExtrema({
    symbol:
      'btcusdt',
    timeframe:
      '5m',
    candles:
      sourceCandles,
    lines,
  });
}

test(
  'tracks a support departure with closed-candle highs and ignores open future data',
  () => {
    const sourceCandles =
      candles([
        [105, 150, 99, 105],
        [101, 106, 100, 105],
        [105, 112, 104, 110],
        [110, 112, 108, 111],
        [111, 130, 109, 125, false],
      ]);
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
        status: 'confirmed',
        confirmedAt:
          candleCloseTime(1),
      });
    const candidate =
      line({
        id: 'candidate-99',
        kind: 'support',
        price: 99,
        status: 'candidate',
        confirmedAt: null,
      });
    const result =
      track(
        sourceCandles,
        [support, candidate],
      );

    assert.equal(
      result.version,
      'departure-extremum-tracker-v0.1',
    );
    assert.equal(
      result.closedCandlesCount,
      4,
    );
    assert.equal(
      result.ignoredOpenCandlesCount,
      1,
    );
    assert.deepEqual(
      result.activeExtrema,
      [
        {
          lineId: 'support-100',
          symbol: 'BTCUSDT',
          timeframe: '5m',
          kind: 'support',
          levelPrice: 100,
          trackingStartedAt:
            candleCloseTime(1),
          qualifyingTouchCount: 2,
          price: 112,
          candleIndex: 2,
          candleOpenTime:
            candleOpenTime(2),
          observedAt:
            candleCloseTime(2),
        },
      ],
    );
    assert.equal(
      'progress'
      in result.activeExtrema[0]!,
      false,
    );
    assert.equal(
      result.computesObservationProgress,
      false,
    );
    assert.equal(
      result.createsSignal,
      false,
    );
  },
);

test(
  'resets a worked resistance departure after the latest qualifying touch',
  () => {
    const sourceCandles =
      candles([
        [100, 102, 80, 90],
        [90, 100, 85, 95],
        [95, 101, 94, 100],
        [100, 101, 92, 94],
        [94, 96, 88, 90],
      ]);
    const resistance =
      line({
        id: 'resistance-100',
        kind: 'resistance',
        price: 100,
        status: 'worked',
        confirmedAt:
          candleCloseTime(0),
        workedAt:
          candleCloseTime(2),
      });
    const result =
      track(
        sourceCandles,
        [resistance],
      );
    const extremum =
      result.activeExtrema[0];

    assert.ok(extremum);
    assert.equal(
      extremum.trackingStartedAt,
      candleCloseTime(2),
    );
    assert.equal(
      extremum.qualifyingTouchCount,
      3,
    );
    assert.equal(
      extremum.price,
      88,
    );
    assert.equal(
      extremum.candleIndex,
      4,
    );
  },
);

test(
  'keeps nearby lines independent instead of merging their departure state',
  () => {
    const sourceCandles =
      candles([
        [102, 103, 99, 101],
        [101, 105, 100, 104],
        [104, 110, 103, 109],
      ]);
    const result =
      track(
        sourceCandles,
        [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
            status: 'confirmed',
            confirmedAt:
              candleCloseTime(1),
          }),
          line({
            id: 'support-101',
            kind: 'support',
            price: 101,
            status: 'confirmed',
            confirmedAt:
              candleCloseTime(1),
          }),
        ],
      );

    assert.deepEqual(
      result.activeExtrema.map(
        (extremum) => [
          extremum.lineId,
          extremum.levelPrice,
          extremum.price,
        ],
      ),
      [
        ['support-100', 100, 110],
        ['support-101', 101, 110],
      ],
    );
  },
);

test(
  'ends tracking when a line is broken or superseded',
  () => {
    const sourceCandles =
      candles([
        [100, 102, 98, 101],
        [101, 108, 100, 107],
      ]);
    const result =
      track(
        sourceCandles,
        [
          line({
            id: 'confirmed',
            kind: 'support',
            price: 100,
            status: 'confirmed',
            confirmedAt:
              candleCloseTime(0),
          }),
          line({
            id: 'broken',
            kind: 'support',
            price: 99,
            status: 'broken',
            confirmedAt:
              candleCloseTime(0),
          }),
          line({
            id: 'superseded',
            kind: 'support',
            price: 98,
            status: 'superseded',
            confirmedAt:
              candleCloseTime(0),
          }),
        ],
      );

    assert.deepEqual(
      result.activeExtrema.map(
        (extremum) =>
          extremum.lineId,
      ),
      ['confirmed'],
    );
  },
);

test(
  'produces causal immutable snapshots when later closed candles extend E',
  () => {
    const allCandles =
      candles([
        [100, 102, 99, 101],
        [101, 106, 100, 105],
        [105, 108, 104, 107],
        [107, 115, 106, 114],
      ]);
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
        status: 'confirmed',
        confirmedAt:
          candleCloseTime(1),
      });
    const prefix =
      track(
        allCandles.slice(0, 3),
        [support],
      );
    const extended =
      track(
        allCandles,
        [support],
      );

    assert.equal(
      prefix.activeExtrema[0]
        ?.price,
      108,
    );
    assert.equal(
      extended.activeExtrema[0]
        ?.price,
      115,
    );
    assert.equal(
      prefix.activeExtrema[0]
        ?.price,
      108,
    );
    assert.equal(
      Object.isFrozen(prefix),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.activeExtrema,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.activeExtrema[0],
      ),
      true,
    );
    assert.equal(
      prefix.usesFutureCandles,
      false,
    );
  },
);
