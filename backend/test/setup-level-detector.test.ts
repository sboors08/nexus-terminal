import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectSetupLevels,
} from '../src/modules/setup-engine/setup-level-detector.js';
import type {
  SetupLevelDetectorCandle,
  SetupLevelDetectorOptions,
} from '../src/modules/setup-engine/setup-level-detector.types.js';

const START_TIME_MS =
  Date.parse(
    '2026-07-26T00:00:00.000Z',
  );

const options:
  SetupLevelDetectorOptions = {
    pivotWindow: 1,
    minTouches: 2,
    minTouchSpacingCandles: 2,
    maxDistancePct: 0.25,
    zonePaddingPct: 0.05,
  };

function buildCandle(
  index: number,
  values: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    isClosed?: boolean;
  } = {},
): SetupLevelDetectorCandle {
  const openTime =
    START_TIME_MS
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
      values.open ?? 96,
    high:
      values.high ?? 98,
    low:
      values.low ?? 94,
    close:
      values.close ?? 96,
    isClosed:
      values.isClosed ?? true,
  };
}

test(
  'detects a confirmed resistance level',
  () => {
    const candles = [
      buildCandle(0, {
        high: 98,
      }),
      buildCandle(1, {
        high: 100,
      }),
      buildCandle(2, {
        high: 98,
      }),
      buildCandle(3, {
        high: 97,
      }),
      buildCandle(4, {
        high: 100.1,
      }),
      buildCandle(5, {
        high: 98.5,
      }),
      buildCandle(6, {
        high: 97.5,
      }),
    ];

    const levels =
      detectSetupLevels(
        'solusdt',
        '5m',
        candles,
        options,
      );

    const resistance =
      levels.find(
        (level) =>
          level.kind
          === 'resistance',
      );

    assert.ok(resistance);

    assert.equal(
      resistance.symbol,
      'SOLUSDT',
    );

    assert.equal(
      resistance.touchesCount,
      2,
    );

    assert.equal(
      resistance.centerPrice,
      100.05,
    );

    assert.equal(
      resistance.formedAt,
      candles[4]?.closeTime,
    );

    assert.equal(
      resistance.formationDurationSec,
      180,
    );
  },
);

test(
  'detects a confirmed support level',
  () => {
    const candles = [
      buildCandle(0, {
        low: 92,
      }),
      buildCandle(1, {
        low: 90,
      }),
      buildCandle(2, {
        low: 92,
      }),
      buildCandle(3, {
        low: 93,
      }),
      buildCandle(4, {
        low: 89.9,
      }),
      buildCandle(5, {
        low: 92,
      }),
      buildCandle(6, {
        low: 93,
      }),
    ];

    const levels =
      detectSetupLevels(
        'ETHUSDT',
        '15m',
        candles,
        options,
      );

    const support =
      levels.find(
        (level) =>
          level.kind
          === 'support',
      );

    assert.ok(support);

    assert.equal(
      support.touchesCount,
      2,
    );

    assert.equal(
      support.centerPrice,
      89.95,
    );

    assert.ok(
      support.zoneLow
      < support.centerPrice,
    );

    assert.ok(
      support.zoneHigh
      > support.centerPrice,
    );
  },
);

test(
  'does not count adjacent candles as separate touches',
  () => {
    const candles = [
      buildCandle(0, {
        high: 98,
      }),
      buildCandle(1, {
        high: 100,
      }),
      buildCandle(2, {
        high: 100,
      }),
      buildCandle(3, {
        high: 98,
      }),
      buildCandle(4, {
        high: 97,
      }),
    ];

    const levels =
      detectSetupLevels(
        'BNBUSDT',
        '5m',
        candles,
        options,
      );

    assert.equal(
      levels.filter(
        (level) =>
          level.kind
          === 'resistance',
      ).length,
      0,
    );
  },
);

test(
  'ignores an unfinished candle touch',
  () => {
    const candles = [
      buildCandle(0, {
        high: 98,
      }),
      buildCandle(1, {
        high: 100,
      }),
      buildCandle(2, {
        high: 98,
      }),
      buildCandle(3, {
        high: 97,
      }),
      buildCandle(4, {
        high: 100.1,
        isClosed: false,
      }),
      buildCandle(5, {
        high: 98,
      }),
      buildCandle(6, {
        high: 97,
      }),
    ];

    const levels =
      detectSetupLevels(
        'XRPUSDT',
        '5m',
        candles,
        options,
      );

    assert.equal(
      levels.filter(
        (level) =>
          level.kind
          === 'resistance',
      ).length,
      0,
    );
  },
);

test(
  'returns no level when history is insufficient',
  () => {
    const levels =
      detectSetupLevels(
        'ADAUSDT',
        '5m',
        [
          buildCandle(0),
          buildCandle(1),
        ],
        options,
      );

    assert.deepEqual(
      levels,
      [],
    );
  },
);

test(
  'rejects invalid candle values',
  () => {
    assert.throws(
      () =>
        detectSetupLevels(
          'DOGEUSDT',
          '5m',
          [
            buildCandle(0),
            buildCandle(1, {
              high: 90,
              low: 95,
            }),
            buildCandle(2),
          ],
          options,
        ),
      /Invalid Setup Level Detector OHLC/,
    );
  },
);

test(
  'rejects invalid detector options',
  () => {
    assert.throws(
      () =>
        detectSetupLevels(
          'LINKUSDT',
          '5m',
          [],
          {
            ...options,
            maxDistancePct: 0,
          },
        ),
      /maximum distance must be positive/,
    );
  },
);
