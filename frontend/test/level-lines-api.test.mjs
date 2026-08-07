import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLevelLinesUrl,
  fetchLevelLines,
  LEVEL_LINES_PATH,
  parseLevelLinesSnapshot,
} from '../node_modules/.tmp/realtime-test/api/runtime/levelLinesApi.js';

function candle(
  index,
) {
  return {
    openTime:
      `2026-08-07T12:0${index}:00.000Z`,
    closeTime:
      `2026-08-07T12:0${index}:59.999Z`,
    open:
      100 + index,
    high:
      102 + index,
    low:
      99 + index,
    close:
      101 + index,
    volume:
      1_000 + index,
    tradesCount:
      100 + index,
    isClosed:
      true,
  };
}

function candidateLine() {
  return {
    id:
      'BTCUSDT-5m-line-resistance-1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    price:
      102,
    kind:
      'resistance',
    originCandleIndex:
      0,
    originExtremumAt:
      '2026-08-07T12:00:00.000Z',
    originExtremumPrice:
      102,
    activeFrom:
      '2026-08-07T12:01:59.999Z',
    touchCount:
      1,
    status:
      'candidate',
    workedAt:
      null,
    brokenAt:
      null,
    breakEvidence:
      null,
  };
}

function snapshot() {
  const line =
    candidateLine();

  return {
    version:
      'level-lines-v0.1',
    symbol:
      'BTCUSDT',
    timeframe:
      '5m',
    generatedAt:
      '2026-08-07T12:02:00.000Z',
    closedCandlesCount:
      2,
    ignoredOpenCandlesCount:
      0,
    candles: [
      candle(0),
      candle(1),
    ],
    lines: [
      line,
    ],
    activeLevels: [
      line,
    ],
    appliedOptions: {
      atrPeriod:
        14,
      pivotLeftBars:
        2,
      pivotRightBars:
        1,
      originDepartureAtr:
        0.8,
      originDepartureMaxCandles:
        8,
      originEpisodeMaxSpanCandles:
        6,
      workedEpisodeMaxSpanCandles:
        24,
      touchTolerancePercent:
        0.15,
      minBarsBetweenTouchEpisodes:
        0,
      decisiveBreakAtr:
        0.35,
      consecutiveBreakCloses:
        2,
    },
    observationalOnly:
      true,
    createsSetup:
      false,
    mergesNearbyExtrema:
      false,
    usesFutureCandles:
      false,
  };
}

test(
  'builds the canonical Level Lines URL',
  () => {
    assert.equal(
      buildLevelLinesUrl({
        baseUrl:
          'http://localhost:4100/',
        symbol:
          ' btcusdt ',
        timeframe:
          '5m',
        limit:
          500,
      }),
      'http://localhost:4100'
      + LEVEL_LINES_PATH
      + '?symbol=BTCUSDT'
      + '&timeframe=5m'
      + '&limit=500',
    );

    assert.throws(
      () =>
        buildLevelLinesUrl({
          symbol:
            'BTCUSDT',
          timeframe:
            '5m',
          limit:
            10,
        }),
      /between 50 and 1000/,
    );
  },
);

test(
  'fetches and validates an origin-based Level Lines snapshot',
  async () => {
    let requestedUrl = '';

    const result =
      await fetchLevelLines({
        symbol:
          'BTCUSDT',
        timeframe:
          '5m',
        limit:
          500,
        fetcher:
          async (
            input,
            init,
          ) => {
            requestedUrl =
              String(input);

            assert.equal(
              init?.method,
              'GET',
            );
            assert.equal(
              new Headers(
                init?.headers,
              ).get('accept'),
              'application/json',
            );

            return new Response(
              JSON.stringify(
                snapshot(),
              ),
              {
                status: 200,
              },
            );
          },
      });

    assert.equal(
      requestedUrl,
      LEVEL_LINES_PATH
      + '?symbol=BTCUSDT'
      + '&timeframe=5m'
      + '&limit=500',
    );
    assert.equal(
      result.lines.length,
      1,
    );
    assert.equal(
      result.lines[0]
        ?.originExtremumAt,
      '2026-08-07T12:00:00.000Z',
    );
    assert.equal(
      result.lines[0]
        ?.price,
      result.lines[0]
        ?.originExtremumPrice,
    );
    assert.equal(
      result.activeLevels[0]
        ?.status,
      'candidate',
    );
    assert.equal(
      result.mergesNearbyExtrema,
      false,
    );
  },
);

test(
  'rejects a worked line left in Active Levels',
  () => {
    const invalid =
      snapshot();
    const worked = {
      ...candidateLine(),
      touchCount:
        2,
      status:
        'worked',
      workedAt:
        '2026-08-07T12:02:59.999Z',
    };

    invalid.lines = [
      worked,
    ];
    invalid.activeLevels = [
      worked,
    ];

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          invalid,
        ),
      /active registry/,
    );
  },
);

test(
  'rejects a broken line left in Active Levels',
  () => {
    const invalid =
      snapshot();
    const broken = {
      ...candidateLine(),
      status:
        'broken',
      brokenAt:
        '2026-08-07T12:01:59.999Z',
      breakEvidence: {
        mode:
          'consecutive_closes',
        fromKind:
          'resistance',
        candleIndex:
          1,
        brokenAt:
          '2026-08-07T12:01:59.999Z',
        boundary:
          102,
        close:
          103,
        distanceBeyondBoundary:
          1,
        distanceBeyondBoundaryAtr:
          0.5,
      },
    };

    invalid.lines = [
      broken,
    ];
    invalid.activeLevels = [
      broken,
    ];

    assert.throws(
      () =>
        parseLevelLinesSnapshot(
          invalid,
        ),
      /active registry/,
    );
  },
);
