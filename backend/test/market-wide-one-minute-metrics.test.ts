import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketWideOneMinuteMetricsStore,
  parseBinanceOneMinuteKlineEvent,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';

function klinePayload(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  const {
    k: kOverrides,
    ...rootOverrides
  } = overrides;

  return {
    e: 'kline',
    E: 1_721_577_841_999,
    s: 'SOLUSDT',
    ...rootOverrides,
    k: {
      t: 1_721_577_840_000,
      T: 1_721_577_899_999,
      s: 'SOLUSDT',
      i: '1m',
      o: '100',
      h: '102',
      l: '99',
      c: '101',
      q: '125000',
      n: 400,
      Q: '70000',
      x: false,
      ...(
        typeof kOverrides
          === 'object'
          && kOverrides !== null
          ? kOverrides
          : {}
      ),
    },
  };
}

test(
  'parses a Binance one-minute kline event',
  () => {
    const update =
      parseBinanceOneMinuteKlineEvent(
        klinePayload(),
      );

    assert.equal(
      update.symbol,
      'SOLUSDT',
    );

    assert.equal(
      update.open,
      100,
    );

    assert.equal(
      update.close,
      101,
    );

    assert.equal(
      update.quoteVolume,
      125000,
    );

    assert.equal(
      update.tradesCount,
      400,
    );

    assert.equal(
      update.takerBuyQuoteVolume,
      70000,
    );

    assert.equal(
      update.isClosed,
      false,
    );
  },
);

test(
  'rejects malformed and unsupported kline events',
  () => {
    assert.throws(
      () =>
        parseBinanceOneMinuteKlineEvent({
          e: 'trade',
        }),
      /not a kline/,
    );

    assert.throws(
      () =>
        parseBinanceOneMinuteKlineEvent(
          klinePayload({
            k: {
              i: '5m',
            },
          }),
        ),
      /Unsupported/,
    );

    assert.throws(
      () =>
        parseBinanceOneMinuteKlineEvent(
          klinePayload({
            k: {
              Q: '200000',
            },
          }),
        ),
      /taker buy volume/,
    );
  },
);

test(
  'builds real one-minute scanner metrics from kline and book ticker',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'SOLUSDT',
      ]);

    const update =
      parseBinanceOneMinuteKlineEvent(
        klinePayload(),
      );

    assert.equal(
      store.applyKline(update),
      true,
    );

    assert.equal(
      store.applyBookTicker({
        symbol: 'SOLUSDT',
        bidPrice: 100.99,
        bidQuantity: 300,
        askPrice: 101.01,
        askQuantity: 200,
        spread: 0,
        spreadPct: 0,
        updatedAt:
          '2024-07-20T12:04:02.000Z',
      }),
      true,
    );

    const metric =
      store.getMetrics(
        'SOLUSDT',
      )[0];

    assert.ok(metric);

    assert.equal(
      metric.price,
      101,
    );

    assert.equal(
      metric.priceChangePct,
      1,
    );

    assert.equal(
      metric.volatilityPct,
      3,
    );

    assert.equal(
      metric.quoteVolume,
      125000,
    );

    assert.equal(
      metric.tradesCount,
      400,
    );

    assert.equal(
      metric.tradesPerMinute,
      400,
    );

    assert.equal(
      metric.buyQuoteVolume,
      70000,
    );

    assert.equal(
      metric.sellQuoteVolume,
      55000,
    );

    assert.ok(
      metric.spreadPct !== null
      && metric.spreadPct > 0,
    );

    assert.ok(
      metric.topBookQuoteValue
      !== null
      && metric.topBookQuoteValue
        > 0,
    );

    assert.ok(
      metric.liquidityScore
      !== null,
    );

    assert.ok(
      metric.activityScore
      !== null,
    );
  },
);

test(
  'calculates relative strength against BTC',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'BTCUSDT',
        'SOLUSDT',
      ]);

    store.applyKline(
      parseBinanceOneMinuteKlineEvent(
        klinePayload({
          s: 'BTCUSDT',
          k: {
            s: 'BTCUSDT',
            o: '100000',
            h: '100600',
            l: '99900',
            c: '100500',
            q: '5000000',
            n: 1000,
            Q: '2700000',
          },
        }),
      ),
    );

    store.applyKline(
      parseBinanceOneMinuteKlineEvent(
        klinePayload({
          k: {
            o: '100',
            h: '103',
            l: '99',
            c: '102',
          },
        }),
      ),
    );

    const metrics =
      store.getMetrics();

    const btc =
      metrics.find(
        (metric) =>
          metric.symbol
          === 'BTCUSDT',
      );

    const sol =
      metrics.find(
        (metric) =>
          metric.symbol
          === 'SOLUSDT',
      );

    assert.equal(
      btc?.relativeStrengthPct,
      0,
    );

    assert.equal(
      sol?.relativeStrengthPct,
      1.5,
    );
  },
);

test(
  'updates the symbol universe and rejects stale updates',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'BTCUSDT',
      ]);

    const changes =
      store.replaceSymbols([
        'BTCUSDT',
        'NEWUSDT',
      ]);

    assert.deepEqual(
      changes,
      {
        addedSymbols:
          ['NEWUSDT'],
        removedSymbols: [],
      },
    );

    const current =
      parseBinanceOneMinuteKlineEvent(
        klinePayload({
          s: 'NEWUSDT',
          k: {
            s: 'NEWUSDT',
          },
        }),
      );

    assert.equal(
      store.applyKline(current),
      true,
    );

    const stale =
      {
        ...current,
        eventTime:
          '2024-07-20T12:03:00.000Z',
      };

    assert.equal(
      store.applyKline(stale),
      false,
    );

    const removal =
      store.replaceSymbols([
        'NEWUSDT',
      ]);

    assert.deepEqual(
      removal.removedSymbols,
      ['BTCUSDT'],
    );

    assert.equal(
      store.getMetrics(
        'BTCUSDT',
      ).length,
      0,
    );
  },
);