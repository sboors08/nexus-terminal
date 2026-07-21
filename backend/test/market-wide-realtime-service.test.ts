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
  'splits market-wide symbols into bounded stream shards',
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

    assert.equal(
      shards.length,
      3,
    );

    assert.deepEqual(
      shards.map(
        (shard) =>
          shard.symbols.length,
      ),
      [
        2,
        2,
        1,
      ],
    );

    assert.ok(
      shards.every(
        (shard) =>
          shard.streams.length
          <= 4,
      ),
    );

    assert.deepEqual(
      shards[0]?.streams,
      [
        'adausdt@kline_1m',
        'adausdt@bookTicker',
        'btcusdt@kline_1m',
        'btcusdt@bookTicker',
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
  'connects all shards and builds real scanner metrics',
  () => {
    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://stream.binance.com:9443',
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

    assert.ok(
      urls.every(
        (url) =>
          url.startsWith(
            'wss://stream.binance.com:9443/stream?streams=',
          ),
      ),
    );

    for (const socket of sockets) {
      socket.emit('open');
    }

    assert.equal(
      service.getStatus().state,
      'connected',
    );

    const solShardIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            'solusdt@kline_1m',
          ),
      );

    assert.notEqual(
      solShardIndex,
      -1,
    );

    const solSocket =
      sockets[solShardIndex];

    assert.ok(solSocket);

    solSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'SOLUSDT',
          ),
      },
    );

    solSocket.emit(
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
  'rebuilds market-wide sockets when the symbol universe changes',
  () => {
    const sockets:
      TestSocket[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://stream.binance.com:9443',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
        socketFactory: () => {
          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
      });

    service.start();

    assert.equal(
      sockets.length,
      1,
    );

    const firstSocket =
      sockets[0];

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

    assert.equal(
      firstSocket?.closed,
      true,
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

    service.stop();
  },
);

test(
  'reconnects a failed market-wide shard with exponential delay',
  () => {
    const scheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://stream.binance.com:9443',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket: 4,
        reconnectBaseDelayMs:
          250,
        reconnectMaxDelayMs:
          2_000,
        scheduler,
        socketFactory: () => {
          const socket =
            new TestSocket();

          sockets.push(socket);

          return socket;
        },
      });

    service.start();

    sockets[0]?.emit(
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
      2,
    );

    service.stop();
  },
);