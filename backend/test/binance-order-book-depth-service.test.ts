import assert from 'node:assert/strict';
import test from 'node:test';
import { BinanceOrderBookDepthService } from '../src/modules/realtime-market-data/binance-order-book-depth.service.js';
import type {
  RealtimeSocketEvent,
  RealtimeWebSocket,
  ReconnectScheduler,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

class FakeSocket implements RealtimeWebSocket {
  private readonly listeners =
    new Map<
      string,
      Array<
        (event: RealtimeSocketEvent) => void
      >
    >();

  readonly closeCalls:
    Array<{
      code?: number;
      reason?: string;
    }> = [];

  addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener: (event: RealtimeSocketEvent) => void,
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
    this.closeCalls.push({
      ...(code === undefined
        ? {}
        : { code }),
      ...(reason === undefined
        ? {}
        : { reason }),
    });
  }

  emit(
    type: 'open' | 'message' | 'error' | 'close',
    event: RealtimeSocketEvent = {},
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

interface ScheduledTask {
  callback: () => void;
  delayMs: number;
}

function createScheduler(): {
  scheduler: ReconnectScheduler;
  tasks: ScheduledTask[];
} {
  const tasks:
    ScheduledTask[] = [];

  return {
    tasks,
    scheduler: {
      schedule(callback, delayMs) {
        const task = {
          callback,
          delayMs,
        };

        tasks.push(task);
        return task;
      },
      cancel(handle) {
        const index =
          tasks.indexOf(
            handle as ScheduledTask,
          );

        if (index >= 0) {
          tasks.splice(
            index,
            1,
          );
        }
      },
    },
  };
}

function depthMessage(
  values: {
    symbol?: string;
    firstUpdateId: number;
    finalUpdateId: number;
    previousFinalUpdateId: number;
    bids?: Array<[string, string]>;
    asks?: Array<[string, string]>;
  },
): RealtimeSocketEvent {
  const symbol =
    values.symbol
    ?? 'BTCUSDT';

  return {
    data:
      JSON.stringify({
        stream:
          `${symbol.toLowerCase()}@depth@100ms`,
        data: {
          E:
            1_785_265_200_000,
          T:
            1_785_265_200_000,
          s:
            symbol,
          U:
            values.firstUpdateId,
          u:
            values.finalUpdateId,
          pu:
            values.previousFinalUpdateId,
          b:
            values.bids
            ?? [],
          a:
            values.asks
            ?? [],
        },
      }),
  };
}

function snapshotResponse(
  lastUpdateId = 100,
): Response {
  return new Response(
    JSON.stringify({
      lastUpdateId,
      bids: [
        [
          '100',
          '2',
        ],
        [
          '99.9',
          '3',
        ],
      ],
      asks: [
        [
          '100.1',
          '4',
        ],
        [
          '100.2',
          '5',
        ],
      ],
    }),
    {
      status: 200,
    },
  );
}

async function flushPromises(): Promise<void> {
  await new Promise<void>(
    (resolve) =>
      setImmediate(resolve),
  );
}

test(
  'synchronizes a live Binance Futures depth stream with a REST snapshot',
  async () => {
    const sockets:
      FakeSocket[] = [];

    const urls:
      string[] = [];

    const fetchUrls:
      string[] = [];

    const pendingSnapshots:
      Array<
        (response: Response) => void
      > = [];

    let currentTime =
      new Date(
        '2026-07-28T19:00:00.000Z',
      );

    const service =
      new BinanceOrderBookDepthService({
        restBaseUrl:
          'https://fapi.binance.com',
        websocketBaseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        requestTimeoutMs:
          5_000,
        staleAfterMs:
          5_000,
        reconnectBaseDelayMs:
          1_000,
        reconnectMaxDelayMs:
          30_000,
        now: () =>
          currentTime,
        socketFactory(url) {
          urls.push(url);
          const socket =
            new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        fetchImpl(input) {
          fetchUrls.push(
            String(input),
          );

          return new Promise<Response>(
            (resolve) =>
              pendingSnapshots.push(
                resolve,
              ),
          );
        },
      });

    service.start();

    assert.match(
      urls[0]
      ?? '',
      /\/public\/stream\?streams=btcusdt@depth@100ms/u,
    );

    const socket =
      sockets[0];

    assert.ok(socket);
    socket.emit('open');

    assert.equal(
      fetchUrls[0],
      'https://fapi.binance.com/fapi/v1/depth?symbol=BTCUSDT&limit=1000',
    );

    socket.emit(
      'message',
      depthMessage({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
        bids: [
          [
            '100',
            '6',
          ],
        ],
      }),
    );

    pendingSnapshots[0]?.(
      snapshotResponse(),
    );

    await flushPromises();

    const liveSnapshot =
      service.getSnapshot(
        'BTCUSDT',
        {
          bucketSize:
            0.2,
        },
      );

    assert.equal(
      liveSnapshot?.state,
      'live',
    );

    assert.equal(
      liveSnapshot?.lastUpdateId,
      101,
    );

    assert.equal(
      liveSnapshot?.bids[0]
        ?.quantity,
      6,
    );

    assert.equal(
      liveSnapshot?.buckets
        ?.asks[0]
        ?.levelsCount,
      2,
    );

    socket.emit(
      'message',
      depthMessage({
        firstUpdateId:
          102,
        finalUpdateId:
          103,
        previousFinalUpdateId:
          101,
        asks: [
          [
            '100.1',
            '7',
          ],
        ],
      }),
    );

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.asks[0]
        ?.quantity,
      7,
    );

    currentTime =
      new Date(
        '2026-07-28T19:00:06.001Z',
      );

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.state,
      'stale',
    );

    service.stop();
  },
);

test(
  'resynchronizes after a Binance Futures pu sequence gap',
  async () => {
    const sockets:
      FakeSocket[] = [];

    const fetchCalls:
      string[] = [];

    const responses = [
      snapshotResponse(),
      snapshotResponse(200),
    ];

    const service =
      new BinanceOrderBookDepthService({
        restBaseUrl:
          'https://fapi.binance.com',
        websocketBaseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        requestTimeoutMs:
          5_000,
        staleAfterMs:
          5_000,
        reconnectBaseDelayMs:
          1_000,
        reconnectMaxDelayMs:
          30_000,
        now: () =>
          new Date(
            '2026-07-28T19:00:00.000Z',
          ),
        socketFactory() {
          const socket =
            new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        async fetchImpl(input) {
          fetchCalls.push(
            String(input),
          );

          const response =
            responses.shift();

          assert.ok(response);
          return response;
        },
      });

    service.start();

    const socket =
      sockets[0];

    assert.ok(socket);
    socket.emit('open');

    socket.emit(
      'message',
      depthMessage({
        firstUpdateId:
          99,
        finalUpdateId:
          101,
        previousFinalUpdateId:
          98,
      }),
    );

    await flushPromises();

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.state,
      'live',
    );

    socket.emit(
      'message',
      depthMessage({
        firstUpdateId:
          102,
        finalUpdateId:
          103,
        previousFinalUpdateId:
          999,
      }),
    );

    assert.equal(
      fetchCalls.length,
      2,
    );

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.state,
      'collecting',
    );

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.lastError,
      'previous-final-update-id-mismatch',
    );

    service.stop();
  },
);

