import assert from 'node:assert/strict';
import { get } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import {
  createCandles,
  marketSymbols,
} from '../src/modules/api-contract/fixtures.js';
import type {
  MarketDataProvider,
} from '../src/modules/market-data/market-data.provider.js';
import type {
  GetOrderBookDepthSnapshotOptions,
  OrderBookDepthRuntimeEvent,
  OrderBookDepthRuntimeListener,
  OrderBookDepthRuntimeService,
  OrderBookDepthRuntimeSnapshot,
} from '../src/modules/realtime-market-data/order-book-depth-runtime.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

const fixtureProvider:
MarketDataProvider = {
  getMarketSymbols:
    async () =>
      marketSymbols,
  getCandles:
    async (
      symbol,
      timeframe,
    ) =>
      createCandles(
        symbol,
        timeframe,
      ),
};

const snapshotFixture:
OrderBookDepthRuntimeSnapshot = {
  symbol: 'BTCUSDT',
  state: 'live',
  synchronized: true,
  lastUpdateId: 103,
  bids: [
    {
      price: 64_000,
      quantity: 2,
      quoteValue: 128_000,
    },
  ],
  asks: [
    {
      price: 64_001,
      quantity: 1.5,
      quoteValue: 96_001.5,
    },
  ],
  buckets: null,
  metrics: {
    symbol: 'BTCUSDT',
    synchronized: true,
    bestBid: 64_000,
    bestAsk: 64_001,
    midpoint: 64_000.5,
    spread: 1,
    spreadPct: 0.0015624877930641166,
    depthRangePct: 0.2,
    bidDepthQuote: 128_000,
    askDepthQuote: 96_001.5,
    totalDepthQuote: 224_001.5,
    imbalancePct: 14.284726441786327,
    updatedAt: '2026-07-28T19:00:00.000Z',
  },
  updatedAt: '2026-07-28T19:00:00.000Z',
  ageMs: 0,
  staleAfterMs: 5_000,
  lastError: null,
};

class FakeOrderBookDepthService
implements OrderBookDepthRuntimeService {
  private readonly listeners =
    new Set<{
      listener:
        OrderBookDepthRuntimeListener;
      symbol?: string;
    }>();

  starts = 0;
  stops = 0;
  acquires = 0;
  releases = 0;
  lastSnapshotOptions:
    GetOrderBookDepthSnapshotOptions
    | null = null;

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
    this.listeners.clear();
  }

  getStatus() {
    return {
      state: 'connected' as const,
      connectedAt: '2026-07-28T19:00:00.000Z',
      disconnectedAt: null,
      lastMessageAt: '2026-07-28T19:00:00.000Z',
      reconnectAttempts: 0,
      subscribedSymbols: [
        'BTCUSDT',
      ],
      streamCount: 1,
      lastError: null,
    };
  }

  getSnapshot(
    symbol: string,
    options:
      GetOrderBookDepthSnapshotOptions = {},
  ): OrderBookDepthRuntimeSnapshot | null {
    this.lastSnapshotOptions = {
      ...options,
    };

    if (symbol !== 'BTCUSDT') {
      return null;
    }

    return {
      ...snapshotFixture,
      bids:
        snapshotFixture.bids.map(
          (level) => ({
            ...level,
          }),
        ),
      asks:
        snapshotFixture.asks.map(
          (level) => ({
            ...level,
          }),
        ),
      metrics: {
        ...snapshotFixture.metrics,
      },
    };
  }

  acquireSymbol(): () => void {
    this.acquires += 1;

    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      this.releases += 1;
    };
  }

  subscribe(
    listener: OrderBookDepthRuntimeListener,
    symbol?: string,
  ): () => void {
    const subscription =
      symbol === undefined
        ? { listener }
        : {
            listener,
            symbol,
          };

    this.listeners.add(
      subscription,
    );

    return () => {
      this.listeners.delete(
        subscription,
      );
    };
  }

  emit(
    event: OrderBookDepthRuntimeEvent,
  ): void {
    for (const subscription of this.listeners) {
      if (
        event.type === 'snapshot'
        && subscription.symbol
        && subscription.symbol
          !== event.symbol
      ) {
        continue;
      }

      subscription.listener(
        event,
      );
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

test(
  'order book routes expose status and a configurable snapshot',
  async (t) => {
    const orderBookDepthService =
      new FakeOrderBookDepthService();

    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider:
          fixtureProvider,
        realtimeMarketDataService:
          null,
        orderBookDepthService,
      });

    t.after(
      async () =>
        app.close(),
    );

    await app.ready();

    assert.equal(
      orderBookDepthService.starts,
      1,
    );

    const statusResponse =
      await app.inject({
        method: 'GET',
        url: '/api/v1/market/order-book/status',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );

    assert.equal(
      statusResponse.json().state,
      'connected',
    );

    const snapshotResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/order-book/snapshot'
          + '?symbol=BTCUSDT'
          + '&levels=25'
          + '&depthRangePct=0.5'
          + '&bucketSize=10'
          + '&maxBuckets=20',
      });

    assert.equal(
      snapshotResponse.statusCode,
      200,
    );

    assert.equal(
      snapshotResponse.json()
        .symbol,
      'BTCUSDT',
    );

    assert.deepEqual(
      orderBookDepthService
        .lastSnapshotOptions,
      {
        levelsLimit: 25,
        depthRangePct: 0.5,
        bucketSize: 10,
        maxBucketsPerSide: 20,
      },
    );
  },
);

