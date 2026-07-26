import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  FastifyInstance,
} from 'fastify';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import {
  SetupDetectionRuntimeService,
} from '../src/modules/setup-engine/setup-detection-runtime.service.js';
import type {
  SetupDetectionKlineChange,
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

class MutableClock {
  constructor(
    private currentTimeMs:
      number,
  ) {}

  set(
    value: string,
  ): void {
    const timestamp =
      Date.parse(value);

    if (
      !Number.isFinite(
        timestamp,
      )
    ) {
      throw new Error(
        'Invalid test clock timestamp',
      );
    }

    this.currentTimeMs =
      timestamp;
  }

  now = (): Date =>
    new Date(
      this.currentTimeMs,
    );
}

function cloneKline(
  kline:
    BinanceOneMinuteKlineUpdate,
): BinanceOneMinuteKlineUpdate {
  return {
    ...kline,
  };
}

function buildKline(
  symbol: string,
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
    symbol,

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

    open:
      values.open,

    high:
      values.high,

    low:
      values.low,

    close:
      values.close,

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
  symbol: string,
): BinanceOneMinuteKlineUpdate[] {
  return [
    buildKline(
      symbol,
      0,
      {
        open: 96,
        high: 98,
        low: 95,
        close: 97,
      },
    ),

    buildKline(
      symbol,
      1,
      {
        open: 97,
        high: 100,
        low: 96,
        close: 98,
      },
    ),

    buildKline(
      symbol,
      2,
      {
        open: 96,
        high: 98,
        low: 95,
        close: 97,
      },
    ),

    buildKline(
      symbol,
      3,
      {
        open: 95,
        high: 97,
        low: 94,
        close: 96,
      },
    ),

    buildKline(
      symbol,
      4,
      {
        open: 96,
        high: 98.5,
        low: 95,
        close: 97,
      },
    ),

    buildKline(
      symbol,
      5,
      {
        open: 97,
        high: 100.1,
        low: 96,
        close: 98,
      },
    ),

    buildKline(
      symbol,
      6,
      {
        open: 98,
        high: 99,
        low: 97,
        close: 98.5,
      },
    ),
  ];
}

class TestStageRuntimeSource
implements SetupDetectionRuntimeSource {
  private readonly histories =
    new Map<
      string,
      BinanceOneMinuteKlineUpdate[]
    >();

  private readonly listeners =
    new Set<
      (
        event:
          SetupDetectionKlineChange,
      ) => void
    >();

  constructor(
    symbols:
      readonly string[],
  ) {
    for (
      const symbol
      of symbols
    ) {
      this.histories.set(
        symbol,
        buildHistory(
          symbol,
        ),
      );
    }
  }

  getSymbols(): string[] {
    return [
      ...this.histories.keys(),
    ];
  }

  getKlines(
    symbol: string,
    limit?: number,
  ): BinanceOneMinuteKlineUpdate[] {
    const history =
      this.histories.get(
        symbol,
      );

    if (!history) {
      return [];
    }

    const selected =
      limit === undefined
        ? history
        : history.slice(
            -limit,
          );

    return selected.map(
      cloneKline,
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
    const history =
      this.histories.get(
        symbol,
      );

    if (!history) {
      return null;
    }

    const latest =
      history.at(-1);

    return {
      kline:
        latest
          ? cloneKline(
              latest,
            )
          : null,

      bookTicker: null,
    };
  }

  subscribeKlineChanges(
    listener:
      (
        event:
          SetupDetectionKlineChange,
      ) => void,
  ): () => void {
    this.listeners.add(
      listener,
    );

    return () => {
      this.listeners.delete(
        listener,
      );
    };
  }

  pushLiveKlines(
    klines:
      readonly BinanceOneMinuteKlineUpdate[],
    emittedSymbols?:
      readonly string[],
  ): void {
    for (
      const kline
      of klines
    ) {
      const history =
        this.histories.get(
          kline.symbol,
        )
        ?? [];

      const existingIndex =
        history.findIndex(
          (item) =>
            item.openTime
            === kline.openTime,
        );

      if (
        existingIndex >= 0
      ) {
        history[existingIndex] =
          cloneKline(
            kline,
          );
      } else {
        history.push(
          cloneKline(
            kline,
          ),
        );
      }

      history.sort(
        (
          left,
          right,
        ) =>
          Date.parse(
            left.openTime,
          )
          - Date.parse(
              right.openTime,
            ),
      );

      this.histories.set(
        kline.symbol,
        history,
      );
    }

    const symbols =
      emittedSymbols
      ?? [
        ...new Set(
          klines.map(
            (kline) =>
              kline.symbol,
          ),
        ),
      ];

    for (
      const listener
      of this.listeners
    ) {
      listener({
        source: 'live',
        symbols: [
          ...symbols,
        ],
      });
    }
  }
}

function buildRuntimeOptions(
  clock:
    MutableClock,
  expiresAfterSec =
    3_600,
): SetupDetectionRuntimeOptions {
  return {
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
        expiresAfterSec,
      },

      setupTypes: [
        'level_breakout',
        'level_bounce',
      ],
    },

    stageEvaluatorOptions: {
      approachDistancePct: 0.5,
      breakoutConfirmationPct: 0.05,
      rejectionConfirmationPct: 0.1,
      maxObservationAgeSec: 120,
    },

    now:
      clock.now,
  };
}

