import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMarketScannerMetric,
} from '../node_modules/.tmp/realtime-test/realtime/dashboardScannerMetrics.js';

import {
  buildMarketWideLiquidationsUrl,
  fetchMarketWideLiquidations,
  parseMarketWideLiquidation,
} from '../node_modules/.tmp/realtime-test/realtime/marketWideLiquidations.js';

function createMetric(
  overrides = {},
) {
  return {
    symbol: 'BTCUSDT',
    scannerWindow: '1m',
    windowMs: 60_000,
    price: 100_000,
    priceChangePct: 1.25,
    openInterest: 12345.5,
    openInterestUpdatedAt:
      '2026-08-23T17:00:00.000Z',
    btcCorrelation: null,
    relativeStrengthPct: 0.75,
    volumeAnomaly: 1.75,
    tradesAnomaly: 1.5,
    volatilityPct: 2.5,
    spreadPct: 0.01,
    topBookQuoteValue: 100_000,
    orderBookImbalancePct: 12,
    liquidityScore: 8,
    activityScore: 76,
    quoteVolume: 250_000,
    tradesCount: 500,
    tradesPerMinute: 500,
    buyTradesCount: 250,
    sellTradesCount: 250,
    buyQuoteVolume: 140_000,
    sellQuoteVolume: 110_000,
    windowStartedAt:
      '2026-08-23T16:59:00.000Z',
    updatedAt:
      '2026-08-23T17:00:00.000Z',
    ...overrides,
  };
}

function createLiquidation(
  overrides = {},
) {
  return {
    symbol: 'BTCUSDT',
    pairSymbol: 'BTCUSDT',
    side: 'sell',
    orderType: 'LIMIT',
    timeInForce: 'IOC',
    originalQuantity: 2,
    price: 100_000,
    averagePrice: 99_950,
    orderStatus: 'FILLED',
    lastFilledQuantity: 1,
    filledQuantity: 2,
    tradeAt:
      '2026-08-23T17:00:00.000Z',
    updatedAt:
      '2026-08-23T17:00:01.000Z',
    ...overrides,
  };
}

test(
  'retains factual Open Interest from market-wide scanner metrics',
  () => {
    const metric =
      parseMarketScannerMetric(
        createMetric(),
      );

    assert.equal(
      metric.openInterest,
      12345.5,
    );

    assert.equal(
      metric.openInterestUpdatedAt,
      '2026-08-23T17:00:00.000Z',
    );
  },
);

test(
  'keeps backward compatibility when Open Interest fields are absent',
  () => {
    const value =
      createMetric();

    delete value.openInterest;
    delete value.openInterestUpdatedAt;

    const metric =
      parseMarketScannerMetric(
        value,
      );

    assert.equal(
      metric.openInterest,
      null,
    );

    assert.equal(
      metric.openInterestUpdatedAt,
      null,
    );
  },
);

test(
  'builds normalized selected-symbol liquidation URL',
  () => {
    assert.equal(
      buildMarketWideLiquidationsUrl({
        baseUrl:
          'http://127.0.0.1:4200/',
        symbol:
          ' btc/usdt ',
        limit:
          6,
      }),
      'http://127.0.0.1:4200/api/v1/market/realtime/market-wide/liquidations?symbol=BTCUSDT&limit=6',
    );
  },
);

test(
  'parses liquidation side as factual source order side',
  () => {
    const liquidation =
      parseMarketWideLiquidation(
        createLiquidation({
          side:
            'buy',
        }),
      );

    assert.equal(
      liquidation.side,
      'buy',
    );

    assert.equal(
      liquidation.symbol,
      'BTCUSDT',
    );

    assert.equal(
      liquidation.filledQuantity,
      2,
    );
  },
);

test(
  'rejects unsupported liquidation side without long-short inference',
  () => {
    assert.throws(
      () =>
        parseMarketWideLiquidation(
          createLiquidation({
            side:
              'long',
          }),
        ),
      /Invalid liquidation: side/,
    );
  },
);

test(
  'fetches and sorts newest liquidation first',
  async () => {
    let requestedUrl =
      '';

    const result =
      await fetchMarketWideLiquidations({
        symbol:
          'BTCUSDT',
        limit:
          6,
        fetcher:
          async (
            url,
          ) => {
            requestedUrl =
              url;

            return new Response(
              JSON.stringify([
                createLiquidation({
                  updatedAt:
                    '2026-08-23T17:00:01.000Z',
                }),
                createLiquidation({
                  side:
                    'buy',
                  updatedAt:
                    '2026-08-23T17:00:03.000Z',
                }),
              ]),
              {
                status:
                  200,
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
      /symbol=BTCUSDT&limit=6$/,
    );

    assert.equal(
      result.length,
      2,
    );

    assert.equal(
      result[0]?.side,
      'buy',
    );

    assert.equal(
      result[0]?.updatedAt,
      '2026-08-23T17:00:03.000Z',
    );
  },
);
