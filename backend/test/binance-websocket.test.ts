import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';
import { createCandles, marketSymbols } from '../src/modules/api-contract/fixtures.js';
import type { MarketDataProvider } from '../src/modules/market-data/market-data.provider.js';
import { BinanceWebSocketMarketDataService } from '../src/modules/realtime-market-data/binance-websocket.service.js';
import type {
  RealtimeMarketDataEvent,
  RealtimeMarketDataService,
  RealtimeSocketEvent,
  RealtimeSymbolSnapshot,
  RealtimeWebSocket,
  ReconnectScheduler,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

class FakeSocket implements RealtimeWebSocket {
  private readonly listeners = new Map<string, Array<(event: RealtimeSocketEvent) => void>>();
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: RealtimeSocketEvent) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ ...(code === undefined ? {} : { code }), ...(reason === undefined ? {} : { reason }) });
  }

  emit(type: 'open' | 'message' | 'error' | 'close', event: RealtimeSocketEvent = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

const fixtureProvider: MarketDataProvider = {
  getMarketSymbols: async () => marketSymbols,
  getCandles: async (symbol, timeframe) => createCandles(symbol, timeframe),
};

test(
  'Binance Futures WebSocket service joins aggTrade and bookTicker and reconnects one route',
  () => {
    const sockets: FakeSocket[] = [];
    const urls: string[] = [];

    const scheduled:
      Array<{
        callback: () => void;
        delayMs: number;
      }> = [];

    const scheduler: ReconnectScheduler = {
      schedule(callback, delayMs) {
        const handle = {
          callback,
          delayMs,
        };

        scheduled.push(handle);

        return handle;
      },

      cancel(handle) {
        const index =
          scheduled.indexOf(
            handle as {
              callback: () => void;
              delayMs: number;
            },
          );

        if (index >= 0) {
          scheduled.splice(index, 1);
        }
      },
    };

    let currentTime =
      new Date(
        '2026-07-18T16:00:00.000Z',
      );

    const service =
      new BinanceWebSocketMarketDataService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
          'ETHUSDT',
        ],
        reconnectBaseDelayMs: 1_000,
        reconnectMaxDelayMs: 30_000,
        tradesBufferSize: 2,

        socketFactory(url) {
          urls.push(url);

          const socket =
            new FakeSocket();

          sockets.push(socket);

          return socket;
        },

        scheduler,
        now: () => currentTime,
      });

    const deliveredEvents:
      RealtimeMarketDataEvent[] = [];

    const unsubscribe =
      service.subscribe(
        (event) =>
          deliveredEvents.push(event),
        'BTCUSDT',
      );

    service.start();

    assert.equal(
      service.getStatus().state,
      'connecting',
    );

    assert.equal(
      sockets.length,
      2,
    );

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.startsWith(
            'wss://fstream.binance.com/market/stream?streams=',
          ),
      );

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.startsWith(
            'wss://fstream.binance.com/public/stream?streams=',
          ),
      );

    assert.notEqual(
      marketSocketIndex,
      -1,
    );

    assert.notEqual(
      publicSocketIndex,
      -1,
    );

    assert.match(
      urls[marketSocketIndex] ?? '',
      /btcusdt@aggTrade\/ethusdt@aggTrade/,
    );

    assert.match(
      urls[publicSocketIndex] ?? '',
      /btcusdt@bookTicker\/ethusdt@bookTicker/,
    );

    const marketSocket =
      sockets[marketSocketIndex];

    const publicSocket =
      sockets[publicSocketIndex];

    assert.ok(marketSocket);
    assert.ok(publicSocket);

    marketSocket.emit('open');

    assert.equal(
      service.getStatus().state,
      'connecting',
    );

    publicSocket.emit('open');

    assert.equal(
      service.getStatus().state,
      'connected',
    );

    marketSocket.emit('message', {
      data: JSON.stringify({
        stream:
          'btcusdt@aggTrade',
        data: {
          E: 1_784_390_400_000,
          s: 'BTCUSDT',
          a: 101,
          p: '64000.5',
          q: '0.25',
          f: 201,
          l: 204,
          T: 1_784_390_400_000,
          m: false,
        },
      }),
    });

    publicSocket.emit('message', {
      data: JSON.stringify({
        stream:
          'btcusdt@bookTicker',
        data: {
          E: 1_784_390_400_000,
          s: 'BTCUSDT',
          b: '64000.0',
          B: '1.2',
          a: '64001.0',
          A: '0.8',
        },
      }),
    });

    const snapshot =
      service.getSnapshots(
        'BTCUSDT',
      )[0];

    assert.equal(
      snapshot?.lastTrade?.side,
      'buy',
    );

    assert.equal(
      snapshot?.lastTrade?.quoteValue,
      16_000.125,
    );

    assert.equal(
      snapshot?.lastTrade?.tradesCount,
      4,
    );

    assert.equal(
      snapshot?.bookTicker?.spread,
      1,
    );

    assert.equal(
      snapshot?.recentTrades.length,
      1,
    );

    const scannerMetrics =
      service.getScannerMetrics(
        'BTCUSDT',
      )[0];

    assert.equal(
      scannerMetrics?.price,
      64_000.5,
    );

    assert.equal(
      scannerMetrics?.quoteVolume,
      16_000.125,
    );

    assert.equal(
      scannerMetrics?.tradesCount,
      4,
    );

    assert.equal(
      scannerMetrics?.tradesPerMinute,
      4,
    );

    assert.equal(
      scannerMetrics?.buyTradesCount,
      4,
    );

    assert.equal(
      scannerMetrics?.volatilityPct,
      null,
    );

    assert.ok(
      scannerMetrics?.spreadPct
      !== null,
    );

    assert.equal(
      scannerMetrics?.topBookQuoteValue,
      128_000.8,
    );

    currentTime =
      new Date(
        '2026-07-18T16:01:01.000Z',
      );

    const expiredMetrics =
      service.getScannerMetrics(
        'BTCUSDT',
      )[0];

    assert.equal(
      expiredMetrics?.tradesCount,
      0,
    );

    assert.equal(
      expiredMetrics?.quoteVolume,
      0,
    );

    assert.equal(
      service.getStatus().lastMessageAt,
      '2026-07-18T16:00:00.000Z',
    );

    assert.equal(
      deliveredEvents.filter(
        (event) =>
          event.type === 'snapshot',
      ).length,
      2,
    );

    marketSocket.emit(
      'close',
      {
        code: 1006,
        reason: 'network lost',
      },
    );

    assert.equal(
      service.getStatus().state,
      'reconnecting',
    );

    assert.equal(
      scheduled.length,
      1,
    );

    assert.equal(
      scheduled[0]?.delayMs,
      1_000,
    );

    assert.equal(
      publicSocket.closeCalls.length,
      0,
    );

    const reconnect =
      scheduled.shift();

    assert.ok(reconnect);

    reconnect.callback();

    assert.equal(
      sockets.length,
      3,
    );

    assert.ok(
      (urls[2] ?? '').startsWith(
        'wss://fstream.binance.com/market/stream?streams=',
      ),
    );

    const reconnectedMarketSocket =
      sockets[2];

    assert.ok(
      reconnectedMarketSocket,
    );

    reconnectedMarketSocket.emit(
      'open',
    );

    assert.equal(
      service.getStatus().state,
      'connected',
    );

    unsubscribe();
    service.stop();

    assert.equal(
      service.getStatus().state,
      'stopped',
    );

    assert.equal(
      publicSocket.closeCalls[0]?.code,
      1000,
    );

    assert.equal(
      reconnectedMarketSocket
        .closeCalls[0]
        ?.code,
      1000,
    );
  },
);