async function createHarness(
  symbols:
    readonly string[] = [
      'SOLUSDT',
    ],
  expiresAfterSec =
    3_600,
): Promise<{
  app: FastifyInstance;
  source: TestStageRuntimeSource;
  runtime: SetupDetectionRuntimeService;
  clock: MutableClock;
}> {
  const clock =
    new MutableClock(
      Date.parse(
        '2026-07-26T12:06:59.999Z',
      ),
    );

  const source =
    new TestStageRuntimeSource(
      symbols,
    );

  const runtime =
    new SetupDetectionRuntimeService(
      source,
      buildRuntimeOptions(
        clock,
        expiresAfterSec,
      ),
    );

  const app =
    await buildApp({
      env:
        testEnv,

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

      setupDetectionRuntimeReader:
        runtime,
    });

  await app.ready();

  return {
    app,
    source,
    runtime,
    clock,
  };
}

test(
  'advances a live Binance setup through evaluator engine and read API',
  async (t) => {
    const {
      app,
      source,
      runtime,
      clock,
    } =
      await createHarness();

    t.after(
      async () =>
        app.close(),
    );

    const initialCandidates =
      runtime.getCandidates(
        'SOLUSDT',
      );

    assert.equal(
      initialCandidates.length,
      2,
    );

    const breakoutCandidate =
      initialCandidates.find(
        (candidate) =>
          candidate.setupType
            === 'level_breakout'
          && candidate.direction
            === 'long',
      );

    assert.ok(
      breakoutCandidate,
    );

    const approachKline =
      buildKline(
        'SOLUSDT',
        7,
        {
          open: 99.2,
          high: 99.8,
          low: 99.1,
          close: 99.7,
        },
      );

    clock.set(
      approachKline.eventTime,
    );

    source.pushLiveKlines([
      approachKline,
    ]);

    let detailResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates/'
          + encodeURIComponent(
              breakoutCandidate.id,
            ),
      });

    assert.equal(
      detailResponse.statusCode,
      200,
    );

    assert.equal(
      detailResponse.json().stage,
      'APPROACHING_THIRD_TOUCH',
    );

    const touchKline =
      buildKline(
        'SOLUSDT',
        8,
        {
          open: 99.7,
          high: 100.1,
          low: 99.6,
          close: 100,
        },
      );

    clock.set(
      touchKline.eventTime,
    );

    source.pushLiveKlines([
      touchKline,
    ]);

    detailResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates/'
          + encodeURIComponent(
              breakoutCandidate.id,
            ),
      });

    assert.equal(
      detailResponse.json().stage,
      'THIRD_TOUCH_CONFIRMED',
    );

    const breakoutKline =
      buildKline(
        'SOLUSDT',
        9,
        {
          open: 100,
          high: 100.5,
          low: 99.95,
          close: 100.4,
        },
      );

    clock.set(
      breakoutKline.eventTime,
    );

    source.pushLiveKlines([
      breakoutKline,
    ]);

    const listResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates'
          + '?symbol=SOLUSDT'
          + '&setupType=level_breakout'
          + '&direction=long'
          + '&limit=10',
      });

    assert.equal(
      listResponse.statusCode,
      200,
    );

    const payload =
      listResponse.json();

    assert.equal(
      payload.length,
      1,
    );

    assert.equal(
      payload[0].stage,
      'BREAKOUT_CONFIRMED',
    );

    assert.equal(
      payload[0].outcome,
      'breakout',
    );

    const statusResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/runtime/status',
      });

    const status =
      statusResponse.json();

    assert.equal(
      status.failedEvaluations,
      0,
    );

    assert.equal(
      status.evaluationsCount,
      6,
    );

    assert.equal(
      status.stageTransitionsCount,
      5,
    );

    assert.equal(
      status.lastTriggerSource,
      'live',
    );
  },
);

