import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mapCandleChartData,
  toUtcTimestamp,
} from '../node_modules/.tmp/realtime-test/charts/model/candleMapping.js';

function createCandle(
  openTime,
  open,
  close,
  volume,
) {
  return {
    openTime,
    closeTime:
      new Date(
        Date.parse(openTime)
        + 299_999,
      ).toISOString(),
    open,
    high:
      Math.max(open, close) + 1,
    low:
      Math.min(open, close) - 1,
    close,
    volume,
    tradesCount:
      100,
  };
}

test(
  'maps candles and volume in chronological order',
  () => {
    const result =
      mapCandleChartData(
        [
          createCandle(
            '2026-07-25T12:05:00.000Z',
            190,
            188,
            200,
          ),
          createCandle(
            '2026-07-25T12:00:00.000Z',
            188,
            189,
            150,
          ),
        ],
        {
          up:
            'up-color',
          down:
            'down-color',
        },
      );

    assert.deepEqual(
      result.candles.map(
        (candle) => candle.close,
      ),
      [
        189,
        188,
      ],
    );

    assert.deepEqual(
      result.volume.map(
        (item) => item.color,
      ),
      [
        'up-color',
        'down-color',
      ],
    );

    assert.deepEqual(
      result.volume.map(
        (item) => item.value,
      ),
      [
        150,
        200,
      ],
    );
  },
);

test(
  'keeps the latest duplicate candle',
  () => {
    const openTime =
      '2026-07-25T12:00:00.000Z';

    const result =
      mapCandleChartData(
        [
          createCandle(
            openTime,
            188,
            189,
            100,
          ),
          createCandle(
            openTime,
            188,
            190,
            250,
          ),
        ],
        {
          up:
            'up-color',
          down:
            'down-color',
        },
      );

    assert.equal(
      result.candles.length,
      1,
    );

    assert.equal(
      result.candles[0]?.close,
      190,
    );

    assert.equal(
      result.volume[0]?.value,
      250,
    );
  },
);

test(
  'converts milliseconds to UTC seconds',
  () => {
    assert.equal(
      toUtcTimestamp(
        '2026-07-25T12:00:00.000Z',
      ),
      1_784_980_800,
    );
  },
);

test(
  'rejects an invalid candle timestamp',
  () => {
    assert.throws(
      () =>
        toUtcTimestamp(
          'invalid-time',
        ),
      /Invalid candle timestamp/,
    );
  },
);
