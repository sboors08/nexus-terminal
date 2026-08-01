import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNexusHorizontalSegmentData,
} from '../node_modules/.tmp/realtime-test/charts/model/horizontalSegment.js';

function makeCandle(
  openTime,
  closeTime,
  isClosed,
) {
  return {
    openTime,
    closeTime,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
    tradesCount: 5,
    ...(isClosed === undefined
      ? {}
      : { isClosed }),
  };
}

test(
  'starts on the first closed candle after the level becomes known',
  () => {
    const data =
      buildNexusHorizontalSegmentData(
        [
          makeCandle(
            '2026-01-01T00:00:00.000Z',
            '2026-01-01T00:00:59.999Z',
            true,
          ),
          makeCandle(
            '2026-01-01T00:01:00.000Z',
            '2026-01-01T00:01:59.999Z',
            true,
          ),
          makeCandle(
            '2026-01-01T00:02:00.000Z',
            '2026-01-01T00:02:59.999Z',
            true,
          ),
          makeCandle(
            '2026-01-01T00:03:00.000Z',
            '2026-01-01T00:03:59.999Z',
            true,
          ),
        ],
        '2026-01-01T00:01:59.999Z',
        100,
      );

    assert.deepEqual(
      data,
      [
        {
          time:
            Date.parse(
              '2026-01-01T00:02:00.000Z',
            ) / 1000,
          value:
            100,
        },
        {
          time:
            Date.parse(
              '2026-01-01T00:03:00.000Z',
            ) / 1000,
          value:
            100,
        },
      ],
    );
  },
);

test(
  'does not extend the line into an open realtime candle',
  () => {
    const data =
      buildNexusHorizontalSegmentData(
        [
          makeCandle(
            '2026-01-01T00:02:00.000Z',
            '2026-01-01T00:02:59.999Z',
            true,
          ),
          makeCandle(
            '2026-01-01T00:03:00.000Z',
            '2026-01-01T00:03:59.999Z',
            false,
          ),
        ],
        '2026-01-01T00:01:59.999Z',
        100,
      );

    assert.deepEqual(
      data,
      [
        {
          time:
            Date.parse(
              '2026-01-01T00:02:00.000Z',
            ) / 1000,
          value:
            100,
        },
      ],
    );
  },
);

test(
  'treats historical candles without isClosed as closed',
  () => {
    const data =
      buildNexusHorizontalSegmentData(
        [
          makeCandle(
            '2026-01-01T00:02:00.000Z',
            '2026-01-01T00:02:59.999Z',
          ),
          makeCandle(
            '2026-01-01T00:03:00.000Z',
            '2026-01-01T00:03:59.999Z',
          ),
        ],
        '2026-01-01T00:01:59.999Z',
        100,
      );

    assert.equal(
      data.length,
      2,
    );

    assert.equal(
      data[0]?.time,
      Date.parse(
        '2026-01-01T00:02:00.000Z',
      ) / 1000,
    );

    assert.equal(
      data[1]?.time,
      Date.parse(
        '2026-01-01T00:03:00.000Z',
      ) / 1000,
    );
  },
);

test(
  'does not draw before activeFrom or for invalid input',
  () => {
    assert.deepEqual(
      buildNexusHorizontalSegmentData(
        [
          makeCandle(
            '2026-01-01T00:00:00.000Z',
            '2026-01-01T00:00:59.999Z',
            true,
          ),
        ],
        '2026-01-01T00:01:00.000Z',
        100,
      ),
      [],
    );

    assert.deepEqual(
      buildNexusHorizontalSegmentData(
        [],
        'invalid',
        100,
      ),
      [],
    );

    assert.deepEqual(
      buildNexusHorizontalSegmentData(
        [],
        '2026-01-01T00:00:00.000Z',
        Number.NaN,
      ),
      [],
    );
  },
);
