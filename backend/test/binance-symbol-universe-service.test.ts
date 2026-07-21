import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BinanceSymbolUniverseService,
  type BinanceSymbolUniverseScheduler,
} from '../src/modules/realtime-market-data/binance-symbol-universe.service.js';

function exchangeInfo(
  symbols: string[],
): unknown {
  return {
    symbols:
      symbols.map((symbol) => ({
        symbol,
        status: 'TRADING',
        baseAsset:
          symbol.replace(
            /USDT$/,
            '',
          ),
        quoteAsset: 'USDT',
        isSpotTradingAllowed:
          true,
        permissionSets: [
          ['SPOT'],
        ],
      })),
  };
}

function jsonResponse(
  payload: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        'content-type':
          'application/json',
      },
    },
  );
}

class TestScheduler
implements
BinanceSymbolUniverseScheduler {
  readonly scheduled:
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

    this.scheduled.push(task);

    return task;
  }

  cancel(handle: unknown): void {
    const task =
      handle as {
        cancelled: boolean;
      };

    task.cancelled = true;
  }
}

test(
  'loads the initial Binance symbol universe without false listing events',
  async () => {
    const events: unknown[] = [];

    const service =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          60_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          600_000,
        fetchImpl: async () =>
          jsonResponse(
            exchangeInfo([
              'BTCUSDT',
              'ETHUSDT',
            ]),
          ),
        scheduler:
          new TestScheduler(),
        now: () =>
          new Date(
            '2026-07-21T12:00:00.000Z',
          ),
      });

    service.subscribe(
      (event) => {
        events.push(event);
      },
    );

    const snapshot =
      await service.start();

    assert.equal(
      snapshot.serviceState,
      'ready',
    );

    assert.equal(
      snapshot.initialized,
      true,
    );

    assert.equal(
      snapshot.refreshCount,
      1,
    );

    assert.deepEqual(
      snapshot.activeSymbols,
      [
        'BTCUSDT',
        'ETHUSDT',
      ],
    );

    assert.deepEqual(
      snapshot.addedSymbols,
      [],
    );

    assert.equal(
      events.length,
      0,
    );

    service.stop();
  },
);

test(
  'detects new listings and removed pairs during refresh',
  async () => {
    let requestIndex = 0;

    const payloads = [
      exchangeInfo([
        'BTCUSDT',
        'DOGEUSDT',
      ]),
      exchangeInfo([
        'BTCUSDT',
        'NEWUSDT',
      ]),
    ];

    let currentTime =
      '2026-07-21T12:00:00.000Z';

    const service =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          60_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          600_000,
        fetchImpl: async () =>
          jsonResponse(
            payloads[
              Math.min(
                requestIndex++,
                payloads.length - 1,
              )
            ],
          ),
        scheduler:
          new TestScheduler(),
        now: () =>
          new Date(currentTime),
      });

    const events:
      Array<{
        addedSymbols: string[];
        removedSymbols: string[];
      }> = [];

    service.subscribe(
      (event) => {
        events.push({
          addedSymbols:
            event.addedSymbols,
          removedSymbols:
            event.removedSymbols,
        });
      },
    );

    await service.start();

    currentTime =
      '2026-07-21T12:05:00.000Z';

    const snapshot =
      await service.refresh();

    assert.deepEqual(
      snapshot.addedSymbols,
      ['NEWUSDT'],
    );

    assert.deepEqual(
      snapshot.removedSymbols,
      ['DOGEUSDT'],
    );

    assert.deepEqual(
      snapshot.collectingSymbols,
      ['NEWUSDT'],
    );

    assert.deepEqual(
      events,
      [
        {
          addedSymbols:
            ['NEWUSDT'],
          removedSymbols:
            ['DOGEUSDT'],
        },
      ],
    );

    service.stop();
  },
);

test(
  'keeps the previous universe when Binance refresh fails',
  async () => {
    let requestIndex = 0;

    const service =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          60_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          600_000,
        fetchImpl: async () => {
          requestIndex += 1;

          return requestIndex === 1
            ? jsonResponse(
                exchangeInfo([
                  'BTCUSDT',
                  'SOLUSDT',
                ]),
              )
            : jsonResponse(
                {
                  error:
                    'unavailable',
                },
                503,
              );
        },
        scheduler:
          new TestScheduler(),
        now: () =>
          new Date(
            '2026-07-21T12:00:00.000Z',
          ),
      });

    await service.start();

    await assert.rejects(
      service.refresh(),
      /status 503/,
    );

    const snapshot =
      service.getSnapshot();

    assert.equal(
      snapshot.serviceState,
      'degraded',
    );

    assert.deepEqual(
      snapshot.activeSymbols,
      [
        'BTCUSDT',
        'SOLUSDT',
      ],
    );

    assert.match(
      snapshot.lastError ?? '',
      /status 503/,
    );

    service.stop();
  },
);

test(
  'schedules periodic refresh and cancels it on stop',
  async () => {
    const scheduler =
      new TestScheduler();

    const service =
      new BinanceSymbolUniverseService({
        baseUrl:
          'https://data-api.binance.vision',
        quoteAsset: 'USDT',
        refreshIntervalMs:
          45_000,
        requestTimeoutMs:
          1_000,
        collectingDurationMs:
          600_000,
        fetchImpl: async () =>
          jsonResponse(
            exchangeInfo([
              'BTCUSDT',
            ]),
          ),
        scheduler,
        now: () =>
          new Date(
            '2026-07-21T12:00:00.000Z',
          ),
      });

    await service.start();

    assert.equal(
      scheduler.scheduled.length,
      1,
    );

    assert.equal(
      scheduler.scheduled[0]
        .delayMs,
      45_000,
    );

    assert.equal(
      scheduler.scheduled[0]
        .cancelled,
      false,
    );

    service.stop();

    assert.equal(
      scheduler.scheduled[0]
        .cancelled,
      true,
    );

    assert.equal(
      service.getSnapshot()
        .serviceState,
      'stopped',
    );
  },
);