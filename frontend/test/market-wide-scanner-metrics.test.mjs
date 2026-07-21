import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketWideScannerMetricsUrl,
  fetchMarketWideScannerMetrics,
  indexMarketWideScannerMetrics,
} from '../node_modules/.tmp/realtime-test/realtime/marketWideScannerMetrics.js';

function createMetric(
  symbol,
  price,
) {
  return {
    symbol,
    scannerWindow: '1m',
    windowMs: 60_000,
    price,
    priceChangePct: 1.25,
    btcCorrelation: null,
    relativeStrengthPct: 0.75,
    volatilityPct: 2.5,
    spreadPct: 0.01,
    topBookQuoteValue:
      100_000,
    orderBookImbalancePct:
      12,
    liquidityScore: 8,
    activityScore: 76,
    quoteVolume: 250_000,
    tradesCount: 500,
    tradesPerMinute: 500,
    buyTradesCount: 0,
    sellTradesCount: 0,
    buyQuoteVolume:
      140_000,
    sellQuoteVolume:
      110_000,
    windowStartedAt:
      '2026-07-21T12:00:00.000Z',
    updatedAt:
      '2026-07-21T12:00:30.000Z',
  };
}

test(
  'builds the all-market scanner metrics URL',
  () => {
    assert.equal(
      buildMarketWideScannerMetricsUrl({
        baseUrl:
          'http://localhost:4100/',
      }),
      'http://localhost:4100/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=1m',
    );
  },
);

test(
  'builds a normalized single-symbol market-wide URL',
  () => {
    assert.equal(
      buildMarketWideScannerMetricsUrl({
        symbol:
          ' sol/usdt ',
      }),
      '/api/v1/market/realtime/market-wide/scanner-metrics?scannerWindow=1m&symbol=SOLUSDT',
    );
  },
);

test(
  'fetches and validates all market-wide scanner metrics',
  async () => {
    let requestedUrl = '';

    const metrics =
      await fetchMarketWideScannerMetrics({
        fetcher:
          async (url) => {
            requestedUrl = url;

            return new Response(
              JSON.stringify([
                createMetric(
                  'BTCUSDT',
                  100_000,
                ),
                createMetric(
                  'SOLUSDT',
                  200,
                ),
              ]),
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
      /market-wide\/scanner-metrics\?scannerWindow=1m$/,
    );

    assert.equal(
      metrics.length,
      2,
    );

    assert.equal(
      metrics[1]?.symbol,
      'SOLUSDT',
    );

    assert.equal(
      metrics[1]?.price,
      200,
    );

    const indexed =
      indexMarketWideScannerMetrics(
        metrics,
      );

    assert.equal(
      indexed.BTCUSDT?.price,
      100_000,
    );

    assert.equal(
      indexed.SOLUSDT
        ?.tradesCount,
      500,
    );
  },
);

test(
  'rejects invalid market-wide responses',
  async () => {
    await assert.rejects(
      () =>
        fetchMarketWideScannerMetrics({
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  symbol:
                    'BTCUSDT',
                }),
                {
                  status: 200,
                },
              ),
        }),
      /Invalid market-wide scanner metrics response/,
    );

    await assert.rejects(
      () =>
        fetchMarketWideScannerMetrics({
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  error:
                    'unavailable',
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