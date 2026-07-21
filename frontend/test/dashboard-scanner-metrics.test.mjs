import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardScannerMetricView,
  buildDashboardScannerWorkspaceUrl,
  buildMarketScannerMetricsUrl,
  fetchMarketScannerMetrics,
  normalizeMarketScannerSymbol,
  sortDashboardScannerRows,
} from '../node_modules/.tmp/realtime-test/realtime/dashboardScannerMetrics.js';

const metric = {
  symbol: 'SOLUSDT',
  scannerWindow: '1m',
  windowMs: 60_000,
  price: 75.95,
  priceChangePct: 0.02634,
  btcCorrelation: 0.87654,
  relativeStrengthPct: 1.23456,
  volatilityPct: 0.42345,
  spreadPct: 0.01999800019998,
  topBookQuoteValue: 18_001.6,
  orderBookImbalancePct:
    11.101235445938322,
  liquidityScore: 7,
  activityScore: 92,
  quoteVolume: 25_997.86,
  tradesCount: 266,
  tradesPerMinute: 266,
  buyTradesCount: 150,
  sellTradesCount: 116,
  buyQuoteVolume: 14_000,
  sellQuoteVolume: 11_997.86,
  windowStartedAt:
    '2026-07-19T13:19:50.000Z',
  updatedAt:
    '2026-07-19T13:20:49.000Z',
};

const fallback = {
  symbol: 'SOL/USDT',
  priceChangeLabel: '+2.81%',
  quoteVolumeLabel: '$4.21M',
  tradesCountLabel: '8 420',
  speedLabel: '1 684/мин',
  volatilityLabel: '3.8%',
  liquidityScore: 6,
  activityScore: 96,
};

test(
  'normalizes scanner symbols and builds the API URL',
  () => {
    assert.equal(
      normalizeMarketScannerSymbol(
        ' sol/usdt ',
      ),
      'SOLUSDT',
    );

    assert.equal(
      buildMarketScannerMetricsUrl({
        baseUrl:
          'http://localhost:4100/',
        symbols: [
          'SOL/USDT',
          'ethusdt',
          'SOLUSDT',
        ],
        scannerWindow: '1m',
      }),
      'http://localhost:4100/api/v1/market/realtime/scanner-metrics?symbols=SOLUSDT%2CETHUSDT&scannerWindow=1m',
    );
  },
);

test(
  'builds a Dashboard scanner Workspace URL',
  () => {
    assert.equal(
      buildDashboardScannerWorkspaceUrl(
        '/app/workspace',
        ' sol/usdt ',
      ),
      '/app/workspace?symbol=SOLUSDT&timeframe=1m',
    );
  },
);

test(
  'fetches and validates market scanner metrics',
  async () => {
    let requestedUrl = '';

    const result =
      await fetchMarketScannerMetrics({
        symbols: ['SOLUSDT'],
        scannerWindow: '1m',
        fetcher: async (url) => {
          requestedUrl = url;

          return new Response(
            JSON.stringify([metric]),
            {
              status: 200,
              headers: {
                'content-type':
                  'application/json',
              },
            },
          );
        },
      });

    assert.match(
      requestedUrl,
      /scanner-metrics\?symbols=SOLUSDT&scannerWindow=1m$/,
    );

    assert.equal(
      result[0]?.symbol,
      'SOLUSDT',
    );

    assert.equal(
      result[0]?.tradesCount,
      266,
    );
    assert.equal(
      result[0]?.volatilityPct,
      0.42345,
    );

    assert.equal(
      result[0]?.btcCorrelation,
      0.87654,
    );

    assert.equal(
      result[0]?.relativeStrengthPct,
      1.23456,
    );
    assert.equal(
      result[0]?.liquidityScore,
      7,
    );
    assert.equal(
      result[0]?.topBookQuoteValue,
      18_001.6,
    );
    assert.equal(
      result[0]?.activityScore,
      92,
    );
  },
);

