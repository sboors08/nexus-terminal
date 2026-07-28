import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
  SCANNER_SETUP_TABLE_SORT_KEYS,
  applyScannerSetupLiveMetrics,
  buildScannerSetupMetricKey,
  indexScannerSetupMetrics,
  nextScannerSetupSortState,
  sortScannerSetupRows,
} from '../node_modules/.tmp/realtime-test/realtime/scannerSetupTable.js';

function createMetric(
  symbol,
  scannerWindow,
  overrides = {},
) {
  return {
    symbol,
    scannerWindow,
    windowMs:
      scannerWindow === '1m'
        ? 60_000
        : scannerWindow === '5m'
          ? 300_000
          : 900_000,
    price: 100,
    priceChangePct: 1,
    btcCorrelation: 0.8,
    relativeStrengthPct: 2.25,
    volumeAnomaly: 1.75,
    tradesAnomaly: 1.5,
    volatilityPct: 1,
    spreadPct: 0.01,
    topBookQuoteValue: 100_000,
    orderBookImbalancePct: 5,
    liquidityScore: 8,
    activityScore: 80,
    quoteVolume: 250_000,
    tradesCount: 500,
    tradesPerMinute: 100,
    buyTradesCount: 0,
    sellTradesCount: 0,
    buyQuoteVolume: 140_000,
    sellQuoteVolume: 110_000,
    windowStartedAt:
      '2026-07-27T12:00:00.000Z',
    updatedAt:
      '2026-07-27T12:00:30.000Z',
    ...overrides,
  };
}

function createRow(
  overrides = {},
) {
  return {
    id: 'row',
    symbol: 'AAAUSDT',
    direction: 'long',
    kind: 'A',
    stage: 'observation',
    timeframe: '1m',
    level: '1.00–1.10',
    touches: 2,
    formationMinutes: 10,
    distancePercent: 0.1,
    pullbackDepth: 'Неглубокие',
    volumeAnomaly: 1,
    tradesAnomaly: 1,
    btcStrength: -1,
    btcStrengthLabel: '-1.00%',
    runtimeData: true,
    ...overrides,
  };
}

test(
  'indexes live Scanner metrics by symbol and timeframe',
  () => {
    assert.equal(
      buildScannerSetupMetricKey(
        ' sol/usdt ',
        '5m',
      ),
      'SOLUSDT:5m',
    );

    const indexed =
      indexScannerSetupMetrics([
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '1m',
              {
                volumeAnomaly: 1.1,
              },
            ),
        },
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '5m',
              {
                volumeAnomaly: 2.2,
              },
            ),
        },
      ]);

    assert.equal(
      indexed['SOLUSDT:1m']
        ?.volumeAnomaly,
      1.1,
    );

    assert.equal(
      indexed['SOLUSDT:5m']
        ?.volumeAnomaly,
      2.2,
    );
  },
);

test(
  'applies only the exact symbol and timeframe live metric',
  () => {
    const setups = [
      createRow({
        id: 'runtime-1m',
        symbol: 'SOLUSDT',
        timeframe: '1m',
      }),
      createRow({
        id: 'runtime-5m',
        symbol: 'SOLUSDT',
        timeframe: '5m',
      }),
      createRow({
        id: 'mock',
        symbol: 'SOLUSDT',
        timeframe: '15m',
        runtimeData: false,
        volumeAnomaly: 9,
        tradesAnomaly: 8,
        btcStrength: 7,
        btcStrengthLabel: '+7.00%',
      }),
    ];

    const metrics =
      indexScannerSetupMetrics([
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '1m',
              {
                volumeAnomaly: 1.25,
                tradesAnomaly: 1.5,
                relativeStrengthPct: 0.75,
              },
            ),
        },
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '5m',
              {
                volumeAnomaly: 2.25,
                tradesAnomaly: 2.5,
                relativeStrengthPct: -0.5,
              },
            ),
        },
      ]);

    const result =
      applyScannerSetupLiveMetrics(
        setups,
        metrics,
      );

    assert.equal(
      result[0]?.volumeAnomaly,
      1.25,
    );

    assert.equal(
      result[0]?.btcStrengthLabel,
      '+0.75%',
    );

    assert.equal(
      result[1]?.volumeAnomaly,
      2.25,
    );

    assert.equal(
      result[1]?.btcStrengthLabel,
      '-0.50%',
    );

    assert.equal(
      result[2]?.volumeAnomaly,
      9,
    );

    assert.equal(
      result[2]?.btcStrength,
      7,
    );
  },
);

