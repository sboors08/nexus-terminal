import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  DEFAULT_SCANNER_SETUP_TABLE_SORT_STATE,
  SCANNER_SETUP_TABLE_SORT_KEYS,
  applyScannerSetupLiveMetrics,
  buildScannerSetupMetricKey,
  indexScannerSetupMetrics,
  isScannerSetupBelowKnownQuoteVolume,
  parseScannerMinQuoteVolumeMillions,
  nextScannerSetupSortState,
  sortScannerSetupRows,
} from '../node_modules/.tmp/realtime-test/realtime/scannerSetupTable.js';

const scannerPageSource =
  await readFile(
    new URL(
      '../src/pages/ScannerPage.tsx',
      import.meta.url,
    ),
    'utf8',
  );

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
  'does not render disconnected Scanner trading-preset controls',
  () => {
    assert.doesNotMatch(
      scannerPageSource,
      /Торговый пресет/u,
    );

    assert.doesNotMatch(
      scannerPageSource,
      /selectPreset/u,
    );
  },
);

test(
  'does not render a disconnected Scanner analysis-period control',
  () => {
    assert.doesNotMatch(
      scannerPageSource,
      /Период анализа/u,
    );

    assert.doesNotMatch(
      scannerPageSource,
      /selectScannerWindow/u,
    );

    assert.match(
      scannerPageSource,
      /Таймфрейм графика/u,
    );
  },
);

test(
  'waits for historical candles before subscribing the selected Scanner symbol',
  () => {
    assert.match(
      scannerPageSource,
      /useRealtimeMarketData\(\{[\s\S]*?symbol:\s*selectedSymbol,[\s\S]*?enabled:\s*candlesQuery\.status\s*===\s*'success',[\s\S]*?\}\);/u,
    );
  },
);

test(
  'keeps server-filtered setups while local 24h volume is loading',
  () => {
    assert.equal(
      isScannerSetupBelowKnownQuoteVolume(
        createRow({
          quoteVolume24h:
            null,
        }),
        1_000_000,
      ),
      false,
    );

    assert.equal(
      isScannerSetupBelowKnownQuoteVolume(
        createRow({}),
        1_000_000,
      ),
      false,
    );

    assert.equal(
      isScannerSetupBelowKnownQuoteVolume(
        createRow({
          quoteVolume24h:
            900_000,
        }),
        1_000_000,
      ),
      true,
    );

    assert.equal(
      isScannerSetupBelowKnownQuoteVolume(
        createRow({
          quoteVolume24h:
            1_100_000,
        }),
        1_000_000,
      ),
      false,
    );
  },
);

