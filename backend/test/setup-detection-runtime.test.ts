import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  MarketWideRealtimeService,
} from '../src/modules/realtime-market-data/market-wide-realtime.service.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  RealtimeSocketEvent,
  RealtimeWebSocket,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';
import {
  SetupDetectionRuntimeService,
} from '../src/modules/setup-engine/setup-detection-runtime.service.js';
import type {
  SetupDetectionRuntimeLifecycle,
  SetupDetectionRuntimeOptions,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';

const START_TIME_MS =
  Date.parse(
    '2026-07-26T12:00:00.000Z',
  );

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

const RUNTIME_OPTIONS:
  SetupDetectionRuntimeOptions = {
    maxCandidates: 100,
    pipelineOptions: {
      maxCandles: 100,
      detectorOptions: {
        pivotWindow: 1,
        minTouches: 2,
        minTouchSpacingCandles: 2,
        maxDistancePct: 0.25,
        zonePaddingPct: 0.05,
      },
      candidateOptions: {
        expiresAfterSec: 3_600,
      },
      setupTypes: [
        'level_breakout',
        'level_bounce',
      ],
    },
    now: () =>
      new Date(
        '2026-07-26T12:10:00.000Z',
      ),
  };

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

function buildKline(
  index: number,
  values: {
    open: number;
    high: number;
    low: number;
    close: number;
    isClosed?: boolean;
  },
): BinanceOneMinuteKlineUpdate {
  const openTimeMs =
    START_TIME_MS
    + index * 60_000;

  const closeTimeMs =
    openTimeMs
    + 59_999;

  return {
    symbol: 'SOLUSDT',
    eventTime:
      new Date(
        closeTimeMs,
      ).toISOString(),
    openTime:
      new Date(
        openTimeMs,
      ).toISOString(),
    closeTime:
      new Date(
        closeTimeMs,
      ).toISOString(),
    open: values.open,
    high: values.high,
    low: values.low,
    close: values.close,
    quoteVolume:
      10_000 + index,
    tradesCount:
      100 + index,
    takerBuyQuoteVolume:
      5_000,
    isClosed:
      values.isClosed
      ?? true,
  };
}

function buildHistory(
  includeFinalNeighbour:
    boolean,
): BinanceOneMinuteKlineUpdate[] {
  const history = [
    buildKline(0, {
      open: 96,
      high: 98,
      low: 95,
      close: 97,
    }),
    buildKline(1, {
      open: 97,
      high: 100,
      low: 96,
      close: 98,
    }),
    buildKline(2, {
      open: 96,
      high: 98,
      low: 95,
      close: 97,
    }),
    buildKline(3, {
      open: 95,
      high: 97,
      low: 94,
      close: 96,
    }),
    buildKline(4, {
      open: 96,
      high: 98.5,
      low: 95,
      close: 97,
    }),
    buildKline(5, {
      open: 97,
      high: 100.1,
      low: 96,
      close: 98,
    }),
  ];

  if (includeFinalNeighbour) {
    history.push(
      buildKline(6, {
        open: 98,
        high: 99,
        low: 97,
        close: 98.5,
      }),
    );
  }

  return history;
}

function klineMessage(
  kline:
    BinanceOneMinuteKlineUpdate,
): string {
  return JSON.stringify({
    stream:
      `${kline.symbol.toLowerCase()}@kline_1m`,
    data: {
      e: 'kline',
      E: Date.parse(
        kline.eventTime,
      ),
      s: kline.symbol,
      k: {
        t: Date.parse(
          kline.openTime,
        ),
        T: Date.parse(
          kline.closeTime,
        ),
        s: kline.symbol,
        i: '1m',
        o: String(
          kline.open,
        ),
        h: String(
          kline.high,
        ),
        l: String(
          kline.low,
        ),
        c: String(
          kline.close,
        ),
        q: String(
          kline.quoteVolume,
        ),
        n: kline.tradesCount,
        Q: String(
          kline.takerBuyQuoteVolume,
        ),
        x: kline.isClosed,
      },
    },
  });
}

function createRealtimeService(): {
  service:
    MarketWideRealtimeService;
  sockets: TestSocket[];
  urls: string[];
} {
  const sockets:
    TestSocket[] = [];

  const urls:
    string[] = [];

  const service =
    new MarketWideRealtimeService({
      baseUrl:
        'wss://fstream.binance.com',
      symbols: [
        'SOLUSDT',
      ],
      maxStreamsPerSocket: 4,
      reconnectBaseDelayMs: 100,
      reconnectMaxDelayMs: 1_000,
      socketFactory: (url) => {
        urls.push(url);

        const socket =
          new TestSocket();

        sockets.push(socket);

        return socket;
      },
      now: () =>
        new Date(
          '2026-07-26T12:10:00.000Z',
        ),
    });

  return {
    service,
    sockets,
    urls,
  };
}

test(
  'creates candidates after a closed live minute completes the level',
  () => {
    const {
      service,
      sockets,
      urls,
    } =
      createRealtimeService();

    const runtime =
      new SetupDetectionRuntimeService(
        service,
        RUNTIME_OPTIONS,
      );

    runtime.start();

    service.applyHistoricalKlines(
      buildHistory(false),
    );

    assert.equal(
      runtime.getCandidates()
        .length,
      0,
    );

    service.start();

    const marketSocketIndex =
      urls.findIndex(
        (url) =>
          url.includes(
            '/market/stream?streams=',
          ),
      );

    const marketSocket =
      sockets[marketSocketIndex];

    assert.ok(marketSocket);

    const unfinished =
      buildKline(6, {
        open: 98,
        high: 99,
        low: 97,
        close: 98.5,
        isClosed: false,
      });

    const scansBefore =
      runtime.getStatus()
        .scansCount;

    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            unfinished,
          ),
      },
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      scansBefore,
    );

    const closed = {
      ...unfinished,
      isClosed: true,
    };

    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            closed,
          ),
      },
    );

    assert.equal(
      runtime.getCandidates()
        .length,
      2,
    );

    marketSocket.emit(
      'message',
      {
        data:
          klineMessage(
            closed,
          ),
      },
    );

    assert.equal(
      runtime.getCandidates()
        .length,
      2,
    );

    assert.equal(
      runtime.getStatus()
        .lastTriggerSource,
      'live',
    );

    runtime.stop();
    service.stop();
  },
);

