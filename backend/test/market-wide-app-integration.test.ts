import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  BinanceSymbolUniverseService,
} from '../src/modules/realtime-market-data/binance-symbol-universe.service.js';
import {
  MarketWideRealtimeService,
} from '../src/modules/realtime-market-data/market-wide-realtime.service.js';
import type {
  RealtimeSocketEvent,
  RealtimeWebSocket,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

class TestSocket
implements RealtimeWebSocket {
  readonly listeners =
    new Map<
      string,
      Array<
        (
          event:
            RealtimeSocketEvent,
        ) => void
      >
    >();

  closed = false;

  addEventListener(
    type:
      | 'open'
      | 'message'
      | 'error'
      | 'close',
    listener:
      (
        event:
          RealtimeSocketEvent,
      ) => void,
  ): void {
    const listeners =
      this.listeners.get(type)
      ?? [];

    listeners.push(listener);

    this.listeners.set(
      type,
      listeners,
    );
  }

  close(): void {
    this.closed = true;
  }

  emit(
    type:
      | 'open'
      | 'message'
      | 'error'
      | 'close',
    event:
      RealtimeSocketEvent = {},
  ): void {
    for (
      const listener
      of this.listeners.get(type)
      ?? []
    ) {
      listener(event);
    }
  }
}

const testEnv:
AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

function createExchangeInfoResponse():
Response {
  return new Response(
    JSON.stringify({
      symbols: [
        {
          symbol: 'BTCUSDT',
          status: 'TRADING',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          isSpotTradingAllowed:
            true,
          permissionSets: [
            ['SPOT'],
          ],
        },
        {
          symbol: 'SOLUSDT',
          status: 'TRADING',
          baseAsset: 'SOL',
          quoteAsset: 'USDT',
          isSpotTradingAllowed:
            true,
          permissionSets: [
            ['SPOT'],
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: {
        'content-type':
          'application/json',
      },
    },
  );
}

function createKlineMessage():
string {
  return JSON.stringify({
    stream:
      'solusdt@kline_1m',
    data: {
      e: 'kline',
      E: 1_721_577_841_999,
      s: 'SOLUSDT',
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
      },
    },
  });
}

function createBookTickerMessage():
string {
  return JSON.stringify({
    stream:
      'solusdt@bookTicker',
    data: {
      s: 'SOLUSDT',
      b: '100.99',
      B: '300',
      a: '101.01',
      A: '200',
      E: 1_721_577_842_500,
    },
  });
}

test(
  'app starts market-wide runtime from Binance symbol universe and exposes metrics',
  async () => {
    const sockets:
      TestSocket[] = [];

    const universe =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          60_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          15 * 60 * 1000,
        fetchImpl: async () =>
          createExchangeInfoResponse(),
        now: () =>
          new Date(
            '2026-07-21T12:00:00.000Z',
          ),
      });

    const marketWide =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://stream.binance.com:9443',
        symbols: [],
        maxStreamsPerSocket:
          800,
        reconnectBaseDelayMs:
          1_000,
        reconnectMaxDelayMs:
          30_000,
        socketFactory: () => {
          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
        now: () =>
          new Date(
            '2026-07-21T12:00:30.000Z',
          ),
      });

    const app =
      await buildApp({
        env: testEnv,
        realtimeMarketDataService:
          null,
        binanceSymbolUniverseService:
          universe,
        marketWideRealtimeService:
          marketWide,
      });

    const initialStatus =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/status',
      });

    assert.equal(
      initialStatus.statusCode,
      200,
    );

    assert.equal(
      sockets.length,
      1,
    );

    assert.equal(
      initialStatus
        .json()
        .symbolsCount,
      2,
    );

    assert.equal(
      initialStatus
        .json()
        .streamCount,
      4,
    );

    const socket =
      sockets[0];

    assert.ok(socket);

    socket.emit('open');

    socket.emit(
      'message',
      {
        data:
          createKlineMessage(),
      },
    );

    socket.emit(
      'message',
      {
        data:
          createBookTickerMessage(),
      },
    );

    const statusResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/status',
      });

    assert.equal(
      statusResponse
        .json()
        .state,
      'connected',
    );

    const metricsResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/scanner-metrics?symbol=SOLUSDT',
      });

    assert.equal(
      metricsResponse.statusCode,
      200,
    );

    const metrics =
      metricsResponse.json();

    assert.equal(
      metrics.length,
      1,
    );

    assert.equal(
      metrics[0].symbol,
      'SOLUSDT',
    );

    assert.equal(
      metrics[0].price,
      101,
    );

    assert.equal(
      metrics[0].quoteVolume,
      125000,
    );

    assert.equal(
      metrics[0].tradesCount,
      400,
    );

    assert.ok(
      metrics[0].liquidityScore
      !== null,
    );

    await app.close();

    assert.equal(
      socket.closed,
      true,
    );

    assert.equal(
      universe
        .getSnapshot()
        .serviceState,
      'stopped',
    );
  },
);