test(
  'converts the visible millions filter to the backend quote-volume contract',
  () => {
    assert.equal(
      parseScannerMinQuoteVolumeMillions(
        '1',
      ),
      1_000_000,
    );

    assert.equal(
      parseScannerMinQuoteVolumeMillions(
        '2,5',
      ),
      2_500_000,
    );

    assert.equal(
      parseScannerMinQuoteVolumeMillions(
        'not-a-number',
      ),
      0,
    );

    assert.match(
      scannerPageSource,
      /nexusApi\.getScannerSetups\([\s\S]*?minQuoteVolume24h/u,
    );

    assert.match(
      scannerPageSource,
      /setupQueryKey =\s*`scanner-setups:\$\{minQuoteVolume24h\}`/u,
    );

    assert.match(
      scannerPageSource,
      /preserveData:\s*false/u,
    );
  },
);

test(
  'does not carry saved Scanner cards into a different server volume query',
  () => {
    assert.match(
      scannerPageSource,
      /async \(\) => \(\{[\s\S]*?key:\s*setupQueryKey,[\s\S]*?setups:\s*await nexusApi\.getScannerSetups/u,
    );

    assert.match(
      scannerPageSource,
      /queryDataForCurrentKey =\s*query\.data\?\.key\s*=== setupQueryKey\s*\? query\.data\s*:\s*null/u,
    );

    assert.match(
      scannerPageSource,
      /const displayedSetups =\s*resultsMode === 'setups'\s*\? anchorSetups\s*:\s*\[\]/u,
    );
  },
);

test(
  'keeps Scanner filters available when the server volume query is empty',
  () => {
    assert.match(
      scannerPageSource,
      /lastNonEmptySetups/u,
    );

    assert.match(
      scannerPageSource,
      /filteredSetups\.length === 0[\s\S]*?aria-label="Пустой результат Scanner"/u,
    );

    assert.match(
      scannerPageSource,
      /resultsMode !== 'loading'[\s\S]*?onClick=\{resetFilters\}/u,
    );
  },
);

test(
  'uses 100M USDT as the initial and reset Scanner volume threshold',
  () => {
    assert.match(
      scannerPageSource,
      /DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS =\s*'100'/u,
    );

    assert.match(
      scannerPageSource,
      /useState\(\s*DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS,?\s*\)/u,
    );

    assert.match(
      scannerPageSource,
      /setMinQuoteVolumeMillions\(\s*DEFAULT_SCANNER_MIN_QUOTE_VOLUME_MILLIONS,?\s*\)/u,
    );
  },
);

test(
  'offers every production Setup Engine timeframe',
  () => {
    assert.match(
      scannerPageSource,
      /const SETUP_RUNTIME_TIMEFRAMES:[\s\S]*?'1m',[\s\S]*?'5m',[\s\S]*?'15m',[\s\S]*?'1h',[\s\S]*?'4h'/u,
    );

    assert.match(
      scannerPageSource,
      /availableTimeframes\.map/u,
    );

    assert.match(
      scannerPageSource,
      /const availableTimeframes =\s*SETUP_RUNTIME_TIMEFRAMES/u,
    );
  },
);

test(
  'switches the open chart timeframe without filtering candidates or replacing the selected setup',
  () => {
    assert.match(
      scannerPageSource,
      /const \[\s*chartTimeframe,[\s\S]*?setChartTimeframe,[\s\S]*?\] = useState<ScannerTimeframe>/u,
    );

    assert.match(
      scannerPageSource,
      /filteredSetups\.find\(\(setup\) => setup\.id === requestedSetupId\)[\s\S]*?\?\? displayedSetups\.find\(\(setup\) => setup\.id === requestedSetupId\)[\s\S]*?\?\? filteredSetups\[0\]/u,
    );

    assert.doesNotMatch(
      scannerPageSource,
      /setup\.timeframe !== chartTimeframe/u,
    );

    assert.match(
      scannerPageSource,
      /useMarketCandles\(\{[\s\S]*?symbol: selectedSymbol,[\s\S]*?timeframe: chartTimeframe/u,
    );

    assert.match(
      scannerPageSource,
      /useCausalLevelLines\(\{[\s\S]*?symbol: selectedSymbol,[\s\S]*?timeframe: chartTimeframe/u,
    );

    assert.doesNotMatch(
      scannerPageSource,
      /На выбранном таймфрейме активных сетапов нет/u,
    );
  },
);

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


test(
  'updates Level v2 Shadow price and distance from live metrics',
  () => {
    const metrics =
      indexScannerSetupMetrics([
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '1m',
              {
                price:
                  100,
                priceChangePct:
                  1.25,
                btcCorrelation:
                  0.8,
                relativeStrengthPct:
                  2.5,
                volumeAnomaly:
                  1.8,
                tradesAnomaly:
                  1.6,
                tradesPerMinute:
                  42.5,
              },
            ),
        },
      ]);

    const [result] =
      applyScannerSetupLiveMetrics(
        [
          createRow({
            id:
              'v2-shadow-sol-support',
            symbol:
              'SOLUSDT',
            timeframe:
              '1m',
            source:
              'v2-shadow',
            price:
              '\u2014',
            priceChange:
              '\u2014',
            levelLow:
              101,
            levelHigh:
              102,
            levelReferencePrice:
              101.5,
            distancePercent:
              Number.POSITIVE_INFINITY,
            distanceLabel:
              '\u2014',
            btcCorrelation:
              '\u2014',
            tradeSpeed:
              '\u0414\u0430\u043d\u043d\u044b\u0435 \u0441\u043e\u0431\u0438\u0440\u0430\u044e\u0442\u0441\u044f',
          }),
        ],
        metrics,
      );

    assert.equal(
      result?.price,
      '100',
    );

    assert.equal(
      result?.priceChange,
      '+1.25%',
    );

    assert.equal(
      result?.distancePercent,
      1,
    );

    assert.equal(
      result?.distanceLabel,
      '1.0000%',
    );

    assert.equal(
      result?.btcCorrelation,
      '0.80',
    );

    assert.equal(
      result?.tradeSpeed,
      '42.5 \u0441\u0434\u0435\u043b/\u043c\u0438\u043d',
    );

    assert.equal(
      result?.volumeAnomaly,
      1.8,
    );

    assert.equal(
      result?.tradesAnomaly,
      1.6,
    );

    assert.equal(
      result?.btcStrengthLabel,
      '+2.50%',
    );
  },
);

test(
  'does not replace V1 price and distance with market-wide metrics',
  () => {
    const metrics =
      indexScannerSetupMetrics([
        {
          SOLUSDT:
            createMetric(
              'SOLUSDT',
              '1m',
              {
                price:
                  120,
                priceChangePct:
                  5,
                btcCorrelation:
                  0.95,
                tradesPerMinute:
                  250,
              },
            ),
        },
      ]);

    const [result] =
      applyScannerSetupLiveMetrics(
        [
          createRow({
            id:
              'v1-sol-setup',
            symbol:
              'SOLUSDT',
            timeframe:
              '1m',
            source:
              'v1',
            price:
              '99.50',
            priceChange:
              '-0.25%',
            distancePercent:
              0.45,
            distanceLabel:
              '0.4500%',
            btcCorrelation:
              '0.44',
            tradeSpeed:
              '18.0 \u0441\u0434\u0435\u043b/\u043c\u0438\u043d',
          }),
        ],
        metrics,
      );

    assert.equal(
      result?.price,
      '99.50',
    );

    assert.equal(
      result?.priceChange,
      '-0.25%',
    );

    assert.equal(
      result?.distancePercent,
      0.45,
    );

    assert.equal(
      result?.distanceLabel,
      '0.4500%',
    );

    assert.equal(
      result?.btcCorrelation,
      '0.44',
    );

    assert.equal(
      result?.tradeSpeed,
      '18.0 \u0441\u0434\u0435\u043b/\u043c\u0438\u043d',
    );
  },
);