test(
  'returns null live values while a runtime metric is unavailable',
  () => {
    const result =
      applyScannerSetupLiveMetrics(
        [
          createRow({
            volumeAnomaly: 99,
            tradesAnomaly: 99,
            btcStrength: 99,
          }),
        ],
        {},
      );

    assert.equal(
      result[0]?.volumeAnomaly,
      null,
    );

    assert.equal(
      result[0]?.tradesAnomaly,
      null,
    );

    assert.equal(
      result[0]?.btcStrength,
      null,
    );

    assert.equal(
      result[0]?.btcStrengthLabel,
      '—',
    );
  },
);

test(
  'supports all thirteen Scanner setup table sort columns',
  () => {
    assert.equal(
      SCANNER_SETUP_TABLE_SORT_KEYS
        .length,
      13,
    );

    const low =
      createRow({
        id: 'low',
        symbol: 'AAAUSDT',
        direction: 'long',
        kind: 'A',
        stage: 'observation',
        timeframe: '1m',
        level: '1.00–1.10',
        touches: 2,
        formationMinutes: 10,
        distancePercent: 0.1,
        pullbackDepth: 'Неглубокие',
        volumeAnomaly: 1,
        tradesAnomaly: 1,
        btcStrength: -1,
      });

    const high =
      createRow({
        id: 'high',
        symbol: 'ZZZUSDT',
        direction: 'short',
        kind: 'Z',
        stage: 'triggered',
        timeframe: '15m',
        level: '2.00–2.10',
        touches: 3,
        formationMinutes: 20,
        distancePercent: 0.2,
        pullbackDepth: 'Глубокие',
        volumeAnomaly: 2,
        tradesAnomaly: 2,
        btcStrength: 1,
      });

    for (
      const sortBy
      of SCANNER_SETUP_TABLE_SORT_KEYS
    ) {
      const descending =
        sortScannerSetupRows(
          [
            low,
            high,
          ],
          {
            sortBy,
            sortDirection:
              'desc',
          },
        );

      assert.deepEqual(
        descending.map(
          ({ id }) =>
            id,
        ),
        [
          'high',
          'low',
        ],
        `descending ${sortBy}`,
      );

      const ascending =
        sortScannerSetupRows(
          [
            high,
            low,
          ],
          {
            sortBy,
            sortDirection:
              'asc',
          },
        );

      assert.deepEqual(
        ascending.map(
          ({ id }) =>
            id,
        ),
        [
          'low',
          'high',
        ],
        `ascending ${sortBy}`,
      );
    }
  },
);

test(
  'uses descending on the first header click and ascending on the second',
  () => {
    const firstClick =
      nextScannerSetupSortState(
        DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
        'volume',
      );

    assert.deepEqual(
      firstClick,
      {
        sortBy: 'volume',
        sortDirection:
          'desc',
      },
    );

    const secondClick =
      nextScannerSetupSortState(
        firstClick,
        'volume',
      );

    assert.deepEqual(
      secondClick,
      {
        sortBy: 'volume',
        sortDirection:
          'asc',
      },
    );
  },
);

test(
  'keeps missing Scanner setup values last in both directions',
  () => {
    const rows = [
      createRow({
        id: 'missing',
        volumeAnomaly: null,
      }),
      createRow({
        id: 'high',
        volumeAnomaly: 2,
      }),
      createRow({
        id: 'low',
        volumeAnomaly: 1,
      }),
    ];

    const descending =
      sortScannerSetupRows(
        rows,
        {
          sortBy: 'volume',
          sortDirection: 'desc',
        },
      );

    assert.deepEqual(
      descending.map(
        ({ id }) =>
          id,
      ),
      [
        'high',
        'low',
        'missing',
      ],
    );

    const ascending =
      sortScannerSetupRows(
        rows,
        {
          sortBy: 'volume',
          sortDirection: 'asc',
        },
      );

    assert.deepEqual(
      ascending.map(
        ({ id }) =>
          id,
      ),
      [
        'low',
        'high',
        'missing',
      ],
    );
  },
);
