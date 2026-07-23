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
test(
  'aggregates consecutive one-minute klines into a three-minute scanner window',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'SOLUSDT',
      ]);

    const minutes = [
      {
        openTime:
          '2024-07-20T12:00:00.000Z',
        open: '100',
        high: '102',
        low: '99',
        close: '101',
        quoteVolume: '1000',
        tradesCount: 10,
        takerBuyQuoteVolume: '600',
      },
      {
        openTime:
          '2024-07-20T12:01:00.000Z',
        open: '101',
        high: '104',
        low: '100',
        close: '103',
        quoteVolume: '2000',
        tradesCount: 20,
        takerBuyQuoteVolume: '1200',
      },
      {
        openTime:
          '2024-07-20T12:02:00.000Z',
        open: '103',
        high: '105',
        low: '102',
        close: '104',
        quoteVolume: '3000',
        tradesCount: 30,
        takerBuyQuoteVolume: '1700',
      },
    ];

    for (
      const [
        index,
        minute,
      ] of minutes.entries()
    ) {
      const openTimeMs =
        Date.parse(
          minute.openTime,
        );

      const update =
        parseBinanceOneMinuteKlineEvent(
          klinePayload({
            E:
              openTimeMs
              + 59_000,
            k: {
              t: openTimeMs,
              T:
                openTimeMs
                + 59_999,
              o: minute.open,
              h: minute.high,
              l: minute.low,
              c: minute.close,
              q:
                minute.quoteVolume,
              n:
                minute.tradesCount,
              Q:
                minute
                  .takerBuyQuoteVolume,
              x:
                index
                < minutes.length - 1,
            },
          }),
        );

      assert.equal(
        store.applyKline(update),
        true,
      );
    }

    const metric =
      store.getMetrics(
        'SOLUSDT',
        '3m',
      )[0];

    assert.ok(metric);

    assert.equal(
      metric.scannerWindow,
      '3m',
    );

    assert.equal(
      metric.windowMs,
      180_000,
    );

    assert.equal(
      metric.price,
      104,
    );

    assert.equal(
      metric.priceChangePct,
      4,
    );

    assert.equal(
      metric.volatilityPct,
      6,
    );

    assert.equal(
      metric.quoteVolume,
      6000,
    );

    assert.equal(
      metric.tradesCount,
      60,
    );

    assert.equal(
      metric.tradesPerMinute,
      20,
    );

    assert.equal(
      metric.buyQuoteVolume,
      3500,
    );

    assert.equal(
      metric.sellQuoteVolume,
      2500,
    );

    assert.equal(
      metric.windowStartedAt,
      '2024-07-20T12:00:00.000Z',
    );

    const partialHourMetric =
      store.getMetrics(
        'SOLUSDT',
        '1h',
      )[0];

    assert.ok(partialHourMetric);

    assert.equal(
      partialHourMetric.tradesCount,
      60,
    );

    assert.equal(
      partialHourMetric.tradesPerMinute,
      20,
    );
  },
);