test(
  'order book routes validate symbol and snapshot options',
  async (t) => {
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider:
          fixtureProvider,
        realtimeMarketDataService:
          null,
        orderBookDepthService:
          new FakeOrderBookDepthService(),
      });

    t.after(
      async () =>
        app.close(),
    );

    const missingSymbol =
      await app.inject({
        method: 'GET',
        url: '/api/v1/market/order-book/snapshot',
      });

    assert.equal(
      missingSymbol.statusCode,
      400,
    );

    assert.equal(
      missingSymbol.json().error,
      'symbol_required',
    );

    const invalidOptions =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/order-book/snapshot'
          + '?symbol=BTCUSDT'
          + '&levels=0',
      });

    assert.equal(
      invalidOptions.statusCode,
      400,
    );

    assert.equal(
      invalidOptions.json().error,
      'invalid_order_book_options',
    );

    const unknownSymbol =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/order-book/snapshot'
          + '?symbol=ETHUSDT',
      });

    assert.equal(
      unknownSymbol.statusCode,
      404,
    );
  },
);

test(
  'order book SSE acquires the selected symbol and cleans up after disconnect',
  async (t) => {
    const orderBookDepthService =
      new FakeOrderBookDepthService();

    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider:
          fixtureProvider,
        realtimeMarketDataService:
          null,
        orderBookDepthService,
      });

    await app.listen({
      host: '127.0.0.1',
      port: 0,
    });

    t.after(
      async () =>
        app.close(),
    );

    const address =
      (app.server.address() as AddressInfo);

    const body =
      await new Promise<string>(
        (
          resolve,
          reject,
        ) => {
          let settled = false;

          const timeout =
            setTimeout(
              () => {
                if (settled) {
                  return;
                }

                settled = true;
                reject(
                  new Error(
                    'Timed out waiting for order book SSE payload',
                  ),
                );
              },
              2_000,
            );

          const request =
            get(
              {
                host: '127.0.0.1',
                port:
                  address.port,
                path:
                  '/api/v1/market/order-book/stream'
                  + '?symbol=BTCUSDT'
                  + '&levels=20',
                headers: {
                  accept:
                    'text/event-stream',
                },
              },
              (response) => {
                assert.match(
                  response.headers[
                    'content-type'
                  ]
                  ?? '',
                  /^text\/event-stream/u,
                );

                let payload = '';
                response.setEncoding(
                  'utf8',
                );

                response.on(
                  'data',
                  (chunk: string) => {
                    payload += chunk;

                    if (
                      !settled
                      && payload.includes(
                        'event: status',
                      )
                      && payload.includes(
                        'event: snapshot',
                      )
                      && payload.includes(
                        '"symbol":"BTCUSDT"',
                      )
                    ) {
                      settled = true;
                      clearTimeout(timeout);
                      resolve(payload);
                      response.destroy();
                    }
                  },
                );
              },
            );

          request.on(
            'error',
            (error) => {
              if (settled) {
                return;
              }

              settled = true;
              clearTimeout(timeout);
              reject(error);
            },
          );
        },
      );

    assert.match(
      body,
      /retry: 3000/u,
    );

    assert.equal(
      orderBookDepthService.acquires,
      1,
    );

    await new Promise<void>(
      (
        resolve,
        reject,
      ) => {
        const deadline =
          Date.now()
          + 1_000;

        const checkCleanup = () => {
          if (
            orderBookDepthService
              .listenerCount
              === 0
            && orderBookDepthService
              .releases
              === 1
          ) {
            resolve();
            return;
          }

          if (
            Date.now()
            >= deadline
          ) {
            reject(
              new Error(
                'Order book SSE subscription was not cleaned up',
              ),
            );
            return;
          }

          setTimeout(
            checkCleanup,
            10,
          );
        };

        checkCleanup();
      },
    );
  },
);
