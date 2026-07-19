import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDashboardScannerMetricView,
  buildMarketScannerMetricsUrl,
  fetchMarketScannerMetrics,
  normalizeMarketScannerSymbol,
} from '../node_modules/.tmp/realtime-test/dashboardScannerMetrics.js';

const metric = {
  symbol: 'SOLUSDT',
  windowMs: 60_000,
  price: 75.95,
  priceChangePct: 0.02634,
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
      }),
      'http://localhost:4100/api/v1/market/realtime/scanner-metrics?symbols=SOLUSDT%2CETHUSDT',
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
      /scanner-metrics\?symbols=SOLUSDT$/,
    );

    assert.equal(
      result[0]?.symbol,
      'SOLUSDT',
    );

    assert.equal(
      result[0]?.tradesCount,
      266,
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
      view.tradesCountLabel,
      '266',
    );
    assert.equal(
      view.speedLabel,
      '266/мин',
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
      view.tradesCountLabel,
      '8 420',
    );
    assert.equal(
      view.speedLabel,
      '1 684/мин',
    );
    assert.equal(
      view.sourceLabel,
      'TEST',
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
