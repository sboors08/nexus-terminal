import assert from 'node:assert/strict';
import test from 'node:test';

import {
  trackDepartureExtrema,
} from '../src/modules/level-engine/departure-extremum-tracker.js';
import {
  trackObservationProgress,
} from '../src/modules/level-engine/observation-tracker.js';
import type {
  ObservationTrackingOptions,
} from '../src/modules/level-engine/observation-tracker.types.js';
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
  readonly confirmedAt?: string | null;
  readonly workedAt?: string | null;
}

function line(
  options: LineOptions,
): LevelLine {
  const status =
    options.status
    ?? 'confirmed';
  const confirmedAt =
    options.confirmedAt
    ?? candleCloseTime(0);

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
    confirmedAt,
    touchCount:
      status === 'worked'
        ? 3
        : confirmedAt
          ? 2
          : 1,
    status,
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
  options?: ObservationTrackingOptions,
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

  return trackObservationProgress(
    {
      symbol:
        'btcusdt',
      timeframe:
        '5m',
      candles:
        sourceCandles,
      departureExtremumTracking,
    },
    options,
  );
}

test(
  'enters OBSERVATION at the inclusive 50 percent support threshold using the latest closed close as P',
  () => {
    const sourceCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 109, 110],
      ]);
    const result =
      track(
        sourceCandles,
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
      'observation-tracker-v0.1',
    );
    assert.equal(
      result.currentPrice,
      110,
    );
    assert.equal(
      result.observedAt,
      candleCloseTime(2),
    );
    assert.deepEqual(
      result.activeProgress,
      [
        {
          lineId: 'support-100',
          symbol: 'BTCUSDT',
          timeframe: '5m',
          kind: 'support',
          levelPrice: 100,
          departureExtremumPrice: 120,
          departureExtremumObservedAt:
            candleCloseTime(1),
          currentPrice: 110,
          currentCandleIndex: 2,
          currentCandleOpenTime:
            candleOpenTime(2),
          observedAt:
            candleCloseTime(2),
          episodeStartedAt:
            candleCloseTime(2),
          progress: 0.5,
          observationPathProgressThreshold:
            0.5,
          stage: 'OBSERVATION',
        },
      ],
    );
    assert.equal(
      result.computesObservationProgress,
      true,
    );
    assert.equal(
      result.createsApproachEvaluation,
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
  'keeps resistance below OBSERVATION when progress is below the threshold',
  () => {
    const result =
      track(
        candles([
          [99, 100, 95, 96],
          [96, 97, 80, 82],
          [86, 90, 85, 89],
        ]),
        [
          line({
            id: 'resistance-100',
            kind: 'resistance',
            price: 100,
          }),
        ],
      );
    const progress =
      result.activeProgress[0];

    assert.ok(progress);
    assert.equal(
      progress.departureExtremumPrice,
      80,
    );
    assert.equal(
      progress.currentPrice,
      89,
    );
    assert.equal(
      progress.progress,
      0.45,
    );
    assert.equal(
      progress.stage,
      null,
    );
  },
);

test(
  'keeps nearby lines independent with their own L E and progress',
  () => {
    const result =
      track(
        candles([
          [111, 115, 89, 112],
          [112, 130, 111, 128],
          [128, 129, 114, 115],
        ]),
        [
          line({
            id: 'support-90',
            kind: 'support',
            price: 90,
          }),
          line({
            id: 'support-110',
            kind: 'support',
            price: 110,
          }),
        ],
      );

    assert.deepEqual(
      result.activeProgress.map(
        (value) => ({
          lineId:
            value.lineId,
          levelPrice:
            value.levelPrice,
          extremum:
            value.departureExtremumPrice,
          progress:
            value.progress,
          stage:
            value.stage,
        }),
      ),
      [
        {
          lineId: 'support-90',
          levelPrice: 90,
          extremum: 130,
          progress: 0.375,
          stage: null,
        },
        {
          lineId: 'support-110',
          levelPrice: 110,
          extremum: 130,
          progress: 0.75,
          stage: 'OBSERVATION',
        },
      ],
    );
  },
);

