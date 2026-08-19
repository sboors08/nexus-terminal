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
        v: '1234',
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
  'uses bounded kline shards and one all-book-ticker public shard',
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
          shard.route
          === 'market',
      );

    const publicShards =
      shards.filter(
        (shard) =>
          shard.route
          === 'public',
      );

    assert.equal(
      shards.length,
      3,
    );

    assert.equal(
      marketShards.length,
      2,
    );

    assert.equal(
      publicShards.length,
      1,
    );

    assert.ok(
      marketShards.every(
        (shard) =>
          shard.streams.length
          <= 4,
      ),
    );

    assert.deepEqual(
      marketShards[0]
        ?.streams,
      [
        'adausdt@kline_1m',
        'btcusdt@kline_1m',
        'ethusdt@kline_1m',
        'solusdt@kline_1m',
      ],
    );

    assert.deepEqual(
      marketShards[1]
        ?.streams,
      [
        'xrpusdt@kline_1m',
      ],
    );

    assert.deepEqual(
      publicShards[0]
        ?.streams,
      [
        '!bookTicker',
      ],
    );

    assert.deepEqual(
      publicShards[0]
        ?.symbols,
      [
        'ADAUSDT',
        'BTCUSDT',
        'ETHUSDT',
        'SOLUSDT',
        'XRPUSDT',
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
  'consumes USD-M all-book-ticker events and ignores COIN-M without losing public stream health',
  () => {
    const reconnectScheduler =
      new TestScheduler();

    const watchdogScheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const eventTimeMs =
      1_721_577_842_500;

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',

        symbols: [
          'BTCUSDT',
          'SOLUSDT',
          'ETHUSDT',
          'ADAUSDT',
          'XRPUSDT',
        ],

        maxStreamsPerSocket:
          4,

        reconnectBaseDelayMs:
          250,

        reconnectMaxDelayMs:
          2_000,

        scheduler:
          reconnectScheduler,

        watchdogScheduler,

        silentStreamTimeoutMs:
          30_000,

        socketFactory: (url) => {
          urls.push(
            url,
          );

          const socket =
            new TestSocket();

          sockets.push(
            socket,
          );

          return socket;
        },

        now: () =>
          new Date(
            eventTimeMs
            + 500,
          ),
      });

    service.start();

    assert.equal(
      sockets.length,
      3,
    );

    assert.equal(
      service.getStatus()
        .socketCount,
      3,
    );

    assert.equal(
      service.getStatus()
        .streamCount,
      6,
    );

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/public/stream?streams=!bookTicker',
          ),
      );

    assert.notEqual(
      publicSocketIndex,
      -1,
    );

    for (const socket of sockets) {
      socket.emit(
        'open',
      );
    }

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      3,
    );

    const publicSocket =
      sockets[
        publicSocketIndex
      ];

    assert.ok(
      publicSocket,
    );

    publicSocket.emit(
      'message',
      {
        data:
          JSON.stringify({
            stream:
              '!bookTicker',

            data: {
              e:
                'bookTicker',
              u:
                400900217,
              E:
                eventTimeMs,
              T:
                eventTimeMs,
              s:
                'SOLUSDT',
              b:
                '100.99',
              B:
                '300',
              a:
                '101.01',
              A:
                '200',
              ps:
                'SOLUSDT',
              st:
                1,
            },
          }),
      },
    );

    const solState =
      service.getState(
        'SOLUSDT',
      );

    assert.ok(
      solState,
    );

    assert.equal(
      solState.bookTicker
        ?.bidPrice,
      100.99,
    );

    assert.equal(
      solState.bookTicker
        ?.askPrice,
      101.01,
    );

    assert.equal(
      service.getStatus()
        .lastError,
      null,
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      4,
    );

    /*
     * Current Binance all-bookTicker also emits COIN-M.
     * BTCUSD_PERP must not pass through the USD-M symbol
     * parser/store, but the valid packet still proves that
     * the shared public stream is alive.
     */
    publicSocket.emit(
      'message',
      {
        data:
          JSON.stringify({
            stream:
              '!bookTicker',

            data: {
              e:
                'bookTicker',
              u:
                400900218,
              E:
                eventTimeMs,
              T:
                eventTimeMs,
              s:
                'BTCUSD_PERP',
              b:
                '100.00',
              B:
                '10',
              a:
                '101.00',
              A:
                '10',
              ps:
                'BTCUSD',
              st:
                2,
            },
          }),
      },
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      3,
    );

    assert.equal(
      service.getStatus()
        .reconnectAttempts,
      0,
    );

    assert.equal(
      service.getStatus()
        .lastError,
      null,
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      5,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      0,
    );

    /*
     * Binance !bookTicker also carries contracts that are not
     * part of the tracked NEXUS perpetual universe.
     *
     * This exact symbol shape was observed in the live soak.
     * It must keep the shared public transport healthy without
     * entering metrics and without polluting lastError.
     */
    publicSocket.emit(
      'message',
      {
        data:
          JSON.stringify({
            stream:
              '!bookTicker',

            data: {
              e:
                'bookTicker',
              u:
                400900219,
              E:
                eventTimeMs,
              T:
                eventTimeMs,
              s:
                'ETHUSDT_260925',
              b:
                '100.00',
              B:
                '10',
              a:
                '101.00',
              A:
                '10',
              ps:
                'ETHUSDT',
              st:
                1,
            },
          }),
      },
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .lastError,
      null,
    );

    assert.equal(
      service.getStatus()
        .reconnectAttempts,
      0,
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      6,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      0,
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

test(
  'publishes live candle updates without changing closed-kline subscriptions',
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
        maxStreamsPerSocket:
          10,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
        socketFactory: (url) => {
          urls.push(
            url,
          );

          const socket =
            new TestSocket();

          sockets.push(
            socket,
          );

          return socket;
        },
        now: () =>
          new Date(
            '2024-07-20T12:04:03.000Z',
          ),
      });

    const candles:
      Array<{
        symbol: string;
        timeframe: string;
        close: number;
        volume: number | null;
        isClosed: boolean;
      }> = [];

    const closedChanges:
      string[][] = [];

    const unrelatedCandles:
      string[] = [];

    const unsubscribeCandles =
      service.subscribeRealtimeCandles(
        'BTCUSDT',
        (candle) => {
          candles.push(
            candle,
          );
        },
      );

    const unsubscribeClosed =
      service.subscribeKlineChanges(
        (event) => {
          closedChanges.push(
            event.symbols,
          );
        },
      );

    const unsubscribeUnrelated =
      service.subscribeRealtimeCandles(
        'ETHUSDT',
        (candle) => {
          unrelatedCandles.push(
            candle.symbol,
          );
        },
      );

    service.start();

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/market/stream?',
          ),
      );

    assert.notEqual(
      marketSocketIndex,
      -1,
    );

    const marketSocket =
      sockets[
        marketSocketIndex
      ];

    assert.ok(
      marketSocket,
    );

    marketSocket.emit(
      'open',
    );

    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'BTCUSDT',
          ),
      },
    );

    assert.equal(
      candles.length,
      1,
    );

    assert.equal(
      candles[0]?.symbol,
      'BTCUSDT',
    );

    assert.equal(
      candles[0]?.timeframe,
      '1m',
    );

    assert.equal(
      candles[0]?.close,
      101,
    );

    assert.equal(
      candles[0]?.volume,
      1234,
    );

    assert.equal(
      candles[0]?.isClosed,
      false,
    );

    assert.equal(
      closedChanges.length,
      0,
    );

    assert.equal(
      unrelatedCandles.length,
      0,
    );

    const latest =
      service.getLatestRealtimeCandle(
        'BTCUSDT',
      );

    assert.equal(
      latest?.close,
      101,
    );

    assert.equal(
      latest?.volume,
      1234,
    );

    unsubscribeCandles();
    unsubscribeUnrelated();
    unsubscribeClosed();
    service.stop();
  },
);


