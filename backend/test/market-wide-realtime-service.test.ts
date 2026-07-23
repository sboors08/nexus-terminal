import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MarketWideRealtimeService,
  buildMarketWideStreamShards,
  parseBinanceMarketWideBookTicker,
} from '../src/modules/realtime-market-data/market-wide-realtime.service.js';
import type {
  RealtimeSocketEvent,
  RealtimeWebSocket,
  ReconnectScheduler,
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
  closeCode:
    number | undefined;

  closeReason:
    string | undefined;

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

  close(
    code?: number,
    reason?: string,
  ): void {
    this.closed = true;
    this.closeCode = code;
    this.closeReason = reason;
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

class TestScheduler
implements ReconnectScheduler {
  readonly tasks:
    Array<{
      callback: () => void;
      delayMs: number;
      cancelled: boolean;
    }> = [];

  schedule(
    callback: () => void,
    delayMs: number,
  ): unknown {
    const task = {
      callback,
      delayMs,
      cancelled: false,
    };

    this.tasks.push(task);

    return task;
  }

  cancel(
    handle: unknown,
  ): void {
    (
      handle as {
        cancelled: boolean;
      }
    ).cancelled = true;
  }
}

function klineMessage(
  symbol: string,
): string {
  return JSON.stringify({
    stream:
      `${symbol.toLowerCase()}@kline_1m`,
    data: {
      e: 'kline',
      E: 1_721_577_841_999,
      s: symbol,
      k: {
        t: 1_721_577_840_000,
        T: 1_721_577_899_999,
        s: symbol,
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

function bookTickerMessage(
  symbol: string,
): string {
  return JSON.stringify({
    stream:
      `${symbol.toLowerCase()}@bookTicker`,
    data: {
      s: symbol,
      b: '100.99',
      B: '300',
      a: '101.01',
      A: '200',
      E: 1_721_577_842_500,
    },
  });
}


test(
  'splits Futures market and public streams into separate bounded shards',
  () => {
    const shards =
      buildMarketWideStreamShards(
        [
          'SOLUSDT',
          'BTCUSDT',
          'ETHUSDT',
          'ADAUSDT',
          'XRPUSDT',
        ],
        4,
      );

    const marketShards =
      shards.filter(
        (shard) =>
          shard.route === 'market',
      );

    const publicShards =
      shards.filter(
        (shard) =>
          shard.route === 'public',
      );

    assert.equal(
      shards.length,
      4,
    );

    assert.equal(
      marketShards.length,
      2,
    );

    assert.equal(
      publicShards.length,
      2,
    );

    assert.ok(
      shards.every(
        (shard) =>
          shard.streams.length <= 4,
      ),
    );

    assert.deepEqual(
      marketShards[0]?.streams,
      [
        'adausdt@kline_1m',
        'btcusdt@kline_1m',
        'ethusdt@kline_1m',
        'solusdt@kline_1m',
      ],
    );

    assert.deepEqual(
      publicShards[0]?.streams,
      [
        'adausdt@bookTicker',
        'btcusdt@bookTicker',
        'ethusdt@bookTicker',
        'solusdt@bookTicker',
      ],
    );
  },
);

test(
  'parses a Binance market-wide book ticker',
  () => {
    const ticker =
      parseBinanceMarketWideBookTicker(
        {
          s: 'SOLUSDT',
          b: '100.99',
          B: '300',
          a: '101.01',
          A: '200',
          E: 1_721_577_842_500,
        },
        '2024-07-20T12:04:02.500Z',
      );

    assert.equal(
      ticker.symbol,
      'SOLUSDT',
    );

    assert.equal(
      ticker.bidPrice,
      100.99,
    );

    assert.equal(
      ticker.askPrice,
      101.01,
    );

    assert.ok(
      ticker.spreadPct > 0,
    );
  },
);


test(
  'connects Futures market and public shards and builds scanner metrics',
  () => {
    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
          'SOLUSDT',
          'ETHUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
        socketFactory: (url) => {
          urls.push(url);

          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
        now: () =>
          new Date(
            '2024-07-20T12:04:03.000Z',
          ),
      });

    service.start();

    assert.equal(
      sockets.length,
      2,
    );

    assert.equal(
      service.getStatus()
        .socketCount,
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

    for (const socket of sockets) {
      socket.emit('open');
    }

    assert.equal(
      service.getStatus().state,
      'connected',
    );

    const marketSocket =
      sockets[marketSocketIndex];

    const publicSocket =
      sockets[publicSocketIndex];

    assert.ok(marketSocket);
    assert.ok(publicSocket);

    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'SOLUSDT',
          ),
      },
    );

    publicSocket.emit(
      'message',
      {
        data:
          bookTickerMessage(
            'SOLUSDT',
          ),
      },
    );

    const metric =
      service.getMetrics(
        'SOLUSDT',
      )[0];

    assert.ok(metric);

    assert.equal(
      metric.price,
      101,
    );

    assert.equal(
      metric.quoteVolume,
      125000,
    );

    assert.equal(
      metric.tradesCount,
      400,
    );

    assert.ok(
      metric.liquidityScore
      !== null,
    );

    assert.equal(
      service.getStatus()
        .lastMessageAt,
      '2024-07-20T12:04:03.000Z',
    );

    service.stop();

    assert.ok(
      sockets.every(
        (socket) =>
          socket.closed,
      ),
    );
  },
);


test(
  'rebuilds Futures market and public sockets when the universe changes',
  () => {
    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
        socketFactory: (url) => {
          urls.push(url);

          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
      });

    service.start();

    assert.equal(
      sockets.length,
      2,
    );

    const initialSockets =
      [...sockets];

    const changes =
      service.replaceSymbols([
        'BTCUSDT',
        'NEWUSDT',
        'SOLUSDT',
      ]);

    assert.deepEqual(
      changes.addedSymbols,
      [
        'NEWUSDT',
        'SOLUSDT',
      ],
    );

    assert.ok(
      initialSockets.every(
        (socket) =>
          socket.closed,
      ),
    );

    assert.equal(
      service.getSymbols().length,
      3,
    );

    assert.equal(
      service.getStatus()
        .socketCount,
      2,
    );

    assert.ok(
      urls.some(
        (url) =>
          url.includes(
            '/market/stream?streams=',
          ),
      ),
    );

    assert.ok(
      urls.some(
        (url) =>
          url.includes(
            '/public/stream?streams=',
          ),
      ),
    );

    service.stop();
  },
);


test(
  'reconnects only the failed Futures shard with exponential delay',
  () => {
    const scheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          250,
        reconnectMaxDelayMs:
          2_000,
        scheduler,
        socketFactory: (url) => {
          urls.push(url);

          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
      });

    service.start();

    assert.equal(
      sockets.length,
      2,
    );

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/market/stream?streams=',
          ),
      );

    assert.notEqual(
      marketSocketIndex,
      -1,
    );

    sockets[marketSocketIndex]?.emit(
      'close',
      {
        code: 1006,
        reason:
          'network failure',
      },
    );

    assert.equal(
      scheduler.tasks.length,
      1,
    );

    assert.equal(
      scheduler.tasks[0]
        ?.delayMs,
      250,
    );

    assert.equal(
      service.getStatus().state,
      'reconnecting',
    );

    scheduler.tasks[0]
      ?.callback();

    assert.equal(
      sockets.length,
      3,
    );

    service.stop();
  },
);
test(
  'accepts historical candles before realtime starts',
  () => {
    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'SOLUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
      });

    const firstOpenTime =
      Date.parse(
        '2024-07-20T12:00:00.000Z',
      );

    const buildHistoricalKline = (
      minute: number,
      close: number,
      quoteVolume: number,
      tradesCount: number,
    ) => {
      const openTime =
        firstOpenTime
        + minute * 60_000;

      const closeTime =
        openTime + 59_999;

      return {
        symbol: 'SOLUSDT',
        eventTime:
          new Date(
            closeTime,
          ).toISOString(),
        openTime:
          new Date(
            openTime,
          ).toISOString(),
        closeTime:
          new Date(
            closeTime,
          ).toISOString(),
        open:
          close - 1,
        high:
          close + 1,
        low:
          close - 2,
        close,
        quoteVolume,
        tradesCount,
        takerBuyQuoteVolume:
          quoteVolume / 2,
        isClosed: true,
      };
    };

    const appliedCount =
      service.applyHistoricalKlines([
        buildHistoricalKline(
          0,
          101,
          1_000,
          10,
        ),
        buildHistoricalKline(
          1,
          103,
          2_000,
          20,
        ),
        buildHistoricalKline(
          2,
          104,
          3_000,
          30,
        ),
      ]);

    assert.equal(
      appliedCount,
      3,
    );

    const metric =
      service.getMetrics(
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