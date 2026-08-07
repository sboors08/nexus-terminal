import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectLevelLines,
} from '../src/modules/level-engine/level-lines-detector.js';
import type {
  LevelLinesDetectionOptions,
} from '../src/modules/level-engine/level-lines.types.js';
import type {
  LevelEngineCandle,
} from '../src/modules/level-engine/level-engine-touch-detector.types.js';

type CandleTuple = readonly [
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed?: boolean,
];

const OPTIONS = Object.freeze({
  atrPeriod: 2,
  pivotLeftBars: 1,
  pivotRightBars: 1,
  originDepartureAtr: 0.6,
  originDepartureMaxCandles: 4,
  originEpisodeMaxSpanCandles: 3,
  workedEpisodeMaxSpanCandles: 8,
  touchTolerancePercent: 0.15,
  minBarsBetweenTouchEpisodes: 0,
  decisiveBreakAtr: 0.5,
  consecutiveBreakCloses: 2,
}) satisfies LevelLinesDetectionOptions;

function candles(
  values: readonly CandleTuple[],
): readonly LevelEngineCandle[] {
  const start =
    Date.parse(
      '2026-01-01T00:00:00.000Z',
    );

  return values.map(
    (
      value,
      index,
    ) => ({
      openTime:
        new Date(
          start + index * 60_000,
        ).toISOString(),
      closeTime:
        new Date(
          start
          + (index + 1) * 60_000
          - 1,
        ).toISOString(),
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

function detect(
  values: readonly CandleTuple[],
  timeframe:
    '1m' | '5m' = '5m',
) {
  return detectLevelLines(
    {
      symbol:
        'btcusdt',
      timeframe,
      candles:
        candles(values),
    },
    OPTIONS,
  );
}

test(
  'keeps nearby independent extrema as separate exact-price lines',
  () => {
    const result =
      detect([
        [105, 106, 104, 105],
        [104, 105, 100, 101],
        [103.2, 104, 103, 103.5],
        [103.5, 105, 102, 104],
        [102, 103, 99, 100],
        [101, 104, 100.5, 103],
        [103, 105, 102, 104],
      ]);
    const supports =
      result.lines.filter(
        (line) =>
          line.kind === 'support',
      );

    assert.deepEqual(
      supports.map(
        (line) =>
          line.price,
      ),
      [100, 99],
    );
    assert.equal(
      supports.every(
        (line) =>
          line.price
          === line.originExtremumPrice,
      ),
      true,
    );
    assert.equal(
      new Set(
        supports.map(
          (line) => line.id,
        ),
      ).size,
      2,
    );
    assert.equal(
      result.mergesNearbyExtrema,
      false,
    );
  },
);

test(
  'anchors the line at the origin candle but exposes it only after causal confirmation',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103.5, 105, 102, 104],
    ];
    const result =
      detect(values);
    const support =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(support);
    assert.equal(
      support.originCandleIndex,
      1,
    );
    assert.equal(
      support.originExtremumAt,
      candles(values)[1]?.openTime,
    );
    assert.equal(
      support.activeFrom,
      candles(values)[2]?.closeTime,
    );
    assert.ok(
      Date.parse(
        support.activeFrom,
      )
      > Date.parse(
          support.originExtremumAt,
        ),
    );
    assert.equal(
      support.touchCount,
      1,
    );
    assert.equal(
      support.status,
      'candidate',
    );
  },
);

test(
  'rejects a pivot that never produces the required causal departure',
  () => {
    const result =
      detect([
        [103, 104, 102, 103],
        [102, 103, 100, 101],
        [101, 101.4, 100.4, 101.1],
        [101.1, 101.3, 100.5, 101],
        [101, 101.2, 100.6, 101],
        [101, 101.3, 100.7, 101.1],
      ]);

    assert.equal(
      result.lines.some(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      ),
      false,
    );
  },
);

test(
  'ends a line after a later near-touch produces a confirmed reaction without widening the line',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [104, 105, 103, 104],
      [103, 104, 100.1, 101],
      [102, 105, 102, 104],
      [104, 106, 103, 105],
    ];
    const result =
      detect(values);
    const worked =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.originCandleIndex === 1,
      );

    assert.ok(worked);
    assert.equal(
      worked.status,
      'worked',
    );
    assert.equal(
      worked.price,
      100,
    );
    assert.equal(
      worked.touchCount,
      2,
    );
    assert.equal(
      worked.workedAt,
      candles(values)[5]?.closeTime,
    );
    assert.equal(
      worked.brokenAt,
      null,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === worked.id,
      ),
      false,
    );
  },
);

test(
  'ends a line at a confirmed break and removes it from Active Levels',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [101, 102, 98, 101],
      [101, 101.4, 99.5, 99.8],
      [99.8, 100.1, 99.2, 99.6],
      [99.6, 101, 99.4, 100.7],
    ];
    const result =
      detect(values);
    const support =
      result.lines.find(
        (line) =>
          line.kind === 'support'
          && line.price === 100,
      );

    assert.ok(support);
    assert.equal(
      support.status,
      'broken',
    );
    assert.equal(
      support.workedAt,
      null,
    );
    assert.equal(
      support.brokenAt,
      candles(values)[5]?.closeTime,
    );
    assert.equal(
      support.breakEvidence
        ?.candleIndex,
      5,
    );
    assert.equal(
      result.activeLevels.some(
        (line) =>
          line.id === support.id,
      ),
      false,
    );
  },
);

test(
  'ignores open candles and never confirms a final candle without right-side data',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103, 110, 99, 109, false],
    ];
    const result =
      detect(values);

    assert.equal(
      result.ignoredOpenCandlesCount,
      1,
    );
    assert.equal(
      result.lines.some(
        (line) =>
          line.originCandleIndex === 3,
      ),
      false,
    );
    assert.equal(
      result.usesFutureCandles,
      false,
    );
  },
);

test(
  'keeps timeframe identity independent and returns frozen registries',
  () => {
    const values:
    readonly CandleTuple[] = [
      [105, 106, 104, 105],
      [104, 105, 100, 101],
      [103.2, 104, 103, 103.5],
      [103.5, 105, 102, 104],
    ];
    const oneMinute =
      detect(values, '1m');
    const fiveMinutes =
      detect(values, '5m');

    assert.notEqual(
      oneMinute.lines[0]?.id,
      fiveMinutes.lines[0]?.id,
    );
    assert.equal(
      oneMinute.lines[0]
        ?.timeframe,
      '1m',
    );
    assert.equal(
      fiveMinutes.lines[0]
        ?.timeframe,
      '5m',
    );
    assert.equal(
      Object.isFrozen(oneMinute),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute.lines,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        oneMinute.activeLevels,
      ),
      true,
    );
  },
);