test(
  'aggregates retained one-minute candles into an exact selected timeframe',
  () => {
    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket:
          10,
        reconnectBaseDelayMs:
          100,
        reconnectMaxDelayMs:
          1_000,
      });

    const bucketStart =
      Date.parse(
        '2024-07-20T12:00:00.000Z',
      );

    const applied =
      service.applyHistoricalKlines(
        Array.from(
          {
            length:
              5,
          },
          (
            _,
            index,
          ) => {
            const openTime =
              bucketStart
              + index * 60_000;

            const closeTime =
              openTime
              + 59_999;

            return {
              symbol:
                'BTCUSDT',
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
                100 + index,
              high:
                102 + index,
              low:
                99 + index,
              close:
                101 + index,
              volume:
                index + 1,
              quoteVolume:
                (
                  index + 1
                ) * 1_000,
              tradesCount:
                (
                  index + 1
                ) * 10,
              takerBuyQuoteVolume:
                (
                  index + 1
                ) * 500,
              isClosed:
                true,
            };
          },
        ),
      );

    assert.equal(
      applied,
      5,
    );

    const candle =
      service.getLatestRealtimeCandle(
        'BTCUSDT',
        '5m',
      );

    assert.ok(
      candle,
    );

    assert.equal(
      candle.timeframe,
      '5m',
    );

    assert.equal(
      candle.openTime,
      '2024-07-20T12:00:00.000Z',
    );

    assert.equal(
      candle.closeTime,
      '2024-07-20T12:04:59.999Z',
    );

    assert.equal(
      candle.open,
      100,
    );

    assert.equal(
      candle.high,
      106,
    );

    assert.equal(
      candle.low,
      99,
    );

    assert.equal(
      candle.close,
      105,
    );

    assert.equal(
      candle.volume,
      15,
    );

    assert.equal(
      candle.quoteVolume,
      15_000,
    );

    assert.equal(
      candle.tradesCount,
      150,
    );

    assert.equal(
      candle.isClosed,
      true,
    );
  },
);

