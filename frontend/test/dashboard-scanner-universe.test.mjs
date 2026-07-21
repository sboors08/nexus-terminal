import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardScannerUniverseRows,
} from '../node_modules/.tmp/realtime-test/realtime/dashboardScannerUniverse.js';

const fallbackRows = [
  [
    'SOL/USDT',
    '96',
    '+2.81%',
    '$4.21M',
    '8 420',
    '1 684/мин',
    '0.42',
    '+4.82%',
    'Высокая',
    8,
  ],
];

test(
  'keeps fallback Scanner rows while the universe is loading',
  () => {
    const result =
      buildDashboardScannerUniverseRows(
        fallbackRows,
        [],
      );

    assert.equal(
      result.length,
      1,
    );

    assert.equal(
      result[0]?.source,
      'fallback',
    );

    assert.equal(
      result[0]?.row[0],
      'SOL/USDT',
    );
  },
);

test(
  'adds every Binance universe entry to the Scanner',
  () => {
    const result =
      buildDashboardScannerUniverseRows(
        fallbackRows,
        [
          {
            symbol: 'BTCUSDT',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            status: 'active',
            firstSeenAt:
              '2026-07-21T19:00:00.000Z',
            lastSeenAt:
              '2026-07-21T19:01:00.000Z',
          },
          {
            symbol: 'NEWUSDT',
            baseAsset: 'NEW',
            quoteAsset: 'USDT',
            status: 'collecting',
            firstSeenAt:
              '2026-07-21T19:01:00.000Z',
            lastSeenAt:
              '2026-07-21T19:01:00.000Z',
          },
          {
            symbol: 'SOLUSDT',
            baseAsset: 'SOL',
            quoteAsset: 'USDT',
            status: 'active',
            firstSeenAt:
              '2026-07-21T19:00:00.000Z',
            lastSeenAt:
              '2026-07-21T19:01:00.000Z',
          },
        ],
      );

    assert.deepEqual(
      result.map(
        (item) => item.row[0],
      ),
      [
        'BTC/USDT',
        'NEW/USDT',
        'SOL/USDT',
      ],
    );

    assert.equal(
      result[0]?.source,
      'registry',
    );

    assert.equal(
      result[1]?.source,
      'collecting',
    );

    assert.equal(
      result[2]?.source,
      'fallback',
    );

    assert.equal(
      result[0]?.row[2],
      'нет данных',
    );

    assert.equal(
      result[2]?.row[1],
      '96',
    );
  },
);

test(
  'does not duplicate universe symbols',
  () => {
    const entry = {
      symbol: 'BTCUSDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      status: 'active',
      firstSeenAt:
        '2026-07-21T19:00:00.000Z',
      lastSeenAt:
        '2026-07-21T19:01:00.000Z',
    };

    const result =
      buildDashboardScannerUniverseRows(
        [],
        [
          entry,
          entry,
        ],
      );

    assert.equal(
      result.length,
      1,
    );
  },
);