test(
  'restarts the depth stream when a dynamic symbol is acquired and released',
  () => {
    const sockets:
      FakeSocket[] = [];

    const urls:
      string[] = [];

    const service =
      new BinanceOrderBookDepthService({
        restBaseUrl:
          'https://fapi.binance.com',
        websocketBaseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        requestTimeoutMs:
          5_000,
        staleAfterMs:
          5_000,
        reconnectBaseDelayMs:
          1_000,
        reconnectMaxDelayMs:
          30_000,
        socketFactory(url) {
          urls.push(url);
          const socket =
            new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        fetchImpl: async () =>
          snapshotResponse(),
      });

    service.start();

    const release =
      service.acquireSymbol(
        'ETHUSDT',
      );

    assert.equal(
      sockets.length,
      2,
    );

    assert.match(
      urls[1]
      ?? '',
      /btcusdt@depth@100ms\/ethusdt@depth@100ms/u,
    );

    assert.equal(
      sockets[0]
        ?.closeCalls[0]
        ?.reason,
      'NEXUS order book subscriptions changed',
    );

    release();

    assert.equal(
      sockets.length,
      3,
    );

    assert.doesNotMatch(
      urls[2]
      ?? '',
      /ethusdt/u,
    );

    service.stop();
  },
);

test(
  'marks a failed REST snapshot and schedules a retry',
  async () => {
    const sockets:
      FakeSocket[] = [];

    const { scheduler, tasks } =
      createScheduler();

    const service =
      new BinanceOrderBookDepthService({
        restBaseUrl:
          'https://fapi.binance.com',
        websocketBaseUrl:
          'wss://fstream.binance.com',
        symbols: [
          'BTCUSDT',
        ],
        requestTimeoutMs:
          5_000,
        staleAfterMs:
          5_000,
        reconnectBaseDelayMs:
          1_000,
        reconnectMaxDelayMs:
          30_000,
        scheduler,
        socketFactory() {
          const socket =
            new FakeSocket();
          sockets.push(socket);
          return socket;
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              code:
                -1000,
            }),
            {
              status: 500,
            },
          ),
      });

    service.start();

    const socket =
      sockets[0];

    assert.ok(socket);
    socket.emit('open');

    await flushPromises();

    assert.equal(
      service.getSnapshot(
        'BTCUSDT',
      )?.state,
      'error',
    );

    assert.equal(
      tasks.length,
      1,
    );

    assert.equal(
      tasks[0]?.delayMs,
      1_000,
    );

    service.stop();
  },
);