test(
  'drops stale market-wide events without reconnecting healthy shards',
  () => {
    const reconnectScheduler =
      new TestScheduler();

    const watchdogScheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const eventTimeMs =
      1_721_577_841_999;

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',

        symbols: [
          'BTCUSDT',
        ],

        maxStreamsPerSocket:
          100,

        reconnectBaseDelayMs:
          250,

        reconnectMaxDelayMs:
          2_000,

        scheduler:
          reconnectScheduler,

        watchdogScheduler,

        silentStreamTimeoutMs:
          30_000,

        socketFactory: (url) => {
          urls.push(
            url,
          );

          const socket =
            new TestSocket();

          sockets.push(
            socket,
          );

          return socket;
        },

        now: () =>
          new Date(
            eventTimeMs
            + 60_001,
          ),
      });

    service.start();

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/market/stream?streams=',
          ),
      );

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/public/stream?streams=',
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
      sockets[
        marketSocketIndex
      ];

    const publicSocket =
      sockets[
        publicSocketIndex
      ];

    assert.ok(
      marketSocket,
    );

    assert.ok(
      publicSocket,
    );

    marketSocket.emit(
      'open',
    );

    publicSocket.emit(
      'open',
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      2,
    );

    const marketWatchdog =
      watchdogScheduler
        .tasks[0];

    const publicWatchdog =
      watchdogScheduler
        .tasks[1];

    assert.ok(
      marketWatchdog,
    );

    assert.ok(
      publicWatchdog,
    );

    /*
     * Both messages are over 30 seconds old relative
     * to service.now().
     */
    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'BTCUSDT',
          ),
      },
    );

    publicSocket.emit(
      'message',
      {
        data:
          bookTickerMessage(
            'BTCUSDT',
          ),
      },
    );

    /*
     * A stale packet must not destroy an otherwise
     * healthy WebSocket shard.
     */
    assert.equal(
      marketSocket.closed,
      false,
    );

    assert.equal(
      publicSocket.closed,
      false,
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      service.getStatus()
        .reconnectAttempts,
      0,
    );

    assert.equal(
      service.getStatus()
        .lastError,
      null,
    );

    /*
     * Stale data must not be counted as fresh traffic.
     */
    assert.equal(
      service.getStatus()
        .lastMessageAt,
      null,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      0,
    );

    /*
     * Most importantly: stale packets must not refresh
     * the watchdog. The original watchdogs stay armed.
     */
    assert.equal(
      watchdogScheduler
        .tasks.length,
      2,
    );

    assert.equal(
      marketWatchdog.cancelled,
      false,
    );

    assert.equal(
      publicWatchdog.cancelled,
      false,
    );

    /*
     * Stale market data is discarded instead of entering
     * retained metrics.
     */
    const metric =
      service.getMetrics(
        'BTCUSDT',
      )[0];

    assert.ok(
      metric,
    );

    assert.equal(
      metric.price,
      null,
    );

    assert.equal(
      metric.liquidityScore,
      null,
    );

    service.stop();
  },
);