test(
  'calculates BTC correlation from aligned retained kline history',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'BTCUSDT',
        'SOLUSDT',
      ]);

    const startTime =
      1_721_577_840_000;

    const btcPrices = [
      100,
      110,
      105,
      120,
    ];

    const solPrices = [
      200,
      220,
      210,
      240,
    ];

    for (
      let index = 0;
      index < btcPrices.length;
      index += 1
    ) {
      const openTime =
        startTime
        + index * 60_000;

      store.applyKline(
        parseBinanceOneMinuteKlineEvent(
          klinePayload({
            E:
              openTime + 59_000,
            s: 'BTCUSDT',
            k: {
              t: openTime,
              T:
                openTime + 59_999,
              s: 'BTCUSDT',
              o:
                String(
                  btcPrices[
                    Math.max(
                      0,
                      index - 1,
                    )
                  ],
                ),
              h:
                String(
                  Math.max(
                    btcPrices[index],
                    btcPrices[
                      Math.max(
                        0,
                        index - 1,
                      )
                    ],
                  ),
                ),
              l:
                String(
                  Math.min(
                    btcPrices[index],
                    btcPrices[
                      Math.max(
                        0,
                        index - 1,
                      )
                    ],
                  ),
                ),
              c:
                String(
                  btcPrices[index],
                ),
            },
          }),
        ),
      );

      store.applyKline(
        parseBinanceOneMinuteKlineEvent(
          klinePayload({
            E:
              openTime + 59_000,
            k: {
              t: openTime,
              T:
                openTime + 59_999,
              o:
                String(
                  solPrices[
                    Math.max(
                      0,
                      index - 1,
                    )
                  ],
                ),
              h:
                String(
                  Math.max(
                    solPrices[index],
                    solPrices[
                      Math.max(
                        0,
                        index - 1,
                      )
                    ],
                  ),
                ),
              l:
                String(
                  Math.min(
                    solPrices[index],
                    solPrices[
                      Math.max(
                        0,
                        index - 1,
                      )
                    ],
                  ),
                ),
              c:
                String(
                  solPrices[index],
                ),
            },
          }),
        ),
      );
    }

    const sol =
      store
        .getMetrics(
          undefined,
          '5m',
        )
        .find(
          (metric) =>
            metric.symbol
            === 'SOLUSDT',
        );

    assert.ok(sol);

    assert.ok(
      sol.btcCorrelation
      !== null,
    );

    assert.ok(
      Math.abs(
        sol.btcCorrelation - 1,
      ) < 0.000_000_001,
    );
  },
);

test(
  'merges older historical candles without overwriting newer live updates',
  () => {
    const store =
      new MarketWideOneMinuteMetricsStore([
        'SOLUSDT',
      ]);

    const baseTime =
      Date.parse(
        '2024-07-20T12:00:00.000Z',
      );

    const buildUpdate = (
      minute: number,
      quoteVolume: number,
      tradesCount: number,
      close: number,
      eventOffsetMs = 59_000,
    ) => {
      const openTime =
        baseTime
        + minute * 60_000;

      return parseBinanceOneMinuteKlineEvent(
        klinePayload({
          E:
            openTime
            + eventOffsetMs,
          k: {
            t: openTime,
            T:
              openTime
              + 59_999,
            o:
              String(
                close - 1,
              ),
            h:
              String(
                close + 1,
              ),
            l:
              String(
                close - 2,
              ),
            c:
              String(close),
            q:
              String(
                quoteVolume,
              ),
            n:
              tradesCount,
            Q:
              String(
                quoteVolume / 2,
              ),
            x: true,
          },
        }),
      );
    };

    const liveUpdate =
      buildUpdate(
        2,
        3_000,
        30,
        104,
        59_500,
      );

    assert.equal(
      store.applyKline(
        liveUpdate,
      ),
      true,
    );

    const appliedCount =
      store.applyHistoricalKlines([
        buildUpdate(
          0,
          1_000,
          10,
          101,
          59_999,
        ),
        buildUpdate(
          1,
          2_000,
          20,
          103,
          59_999,
        ),
        buildUpdate(
          2,
          9_999,
          999,
          103,
          30_000,
        ),
      ]);

    assert.equal(
      appliedCount,
      2,
    );

    const metric =
      store.getMetrics(
        'SOLUSDT',
        '3m',
      )[0];

    assert.ok(metric);

    assert.equal(
      metric.price,
      104,
    );

    assert.equal(
      metric.quoteVolume,
      6_000,
    );

    assert.equal(
      metric.tradesCount,
      60,
    );

    assert.equal(
      metric.tradesPerMinute,
      20,
    );

    assert.equal(
      metric.windowStartedAt,
      '2024-07-20T12:00:00.000Z',
    );
  },
);