test(
  'keeps expired candidates in memory with SETUP_EXPIRED stage',
  async (t) => {
    const {
      app,
      runtime,
      clock,
    } =
      await createHarness(
        [
          'SOLUSDT',
        ],
        120,
      );

    t.after(
      async () =>
        app.close(),
    );

    assert.equal(
      runtime.getCandidates(
        'SOLUSDT',
      ).length,
      2,
    );

    clock.set(
      '2026-07-26T12:08:00.000Z',
    );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates'
          + '?symbol=SOLUSDT'
          + '&limit=10',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const candidates =
      response.json();

    assert.equal(
      candidates.length,
      2,
    );

    assert.ok(
      candidates.every(
        (
          candidate:
            {
              stage: string;
            },
        ) =>
          candidate.stage
          === 'SETUP_EXPIRED',
      ),
    );

    const status =
      runtime.getStatus();

    assert.equal(
      status.stageTransitionsCount,
      2,
    );

    assert.equal(
      status.failedEvaluations,
      0,
    );
  },
);

test(
  'isolates one failed candidate evaluation from another symbol',
  async (t) => {
    const {
      app,
      source,
      runtime,
      clock,
    } =
      await createHarness([
        'SOLUSDT',
        'ETHUSDT',
      ]);

    t.after(
      async () =>
        app.close(),
    );

    assert.equal(
      runtime.getCandidates()
        .length,
      4,
    );

    const invalidEthKline =
      buildKline(
        'ETHUSDT',
        7,
        {
          open: 101,
          high: 100,
          low: 99,
          close: 99.5,
        },
      );

    const validSolKline =
      buildKline(
        'SOLUSDT',
        7,
        {
          open: 99.2,
          high: 99.8,
          low: 99.1,
          close: 99.7,
        },
      );

    clock.set(
      validSolKline.eventTime,
    );

    source.pushLiveKlines(
      [
        invalidEthKline,
        validSolKline,
      ],
      [
        'ETHUSDT',
        'SOLUSDT',
      ],
    );

    const solCandidates =
      runtime.getCandidates(
        'SOLUSDT',
      );

    assert.equal(
      solCandidates.length,
      2,
    );

    assert.ok(
      solCandidates.every(
        (candidate) =>
          candidate.stage
          === 'APPROACHING_THIRD_TOUCH',
      ),
    );

    const status =
      runtime.getStatus();

    assert.equal(
      status.failedEvaluations,
      2,
    );

    assert.equal(
      status.stageTransitionsCount,
      2,
    );

    assert.equal(
      status.failedScans,
      1,
    );
  },
);

test(
  'uses Binance candle time when the local clock is behind',
  async (t) => {
    const {
      app,
      source,
      runtime,
      clock,
    } =
      await createHarness();

    t.after(
      async () =>
        app.close(),
    );

    const initialCandidates =
      runtime.getCandidates(
        'SOLUSDT',
      );

    assert.equal(
      initialCandidates.length,
      2,
    );

    const approachKline =
      buildKline(
        'SOLUSDT',
        7,
        {
          open: 99.2,
          high: 99.8,
          low: 99.1,
          close: 99.7,
        },
      );

    clock.set(
      '2026-07-26T12:07:05.000Z',
    );

    assert.ok(
      Date.parse(
        approachKline.eventTime,
      )
      > clock.now()
        .getTime(),
    );

    source.pushLiveKlines([
      approachKline,
    ]);

    const candidates =
      runtime.getCandidates(
        'SOLUSDT',
      );

    assert.equal(
      candidates.length,
      2,
    );

    assert.ok(
      candidates.every(
        (candidate) =>
          candidate.stage
          === 'APPROACHING_THIRD_TOUCH',
      ),
    );

    const status =
      runtime.getStatus();

    assert.equal(
      status.evaluationsCount,
      2,
    );

    assert.equal(
      status.failedEvaluations,
      0,
    );

    assert.equal(
      status.stageTransitionsCount,
      2,
    );

    assert.equal(
      status.lastEvaluationAt,
      approachKline.eventTime,
    );

    assert.equal(
      status.lastError,
      null,
    );
  },
);