test(
  'ignores an open trailing candle and preserves causal immutable prefix output',
  () => {
    const allCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 109, 110],
        [110, 140, 99, 101, false],
      ]);
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
      });
    const prefix =
      track(
        allCandles.slice(0, 3),
        [support],
      );
    const withOpenCandle =
      track(
        allCandles,
        [support],
      );

    assert.equal(
      withOpenCandle
        .ignoredOpenCandlesCount,
      1,
    );
    assert.equal(
      withOpenCandle.currentPrice,
      110,
    );
    assert.equal(
      withOpenCandle
        .currentCandleIndex,
      2,
    );
    assert.deepEqual(
      withOpenCandle.activeProgress,
      prefix.activeProgress,
    );
    assert.equal(
      Object.isFrozen(prefix),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.activeProgress,
      ),
      true,
    );
    assert.equal(
      Object.isFrozen(
        prefix.activeProgress[0],
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
  'keeps the canonical formula unbounded after P crosses L',
  () => {
    const result =
      track(
        candles([
          [101, 105, 100, 104],
          [104, 120, 103, 118],
          [118, 119, 94, 95],
        ]),
        [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      );
    const progress =
      result.activeProgress[0];

    assert.ok(progress);
    assert.equal(
      progress.progress,
      1.25,
    );
    assert.equal(
      progress.stage,
      'OBSERVATION',
    );
  },
);

test(
  'derives a deterministic episode boundary after observation exits and re-enters',
  () => {
    const support =
      line({
        id: 'support-100',
        kind: 'support',
        price: 100,
      });
    const sourceCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 109, 110],
        [115, 118, 112, 115],
        [115, 116, 107, 108],
      ]);

    const firstEpisode =
      track(
        sourceCandles.slice(0, 3),
        [support],
      ).activeProgress[0];
    const outsideObservation =
      track(
        sourceCandles.slice(0, 4),
        [support],
      ).activeProgress[0];
    const secondEpisode =
      track(
        sourceCandles,
        [support],
      ).activeProgress[0];
    const replayedSecondEpisode =
      track(
        sourceCandles,
        [support],
      ).activeProgress[0];

    assert.ok(firstEpisode);
    assert.ok(outsideObservation);
    assert.ok(secondEpisode);
    assert.ok(replayedSecondEpisode);

    assert.equal(
      firstEpisode.episodeStartedAt,
      candleCloseTime(2),
    );
    assert.equal(
      outsideObservation.stage,
      null,
    );
    assert.equal(
      outsideObservation
        .episodeStartedAt,
      null,
    );
    assert.equal(
      secondEpisode.stage,
      'OBSERVATION',
    );
    assert.equal(
      secondEpisode.episodeStartedAt,
      candleCloseTime(4),
    );
    assert.notEqual(
      secondEpisode.episodeStartedAt,
      firstEpisode.episodeStartedAt,
    );
    assert.equal(
      replayedSecondEpisode
        .episodeStartedAt,
      secondEpisode.episodeStartedAt,
    );
  },
);

test(
  'rejects an invalid zero-length path and an out-of-range threshold',
  () => {
    const sourceCandles =
      candles([
        [101, 105, 100, 104],
        [104, 120, 103, 118],
        [118, 119, 109, 110],
      ]);
    const departure =
      trackDepartureExtrema({
        symbol: 'BTCUSDT',
        timeframe: '5m',
        candles:
          sourceCandles,
        lines: [
          line({
            id: 'support-100',
            kind: 'support',
            price: 100,
          }),
        ],
      });
    const extremum =
      departure.activeExtrema[0];

    assert.ok(extremum);

    assert.throws(
      () =>
        trackObservationProgress({
          symbol: 'BTCUSDT',
          timeframe: '5m',
          candles:
            sourceCandles,
          departureExtremumTracking:
            Object.freeze({
              ...departure,
              activeExtrema:
                Object.freeze([
                  Object.freeze({
                    ...extremum,
                    price:
                      extremum.levelPrice,
                  }),
                ]),
            }),
        }),
      /must be strictly away from its level/,
    );
    assert.throws(
      () =>
        track(
          sourceCandles,
          [
            line({
              id: 'support-100',
              kind: 'support',
              price: 100,
            }),
          ],
          {
            observationPathProgressThreshold:
              1.01,
          },
        ),
      /cannot exceed 1/,
    );
  },
);