test(
  'ignores late events from a shard replaced by silent-stream recovery',
  () => {
    const reconnectScheduler =
      new TestScheduler();

    const watchdogScheduler =
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

        maxStreamsPerSocket:
          100,

        reconnectBaseDelayMs:
          250,

        reconnectMaxDelayMs:
          2_000,

        scheduler:
          reconnectScheduler,

        watchdogScheduler,

        silentStreamTimeoutMs:
          1_000,

        socketFactory: (url) => {
          urls.push(
            url,
          );

          const socket =
            new TestSocket();

          sockets.push(
            socket,
          );

          return socket;
        },
      });

    service.start();

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/market/stream?streams=',
          ),
      );

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/public/stream?streams=',
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

    const oldMarketSocket =
      sockets[
        marketSocketIndex
      ];

    const publicSocket =
      sockets[
        publicSocketIndex
      ];

    assert.ok(
      oldMarketSocket,
    );

    assert.ok(
      publicSocket,
    );

    oldMarketSocket.emit(
      'open',
    );

    publicSocket.emit(
      'open',
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      2,
    );

    const marketWatchdog =
      watchdogScheduler
        .tasks[0];

    assert.ok(
      marketWatchdog,
    );

    /*
     * The actual health mechanism replaces a shard only
     * after it stops producing fresh traffic.
     */
    marketWatchdog.callback();

    assert.equal(
      oldMarketSocket.closed,
      true,
    );

    assert.match(
      oldMarketSocket.closeReason
        ?? '',
      /silent stream/i,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      1,
    );

    reconnectScheduler
      .tasks[0]
      ?.callback();

    assert.equal(
      sockets.length,
      3,
    );

    const replacementMarketSocket =
      sockets[2];

    assert.ok(
      replacementMarketSocket,
    );

    replacementMarketSocket.emit(
      'open',
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    /*
     * Delayed callbacks from the retired socket must
     * never affect its replacement.
     */
    oldMarketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'BTCUSDT',
          ),
      },
    );

    oldMarketSocket.emit(
      'error',
    );

    oldMarketSocket.emit(
      'close',
      {
        code:
          1006,

        reason:
          'late close from retired socket',
      },
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      service.getStatus()
        .reconnectAttempts,
      0,
    );

    assert.equal(
      service.getStatus()
        .lastError,
      null,
    );

    assert.equal(
      replacementMarketSocket
        .closed,
      false,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      1,
    );

    service.stop();
  },
);