test('Realtime market endpoints expose connection state and snapshots', async () => {
  let starts = 0;
  let stops = 0;
  const snapshots: RealtimeSymbolSnapshot[] = [{
    symbol: 'BTCUSDT',
    lastTrade: null,
    bookTicker: null,
    recentTrades: [],
    updatedAt: null,
  }];
  const realtimeService: RealtimeMarketDataService = {
    start() { starts += 1; },
    stop() { stops += 1; },
    getStatus: () => ({
      state: 'connected',
      connectedAt: '2026-07-18T16:00:00.000Z',
      disconnectedAt: null,
      lastMessageAt: null,
      reconnectAttempts: 0,
      subscribedSymbols: ['BTCUSDT'],
      streamCount: 2,
      lastError: null,
    }),
    getSnapshots: (symbol) => symbol && symbol !== 'BTCUSDT' ? [] : snapshots,
    getScannerMetrics: (symbol) =>
      symbol && symbol !== 'BTCUSDT'
        ? []
        : [
            {
              symbol: 'BTCUSDT',
              scannerWindow: '1m',
              windowMs: 60_000,
              price: 64_000.5,
              priceChangePct: 0.25,
              volatilityPct: 0.4,
              spreadPct: 0.01,
              topBookQuoteValue:
                100_000,
              orderBookImbalancePct:
                12.5,
              liquidityScore: 8,
              activityScore: 88,
              quoteVolume: 250_000,
              tradesCount: 42,
              tradesPerMinute: 42,
              buyTradesCount: 25,
              sellTradesCount: 17,
              buyQuoteVolume: 150_000,
              sellQuoteVolume: 100_000,
              windowStartedAt:
                '2026-07-18T15:59:10.000Z',
              updatedAt:
                '2026-07-18T16:00:00.000Z',
            },
          ],
    acquireSymbol: () => () => undefined,
    subscribe: () => () => undefined,
  };

  const app = await buildApp({
    env: testEnv,
    marketDataProvider: fixtureProvider,
    realtimeMarketDataService: realtimeService,
  });

  const status = await app.inject({ method: 'GET', url: '/api/v1/market/realtime/status' });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().state, 'connected');
  assert.equal(starts, 1);

  const snapshot = await app.inject({
    method: 'GET',
    url: '/api/v1/market/realtime/snapshot?symbol=BTCUSDT',
  });
  assert.equal(snapshot.statusCode, 200);
  assert.equal(snapshot.json()[0].symbol, 'BTCUSDT');

  const scannerMetrics = await app.inject({
    method: 'GET',
    url:
      '/api/v1/market/realtime/scanner-metrics'
      + '?symbols=BTCUSDT',
  });

  assert.equal(
    scannerMetrics.statusCode,
    200,
  );

  assert.equal(
    scannerMetrics.json()[0].symbol,
    'BTCUSDT',
  );

  assert.equal(
    scannerMetrics.json()[0].tradesCount,
    42,
  );

  assert.equal(
    scannerMetrics.json()[0].quoteVolume,
    250_000,
  );

  assert.equal(
    scannerMetrics.json()[0].activityScore,
    88,
  );

  const missingMetrics = await app.inject({
    method: 'GET',
    url:
      '/api/v1/market/realtime/scanner-metrics'
      + '?symbol=SOLUSDT',
  });

  assert.equal(
    missingMetrics.statusCode,
    404,
  );

  assert.equal(
    missingMetrics.json().error,
    'symbol_not_subscribed',
  );

  await app.close();
  assert.equal(stops, 1);
});