test(
  'scans historical batches and returns defensive candidate copies',
  () => {
    const {
      service,
    } =
      createRealtimeService();

    const runtime =
      new SetupDetectionRuntimeService(
        service,
        RUNTIME_OPTIONS,
      );

    runtime.start();

    service.applyHistoricalKlines(
      buildHistory(true),
    );

    const candidates =
      runtime.getCandidates(
        'solusdt',
      );

    assert.equal(
      candidates.length,
      2,
    );

    const firstCandidate =
      candidates[0];

    assert.ok(firstCandidate);

    firstCandidate.level
      .centerPrice = 1;

    const stored =
      runtime.getCandidate(
        firstCandidate.id,
      );

    assert.ok(stored);

    assert.notEqual(
      stored.level.centerPrice,
      1,
    );

    assert.equal(
      runtime.getStatus()
        .lastTriggerSource,
      'history',
    );

    runtime.stop();
  },
);

test(
  'does not scan after the runtime is stopped',
  () => {
    const {
      service,
    } =
      createRealtimeService();

    const runtime =
      new SetupDetectionRuntimeService(
        service,
        RUNTIME_OPTIONS,
      );

    runtime.start();

    const scansBeforeStop =
      runtime.getStatus()
        .scansCount;

    runtime.stop();

    service.applyHistoricalKlines(
      buildHistory(true),
    );

    assert.equal(
      runtime.getStatus()
        .state,
      'stopped',
    );

    assert.equal(
      runtime.getStatus()
        .scansCount,
      scansBeforeStop,
    );

    assert.equal(
      runtime.getCandidates()
        .length,
      0,
    );
  },
);

class FaultyRuntimeSource
implements SetupDetectionRuntimeSource {
  private readonly history =
    buildHistory(true);

  getSymbols(): string[] {
    return [
      'BAD',
      'SOLUSDT',
    ];
  }

  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[] {
    if (
      symbol === 'BAD'
    ) {
      throw new Error(
        'Broken symbol storage',
      );
    }

    return limit === undefined
      ? this.history.map(
          (item) => ({
            ...item,
          }),
        )
      : this.history
          .slice(-limit)
          .map(
            (item) => ({
              ...item,
            }),
          );
  }

  getState(
    symbol: string,
  ): {
    kline:
      BinanceOneMinuteKlineUpdate
      | null;
    bookTicker: null;
  } | null {
    if (
      symbol !== 'SOLUSDT'
    ) {
      return null;
    }

    const latest =
      this.history.at(-1);

    return {
      kline:
        latest
          ? {
              ...latest,
            }
          : null,
      bookTicker: null,
    };
  }

  subscribeKlineChanges():
  () => void {
    return () => {};
  }
}

test(
  'isolates one failed symbol scan from successful symbols',
  () => {
    const runtime =
      new SetupDetectionRuntimeService(
        new FaultyRuntimeSource(),
        RUNTIME_OPTIONS,
      );

    runtime.start();

    assert.equal(
      runtime.getStatus()
        .failedScans,
      1,
    );

    assert.equal(
      runtime.getCandidates(
        'SOLUSDT',
      ).length,
      2,
    );

    assert.match(
      runtime.getStatus()
        .lastError
        ?? '',
      /BAD:/,
    );

    runtime.stop();
  },
);

class TestRuntimeLifecycle
implements SetupDetectionRuntimeLifecycle {
  starts = 0;
  stops = 0;

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }
}

test(
  'buildApp starts and stops the setup detection runtime',
  async () => {
    const runtime =
      new TestRuntimeLifecycle();

    const app =
      await buildApp({
        env: testEnv,
        realtimeMarketDataService:
          null,
        binanceSymbolUniverseService:
          null,
        marketWideRealtimeService:
          null,
        marketWideHistoryWarmupService:
          null,
        setupDetectionRuntimeService:
          runtime,
      });

    await app.ready();

    assert.equal(
      runtime.starts,
      1,
    );

    await app.close();

    assert.equal(
      runtime.stops,
      1,
    );
  },
);