test(
  'reconnects a market-wide shard that stays open but stops delivering messages',
  () => {
    const reconnectScheduler =
      new TestScheduler();

    const watchdogScheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const serviceOptions = {
      baseUrl:
        'wss://fstream.binance.com',
      symbols: [
        'BTCUSDT',
      ],
      maxStreamsPerSocket:
        100,
      reconnectBaseDelayMs:
        250,
      reconnectMaxDelayMs:
        2_000,
      scheduler:
        reconnectScheduler,

      /*
       * Separate schedulers keep reconnect and watchdog timing
       * independently observable in this regression.
       */
      watchdogScheduler,
      silentStreamTimeoutMs:
        1_000,

      socketFactory: (
        url: string,
      ) => {
        urls.push(
          url,
        );

        const socket =
          new TestSocket();

        sockets.push(
          socket,
        );

        return socket;
      },
    };

    const service =
      new MarketWideRealtimeService(
        serviceOptions,
      );

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

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/public/stream?streams=',
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
      sockets[
        marketSocketIndex
      ];

    const publicSocket =
      sockets[
        publicSocketIndex
      ];

    assert.ok(
      marketSocket,
    );

    assert.ok(
      publicSocket,
    );

    /*
     * Both sockets open normally.
     */
    marketSocket.emit(
      'open',
    );

    publicSocket.emit(
      'open',
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    /*
     * Every opened shard must arm its own silence watchdog.
     */
    assert.equal(
      watchdogScheduler
        .tasks.length,
      2,
    );

    const marketWatchdog =
      watchdogScheduler
        .tasks[0];

    assert.ok(
      marketWatchdog,
    );

    assert.equal(
      marketWatchdog.delayMs,
      1_000,
    );

    /*
     * Simulate an open socket that becomes completely silent:
     * no message, no error, no close.
     */
    marketWatchdog.callback();

    /*
     * Only the silent market shard should be retired.
     */
    assert.equal(
      marketSocket.closed,
      true,
    );

    assert.equal(
      marketSocket.closeCode,
      1000,
    );

    assert.match(
      marketSocket.closeReason
        ?? '',
      /silent stream/i,
    );

    assert.equal(
      publicSocket.closed,
      false,
    );

    assert.equal(
      service.getStatus()
        .state,
      'degraded',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      1,
    );

    assert.match(
      service.getStatus()
        .lastError
        ?? '',
      /silent stream/i,
    );

    /*
     * Recovery must use normal shard reconnect logic.
     */
    assert.equal(
      reconnectScheduler
        .tasks.length,
      1,
    );

    assert.equal(
      reconnectScheduler
        .tasks[0]
        ?.delayMs,
      250,
    );

    reconnectScheduler
      .tasks[0]
      ?.callback();

    assert.equal(
      sockets.length,
      3,
    );

    const replacementMarketSocket =
      sockets[2];

    assert.ok(
      replacementMarketSocket,
    );

    assert.ok(
      (
        urls[2]
        ?? ''
      ).includes(
        '/market/stream?streams=',
      ),
    );

    replacementMarketSocket.emit(
      'open',
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      publicSocket.closed,
      false,
    );

    service.stop();
  },
);
test(
  'refreshes market-wide silence watchdog and ignores cancelled watchdog callback',
  () => {
    const reconnectScheduler =
      new TestScheduler();

    const watchdogScheduler =
      new TestScheduler();

    const sockets:
      TestSocket[] = [];

    const urls:
      string[] = [];

    const eventTimeMs =
      1_721_577_841_999;

    const service =
      new MarketWideRealtimeService({
        baseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        maxStreamsPerSocket:
          100,
        reconnectBaseDelayMs:
          250,
        reconnectMaxDelayMs:
          2_000,
        scheduler:
          reconnectScheduler,
        watchdogScheduler,
        silentStreamTimeoutMs:
          1_000,
        socketFactory: (
          url,
        ) => {
          urls.push(
            url,
          );

          const socket =
            new TestSocket();

          sockets.push(
            socket,
          );

          return socket;
        },
        now: () =>
          new Date(
            eventTimeMs
            + 500,
          ),
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

    const publicSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/public/stream?streams=',
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
      sockets[
        marketSocketIndex
      ];

    const publicSocket =
      sockets[
        publicSocketIndex
      ];

    assert.ok(
      marketSocket,
    );

    assert.ok(
      publicSocket,
    );

    /*
     * Open market first, then public, so watchdog task
     * ordering is deterministic for this regression.
     */
    marketSocket.emit(
      'open',
    );

    publicSocket.emit(
      'open',
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      2,
    );

    const firstMarketWatchdog =
      watchdogScheduler
        .tasks[0];

    const publicWatchdog =
      watchdogScheduler
        .tasks[1];

    assert.ok(
      firstMarketWatchdog,
    );

    assert.ok(
      publicWatchdog,
    );

    assert.equal(
      firstMarketWatchdog.cancelled,
      false,
    );

    assert.equal(
      publicWatchdog.cancelled,
      false,
    );

    /*
     * A valid fresh market event must refresh only
     * the market shard watchdog.
     */
    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            'BTCUSDT',
          ),
      },
    );

    assert.equal(
      firstMarketWatchdog.cancelled,
      true,
    );

    assert.equal(
      publicWatchdog.cancelled,
      false,
    );

    assert.equal(
      watchdogScheduler
        .tasks.length,
      3,
    );

    const refreshedMarketWatchdog =
      watchdogScheduler
        .tasks[2];

    assert.ok(
      refreshedMarketWatchdog,
    );

    assert.equal(
      refreshedMarketWatchdog.delayMs,
      1_000,
    );

    assert.equal(
      refreshedMarketWatchdog.cancelled,
      false,
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      0,
    );

    /*
     * Simulate a late callback from the already-cancelled
     * first watchdog.
     *
     * It must be ignored and must not retire the live socket.
     */
    firstMarketWatchdog.callback();

    assert.equal(
      marketSocket.closed,
      false,
    );

    assert.equal(
      publicSocket.closed,
      false,
    );

    assert.equal(
      service.getStatus()
        .state,
      'connected',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      2,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      0,
    );

    assert.equal(
      refreshedMarketWatchdog.cancelled,
      false,
    );

    /*
     * The current watchdog is still authoritative.
     * If it expires, the market shard must recover.
     */
    refreshedMarketWatchdog.callback();

    assert.equal(
      marketSocket.closed,
      true,
    );

    assert.equal(
      marketSocket.closeCode,
      1000,
    );

    assert.match(
      marketSocket.closeReason
        ?? '',
      /silent stream/i,
    );

    assert.equal(
      publicSocket.closed,
      false,
    );

    assert.equal(
      service.getStatus()
        .state,
      'degraded',
    );

    assert.equal(
      service.getStatus()
        .connectedSockets,
      1,
    );

    assert.equal(
      reconnectScheduler
        .tasks.length,
      1,
    );

    assert.match(
      service.getStatus()
        .lastError
        ?? '',
      /silent stream/i,
    );

    service.stop();
  },
);