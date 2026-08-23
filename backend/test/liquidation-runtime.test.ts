import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MarketWideLiquidationStore,
  parseBinanceMarketWideLiquidation,
} from '../src/modules/realtime-market-data/market-wide-liquidations.js';
import type {
  RealtimeLiquidation,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

function createPayload(
  overrides:
    Record<string, unknown> = {},
): Record<string, unknown> {
  const baseOrder:
    Record<string, unknown> = {
      s: 'BTCUSDT',
      S: 'SELL',
      o: 'LIMIT',
      f: 'IOC',
      q: '0.014',
      p: '9910',
      ap: '9909.5',
      X: 'FILLED',
      l: '0.004',
      z: '0.014',
      T: 1_787_500_000_100,

      /*
       * This is the factual shape observed from the live
       * Binance !forceOrder@arr stream.
       */
      ps: 'BTCUSDT',
      st: 1,
    };

  const orderOverrides =
    typeof overrides.o
      === 'object'
    && overrides.o !== null
    && !Array.isArray(
      overrides.o,
    )
      ? overrides.o as
          Record<string, unknown>
      : {};

  const {
    o: _ignoredOrder,
    ...eventOverrides
  } =
    overrides;

  return {
    e: 'forceOrder',
    E: 1_787_500_000_123,
    o: {
      ...baseOrder,
      ...orderOverrides,
    },
    ...eventOverrides,
  };
}

function createLiquidation(
  symbol: string,
  updatedAt: string,
  price: number,
): RealtimeLiquidation {
  return {
    symbol,
    pairSymbol: symbol,
    side: 'sell',
    orderType: 'LIMIT',
    timeInForce: 'IOC',
    originalQuantity: 2,
    price,
    averagePrice: price,
    orderStatus: 'FILLED',
    lastFilledQuantity: 1,
    filledQuantity: 2,
    tradeAt: updatedAt,
    updatedAt,
  };
}

test(
  'parses factual Binance USD-M liquidation snapshot',
  () => {
    const result =
      parseBinanceMarketWideLiquidation(
        createPayload(),
      );

    assert.ok(result);

    assert.deepEqual(
      result,
      {
        symbol: 'BTCUSDT',
        pairSymbol: 'BTCUSDT',
        side: 'sell',
        orderType: 'LIMIT',
        timeInForce: 'IOC',
        originalQuantity: 0.014,
        price: 9910,
        averagePrice: 9909.5,
        orderStatus: 'FILLED',
        lastFilledQuantity: 0.004,
        filledQuantity: 0.014,
        tradeAt:
          new Date(
            1_787_500_000_100,
          ).toISOString(),
        updatedAt:
          new Date(
            1_787_500_000_123,
          ).toISOString(),
      },
    );
  },
);

test(
  'supports documented top-level ps/st fallback and rejects metadata conflicts',
  () => {
    const documentedShape =
      parseBinanceMarketWideLiquidation(
        createPayload({
          ps: 'BTCUSDT',
          st: 1,
          o: {
            ps: undefined,
            st: undefined,
          },
        }),
      );

    assert.ok(
      documentedShape,
    );

    assert.equal(
      documentedShape.pairSymbol,
      'BTCUSDT',
    );

    assert.throws(
      () =>
        parseBinanceMarketWideLiquidation(
          createPayload({
            st: 2,
          }),
        ),
      /symbol type mismatch/,
    );

    assert.throws(
      () =>
        parseBinanceMarketWideLiquidation(
          createPayload({
            ps: 'ETHUSDT',
          }),
        ),
      /pair symbol mismatch/,
    );
  },
);

test(
  'drops COIN-M liquidation snapshot with st=2',
  () => {
    const result =
      parseBinanceMarketWideLiquidation(
        createPayload({
          o: {
            s: 'BTCUSD_PERP',
            ps: 'BTCUSD',
            st: 2,
          },
        }),
      );

    assert.equal(
      result,
      null,
    );
  },
);

test(
  'rejects unsupported symbol type and malformed USD-M fields',
  () => {
    assert.throws(
      () =>
        parseBinanceMarketWideLiquidation(
          createPayload({
            o: {
              st: 3,
            },
          }),
        ),
      /Unsupported Binance liquidation symbol type/,
    );

    assert.throws(
      () =>
        parseBinanceMarketWideLiquidation(
          createPayload({
            o: {
              s: 'BTCUSDT',
              S: 'HOLD',
              o: 'LIMIT',
              f: 'IOC',
              q: '1',
              p: '100',
              ap: '100',
              X: 'FILLED',
              l: '1',
              z: '1',
              T: 1_787_500_000_100,
            },
          }),
        ),
      /Invalid Binance liquidation side/,
    );

    assert.throws(
      () =>
        parseBinanceMarketWideLiquidation(
          createPayload({
            o: {
              s: 'BTCUSDT',
              S: 'SELL',
              o: 'LIMIT',
              f: 'IOC',
              q: '1',
              p: '100',
              ap: '100',
              X: 'FILLED',
              l: '2',
              z: '2',
              T: 1_787_500_000_100,
            },
          }),
        ),
      /fill quantities/,
    );
  },
);

test(
  'keeps bounded per-symbol and market-wide recent liquidation history',
  () => {
    const store =
      new MarketWideLiquidationStore({
        symbols: [
          'BTCUSDT',
          'ETHUSDT',
        ],
        maxEventsPerSymbol: 2,
        maxRecentEvents: 3,
      });

    assert.equal(
      store.apply(
        createLiquidation(
          'BTCUSDT',
          '2026-08-23T15:00:00.000Z',
          100,
        ),
      ),
      true,
    );

    assert.equal(
      store.apply(
        createLiquidation(
          'ETHUSDT',
          '2026-08-23T15:00:01.000Z',
          200,
        ),
      ),
      true,
    );

    assert.equal(
      store.apply(
        createLiquidation(
          'BTCUSDT',
          '2026-08-23T15:00:02.000Z',
          101,
        ),
      ),
      true,
    );

    assert.equal(
      store.apply(
        createLiquidation(
          'BTCUSDT',
          '2026-08-23T15:00:03.000Z',
          102,
        ),
      ),
      true,
    );

    assert.deepEqual(
      store
        .getRecent(
          'BTCUSDT',
          10,
        )
        .map(
          (item) =>
            item.price,
        ),
      [
        101,
        102,
      ],
    );

    assert.deepEqual(
      store
        .getRecent(
          undefined,
          10,
        )
        .map(
          (item) =>
            [
              item.symbol,
              item.price,
            ],
        ),
      [
        [
          'ETHUSDT',
          200,
        ],
        [
          'BTCUSDT',
          101,
        ],
        [
          'BTCUSDT',
          102,
        ],
      ],
    );
  },
);

test(
  'rejects unknown and stale liquidation events without corrupting latest state',
  () => {
    const store =
      new MarketWideLiquidationStore({
        symbols: [
          'BTCUSDT',
        ],
      });

    assert.equal(
      store.apply(
        createLiquidation(
          'ETHUSDT',
          '2026-08-23T15:00:00.000Z',
          200,
        ),
      ),
      false,
    );

    assert.equal(
      store.apply(
        createLiquidation(
          'BTCUSDT',
          '2026-08-23T15:00:10.000Z',
          100,
        ),
      ),
      true,
    );

    assert.equal(
      store.apply(
        createLiquidation(
          'BTCUSDT',
          '2026-08-23T15:00:09.000Z',
          99,
        ),
      ),
      false,
    );

    assert.equal(
      store
        .getLatest(
          'BTCUSDT',
        )
        ?.price,
      100,
    );
  },
);

test(
  'removes liquidation history when symbol leaves tracked universe',
  () => {
    const store =
      new MarketWideLiquidationStore({
        symbols: [
          'BTCUSDT',
          'ETHUSDT',
        ],
      });

    store.apply(
      createLiquidation(
        'BTCUSDT',
        '2026-08-23T15:00:00.000Z',
        100,
      ),
    );

    store.apply(
      createLiquidation(
        'ETHUSDT',
        '2026-08-23T15:00:01.000Z',
        200,
      ),
    );

    const change =
      store.replaceSymbols([
        'ETHUSDT',
        'SOLUSDT',
      ]);

    assert.deepEqual(
      change,
      {
        addedSymbols: [
          'SOLUSDT',
        ],
        removedSymbols: [
          'BTCUSDT',
        ],
      },
    );

    assert.equal(
      store.getLatest(
        'BTCUSDT',
      ),
      null,
    );

    assert.deepEqual(
      store
        .getRecent()
        .map(
          (item) =>
            item.symbol,
        ),
      [
        'ETHUSDT',
      ],
    );
  },
);