test(
  'builds a live Dashboard scanner metric view',
  () => {
    const view =
      buildDashboardScannerMetricView(
        fallback,
        metric,
      );

    assert.equal(view.isLive, true);
    assert.equal(view.priceLabel, '75.95');
    assert.equal(
      view.priceChangeLabel,
      '+0.03%',
    );
    assert.equal(
      view.quoteVolumeLabel,
      '$26.00K',
    );
    assert.equal(
      view.quoteVolumeValue,
      25_997.86,
    );
    assert.equal(
      view.tradesCountLabel,
      '266',
    );
    assert.equal(
      view.speedLabel,
      '266/мин',
    );
    assert.equal(
      view.volatilityLabel,
      '0.42%',
    );

    assert.equal(
      view.btcCorrelation,
      0.87654,
    );

    assert.equal(
      view.btcCorrelationLabel,
      '0.88',
    );

    assert.equal(
      view.relativeStrengthPct,
      1.23456,
    );

    assert.equal(
      view.relativeStrengthLabel,
      '+1.23%',
    );
    assert.equal(
      view.liquidityIsLive,
      true,
    );
    assert.equal(
      view.liquidityScore,
      7,
    );
    assert.equal(
      view.liquidityTitle,
      'LIVE · спред 0.0200% · верх стакана $18.00K · дисбаланс +11.10%',
    );
    assert.equal(
      view.activityIsLive,
      true,
    );
    assert.equal(
      view.activityScore,
      92,
    );
    assert.equal(
      view.activityTitle,
      'LIVE · объём $26.00K · скорость 266/мин · волатильность 0.42% · ликвидность 7/9',
    );
    assert.equal(
      view.sourceLabel,
      'LIVE',
    );
  },
);

test(
  'keeps Dashboard scanner fallback values without metrics',
  () => {
    const view =
      buildDashboardScannerMetricView(
        fallback,
        undefined,
      );

    assert.equal(view.isLive, false);
    assert.equal(view.priceLabel, '—');
    assert.equal(
      view.priceChangeLabel,
      '+2.81%',
    );
    assert.equal(
      view.quoteVolumeLabel,
      '$4.21M',
    );
    assert.equal(
      view.quoteVolumeValue,
      null,
    );
    assert.equal(
      view.tradesCountLabel,
      '8 420',
    );
    assert.equal(
      view.speedLabel,
      '1 684/мин',
    );
    assert.equal(
      view.volatilityLabel,
      '3.8%',
    );
    assert.equal(
      view.liquidityIsLive,
      false,
    );
    assert.equal(
      view.liquidityScore,
      6,
    );
    assert.equal(
      view.liquidityTitle,
      'TEST · тестовая ликвидность',
    );
    assert.equal(
      view.activityIsLive,
      false,
    );
    assert.equal(
      view.activityScore,
      96,
    );
    assert.equal(
      view.activityTitle,
      'TEST · тестовая оценка активности',
    );
    assert.equal(
      view.sourceLabel,
      'TEST',
    );
  },
);

test(
  'ranks live scanner rows by activity and quote volume',
  () => {
    const ranked =
      sortDashboardScannerRows([
        {
          symbol: 'TESTUSDT',
          view: {
            activityIsLive: false,
            activityScore: 99,
            quoteVolumeValue: null,
          },
        },
        {
          symbol: 'LOWVOLUMEUSDT',
          view: {
            activityIsLive: true,
            activityScore: 80,
            quoteVolumeValue: 1_000,
          },
        },
        {
          symbol: 'TOPUSDT',
          view: {
            activityIsLive: true,
            activityScore: 90,
            quoteVolumeValue: 500,
          },
        },
        {
          symbol: 'HIGHVOLUMEUSDT',
          view: {
            activityIsLive: true,
            activityScore: 80,
            quoteVolumeValue: 5_000,
          },
        },
      ]);

    assert.deepEqual(
      ranked.map(({ symbol }) => symbol),
      [
        'TOPUSDT',
        'HIGHVOLUMEUSDT',
        'LOWVOLUMEUSDT',
        'TESTUSDT',
      ],
    );
  },
);

test(
  'reports a failed market scanner metrics request',
  async () => {
    await assert.rejects(
      () =>
        fetchMarketScannerMetrics({
          symbols: ['SOLUSDT'],
          fetcher: async () =>
            new Response(
              JSON.stringify({
                error:
                  'scanner_metrics_unavailable',
              }),
              {
                status: 503,
              },
            ),
        }),
      /request failed: 503/,
    );
  },
);


test(
  'shows no BTC comparison before enough history is collected',
  () => {
    const view =
      buildDashboardScannerMetricView(
        fallback,
        {
          ...metric,
          btcCorrelation: null,
          relativeStrengthPct: null,
        },
      );

    assert.equal(
      view.btcCorrelation,
      null,
    );

    assert.equal(
      view.btcCorrelationLabel,
      'нет данных',
    );

    assert.equal(
      view.relativeStrengthPct,
      null,
    );

    assert.equal(
      view.relativeStrengthLabel,
      'нет данных',
    );
  },
);