test(
  'calculates BTC correlation and relative strength in scanner metrics',
  () => {
    const sockets: FakeSocket[] = [];
    const urls: string[] = [];

    const currentTime =
      new Date(
        '2026-07-21T12:00:40.000Z',
      );

    const service =
      new BinanceWebSocketMarketDataService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
          'SOLUSDT',
        ],
        reconnectBaseDelayMs: 1_000,
        reconnectMaxDelayMs: 30_000,
        tradesBufferSize: 100,
        socketFactory(url) {
          urls.push(url);

          const socket = new FakeSocket();

          sockets.push(socket);

          return socket;
        },
        now: () => currentTime,
      });

    service.start();

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.startsWith(
            'wss://fstream.binance.com/market/stream?streams=',
          ),
      );

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.startsWith(
            'wss://fstream.binance.com/public/stream?streams=',
          ),
      );

    assert.notEqual(
      marketSocketIndex,
      -1,
    );

    assert.notEqual(
      publicSocketIndex,
      -1,
    );

    const marketSocket =
      sockets[marketSocketIndex];

    const publicSocket =
      sockets[publicSocketIndex];

    assert.ok(marketSocket);
    assert.ok(publicSocket);

    marketSocket.emit('open');
    publicSocket.emit('open');

    const emitTrade = (
      symbol: string,
      tradeId: number,
      timestamp: string,
      price: number,
    ): void => {
      const timestampMs =
        Date.parse(timestamp);

      marketSocket.emit('message', {
        data: JSON.stringify({
          stream:
            `${symbol.toLowerCase()}@aggTrade`,
          data: {
            E: timestampMs,
            s: symbol,
            a: tradeId,
            p: String(price),
            q: '1',
            f: tradeId,
            l: tradeId,
            T: timestampMs,
            m: false,
          },
        }),
      });
    };

    const timestamps = [
      '2026-07-21T12:00:01.000Z',
      '2026-07-21T12:00:11.000Z',
      '2026-07-21T12:00:21.000Z',
      '2026-07-21T12:00:31.000Z',
    ];

    const btcPrices = [
      100,
      110,
      104.5,
      125.4,
    ];

    const solPrices = [
      200,
      220,
      209,
      250.8,
    ];

    for (
      let index = 0;
      index < timestamps.length;
      index += 1
    ) {
      emitTrade(
        'BTCUSDT',
        1_000 + index,
        timestamps[index]!,
        btcPrices[index]!,
      );

      emitTrade(
        'SOLUSDT',
        2_000 + index,
        timestamps[index]!,
        solPrices[index]!,
      );
    }

    const solMetrics =
      service.getScannerMetrics(
        'SOLUSDT',
        '1m',
      )[0];

    assert.ok(solMetrics);

    assert.ok(
      solMetrics.btcCorrelation !== null,
    );

    assert.ok(
      Math.abs(
        solMetrics.btcCorrelation - 1,
      ) < 1e-12,
    );

    assert.ok(
      solMetrics.relativeStrengthPct
      !== null,
    );

    assert.ok(
      Math.abs(
        solMetrics.relativeStrengthPct,
      ) < 1e-12,
    );

    const btcMetrics =
      service.getScannerMetrics(
        'BTCUSDT',
        '1m',
      )[0];

    assert.ok(btcMetrics);

    assert.ok(
      btcMetrics.btcCorrelation !== null,
    );

    assert.ok(
      Math.abs(
        btcMetrics.btcCorrelation - 1,
      ) < 1e-12,
    );

    assert.equal(
      btcMetrics.relativeStrengthPct,
      0,
    );

    service.stop();
  },
);