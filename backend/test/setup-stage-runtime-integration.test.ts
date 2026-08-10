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
import type {
  RealtimeConfirmationEvidenceReaderOptions,
} from '../src/modules/level-engine/realtime-confirmation-evidence.js';
import {
  SetupDetectionRuntimeService,
} from '../src/modules/setup-engine/setup-detection-runtime.service.js';
import type {
  SetupLifecycleEvent,
} from '../src/modules/setup-engine/setup-lifecycle-events.types.js';
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

function buildEvidenceReaders(
  clock: MutableClock,
): RealtimeConfirmationEvidenceReaderOptions {
  return {
    tapeReader: {
      getSnapshots: (symbol?: string) => {
        const normalizedSymbol =
          symbol ?? 'SOLUSDT';
        const capturedAtMs =
          clock.now().getTime();
        const recentTrades =
          Array.from(
            { length: 6 },
            (_, index) => ({
              id: `trade-${index}`,
              symbol: normalizedSymbol,
              timestamp:
                new Date(
                  capturedAtMs
                  - (6 - index) * 250,
                ).toISOString(),
              price: 100,
              quantity: 1,
              quoteValue: 100,
              side: 'buy' as const,
              isBuyerMaker: false,
            }),
          );

        return [{
          symbol: normalizedSymbol,
          lastTrade:
            recentTrades.at(-1)
            ?? null,
          bookTicker: null,
          recentTrades,
          updatedAt:
            clock.now().toISOString(),
        }];
      },
    },
    orderBookReader: {
      getSnapshot: (symbol: string) => ({
        symbol,
        state: 'live',
        synchronized: true,
        lastUpdateId: 1,
        bids: [],
        asks: [],
        buckets: null,
        metrics: {
          symbol,
          synchronized: true,
          bestBid: 99.9,
          bestAsk: 100,
          midpoint: 99.95,
          spread: 0.1,
          spreadPct: 0.10005,
          depthRangePct: 0.5,
          bidDepthQuote: 1_000,
          askDepthQuote: 100,
          totalDepthQuote: 1_100,
          imbalancePct: 81.8182,
          updatedAt:
            clock.now().toISOString(),
        },
        updatedAt:
          clock.now().toISOString(),
        ageMs: 0,
        staleAfterMs: 5_000,
        lastError: null,
      }),
    },
  };
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
        open: 95,
        high: 96,
        low: 94,
        close: 95,
      },
    ),

    buildKline(
      symbol,
      1,
      {
        open: 96,
        high: 100,
        low: 95,
        close: 99,
      },
    ),

    buildKline(
      symbol,
      2,
      {
        open: 96.8,
        high: 97,
        low: 96,
        close: 96.5,
      },
    ),

    buildKline(
      symbol,
      3,
      {
        open: 96,
        high: 97,
        low: 95,
        close: 96,
      },
    ),

    buildKline(
      symbol,
      4,
      {
        open: 97,
        high: 99.9,
        low: 96,
        close: 99,
      },
    ),

    buildKline(
      symbol,
      5,
      {
        open: 98,
        high: 98,
        low: 95,
        close: 96,
      },
    ),

    buildKline(
      symbol,
      6,
      {
        open: 96,
        high: 97,
        low: 94,
        close: 95,
      },
    ),

    buildKline(
      symbol,
      7,
      {
        open: 95,
        high: 98,
        low: 94.5,
        close: 97,
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

      levelLinesOptions: {
        atrPeriod: 2,
        pivotLeftBars: 1,
        pivotRightBars: 1,
        originDepartureAtr: 0.6,
        originDepartureMaxCandles: 4,
        candidateVisibilityMinDepartureAtr: 2,
        candidateVisibilityMaxAgeBars: 5,
        persistentCandidateMinDepartureAtr: 1.5,
        persistentCandidateLookbackBars: 6,
        originEpisodeMaxSpanCandles: 3,
        workedEpisodeMaxSpanCandles: 8,
        touchTolerancePercent: 0.15,
        minBarsBetweenTouchEpisodes: 0,
        decisiveBreakAtr: 0.5,
        consecutiveBreakCloses: 2,
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
      buildEvidenceReaders(
        clock,
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
        8,
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

    assert.equal(
      detailResponse.json()
        .causal.stage,
      'APPROACH',
    );

    assert.equal(
      detailResponse.json()
        .causal.reason,
      'approach_distance_threshold_met',
    );

    const touchKline =
      buildKline(
        'SOLUSDT',
        9,
        {
          open: 99.7,
          high: 100,
          low: 99.6,
          close: 99.95,
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

    assert.equal(
      detailResponse.json().outcome,
      null,
    );

    assert.equal(
      detailResponse.json()
        .causal.stage,
      'CONFIRMATION',
    );

    assert.equal(
      detailResponse.json()
        .causal.reason,
      'realtime_confirmation_confirmed',
    );

    assert.equal(
      detailResponse.json()
        .causal.evaluatesBreakout,
      false,
    );

    assert.equal(
      detailResponse.json()
        .causal.evaluatesBounce,
      false,
    );

    const breakoutKline =
      buildKline(
        'SOLUSDT',
        10,
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

    assert.equal(
      payload[0].causal.stage,
      'CONFIRMATION',
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
      2,
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
      '2026-07-26T12:10:00.000Z',
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
        8,
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
        8,
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
      0,
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
        8,
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
      0,
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
      null,
    );

    assert.equal(
      status.lastError,
      null,
    );
  },
);


test(
  'emits sequential lifecycle events when candidates are created',
  () => {
    const clock =
      new MutableClock(
        Date.parse(
          '2026-07-26T12:06:59.999Z',
        ),
      );

    const source =
      new TestStageRuntimeSource([
        'SOLUSDT',
      ]);

    const runtime =
      new SetupDetectionRuntimeService(
        source,
        buildRuntimeOptions(
          clock,
        ),
        buildEvidenceReaders(
          clock,
        ),
      );

    const events:
      SetupLifecycleEvent[] = [];

    const unsubscribe =
      runtime
        .subscribeLifecycleEvents(
          (event) => {
            events.push(
              event,
            );
          },
        );

    runtime.start();

    assert.equal(
      events.length,
      2,
    );

    assert.deepEqual(
      events.map(
        (event) =>
          event.eventId,
      ),
      [
        1,
        2,
      ],
    );

    assert.ok(
      events.every(
        (event) =>
          event.type
            === 'candidate_created'
          && event.previousStage
            === null
          && event.currentStage
            === 'LEVEL_CONFIRMED'
          && event.candidate.stage
            === 'LEVEL_CONFIRMED',
      ),
    );

    assert.deepEqual(
      new Set(
        events.map(
          (event) =>
            event.candidateId,
        ),
      ).size,
      2,
    );

    unsubscribe();
    runtime.stop();
  },
);

test(
  'emits stage transition and breakout lifecycle events',
  () => {
    const clock =
      new MutableClock(
        Date.parse(
          '2026-07-26T12:06:59.999Z',
        ),
      );

    const source =
      new TestStageRuntimeSource([
        'SOLUSDT',
      ]);

    const runtime =
      new SetupDetectionRuntimeService(
        source,
        buildRuntimeOptions(
          clock,
        ),
        buildEvidenceReaders(
          clock,
        ),
      );

    const events:
      SetupLifecycleEvent[] = [];

    runtime.subscribeLifecycleEvents(
      (event) => {
        events.push(
          event,
        );
      },
    );

    runtime.start();

    const breakoutCandidate =
      runtime
        .getCandidates(
          'SOLUSDT',
        )
        .find(
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
        8,
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

    const touchKline =
      buildKline(
        'SOLUSDT',
        9,
        {
          open: 99.7,
          high: 100,
          low: 99.6,
          close: 99.95,
        },
      );

    clock.set(
      touchKline.eventTime,
    );

    source.pushLiveKlines([
      touchKline,
    ]);

    const breakoutKline =
      buildKline(
        'SOLUSDT',
        10,
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

    assert.deepEqual(
      events.map(
        (event) =>
          event.eventId,
      ),
      events.map(
        (
          _event,
          index,
        ) =>
          index + 1,
      ),
    );

    const candidateEvents =
      events.filter(
        (event) =>
          event.candidateId
          === breakoutCandidate.id,
      );

    assert.deepEqual(
      candidateEvents.map(
        (event) =>
          event.type,
      ),
      [
        'candidate_created',
        'stage_transition',
        'stage_transition',
        'breakout_confirmed',
      ],
    );

    assert.deepEqual(
      candidateEvents.map(
        (event) =>
          event.currentStage,
      ),
      [
        'LEVEL_CONFIRMED',
        'APPROACHING_THIRD_TOUCH',
        'THIRD_TOUCH_CONFIRMED',
        'BREAKOUT_CONFIRMED',
      ],
    );

    const breakoutEvent =
      candidateEvents.at(-1);

    assert.ok(
      breakoutEvent,
    );

    assert.equal(
      breakoutEvent.previousStage,
      'THIRD_TOUCH_CONFIRMED',
    );

    assert.equal(
      breakoutEvent.outcome,
      'breakout',
    );

    assert.equal(
      breakoutEvent.candidate.stage,
      'BREAKOUT_CONFIRMED',
    );

    runtime.stop();
  },
);

test(
  'emits a rejection confirmed lifecycle event',
  () => {
    const clock =
      new MutableClock(
        Date.parse(
          '2026-07-26T12:06:59.999Z',
        ),
      );

    const source =
      new TestStageRuntimeSource([
        'SOLUSDT',
      ]);

    const runtime =
      new SetupDetectionRuntimeService(
        source,
        buildRuntimeOptions(
          clock,
        ),
        buildEvidenceReaders(
          clock,
        ),
      );

    const events:
      SetupLifecycleEvent[] = [];

    runtime.subscribeLifecycleEvents(
      (event) => {
        events.push(
          event,
        );
      },
    );

    runtime.start();

    const bounceCandidate =
      runtime
        .getCandidates(
          'SOLUSDT',
        )
        .find(
          (candidate) =>
            candidate.setupType
              === 'level_bounce'
            && candidate.direction
              === 'short',
        );

    assert.ok(
      bounceCandidate,
    );

    const approachKline =
      buildKline(
        'SOLUSDT',
        8,
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

    const touchKline =
      buildKline(
        'SOLUSDT',
        9,
        {
          open: 99.7,
          high: 100,
          low: 99.6,
          close: 99.95,
        },
      );

    clock.set(
      touchKline.eventTime,
    );

    source.pushLiveKlines([
      touchKline,
    ]);

    const rejectionKline =
      buildKline(
        'SOLUSDT',
        10,
        {
          open: 100,
          high: 100.05,
          low: 99.5,
          close: 99.6,
        },
      );

    clock.set(
      rejectionKline.eventTime,
    );

    source.pushLiveKlines([
      rejectionKline,
    ]);

    const rejectionEvent =
      events.find(
        (event) =>
          event.candidateId
            === bounceCandidate.id
          && event.type
            === 'rejection_confirmed',
      );

    assert.ok(
      rejectionEvent,
    );

    assert.equal(
      rejectionEvent.previousStage,
      'THIRD_TOUCH_CONFIRMED',
    );

    assert.equal(
      rejectionEvent.currentStage,
      'REJECTION_CONFIRMED',
    );

    assert.equal(
      rejectionEvent.outcome,
      'rejection',
    );

    runtime.stop();
  },
);

test(
  'emits setup expired lifecycle events',
  () => {
    const clock =
      new MutableClock(
        Date.parse(
          '2026-07-26T12:06:59.999Z',
        ),
      );

    const source =
      new TestStageRuntimeSource([
        'SOLUSDT',
      ]);

    const runtime =
      new SetupDetectionRuntimeService(
        source,
        buildRuntimeOptions(
          clock,
          120,
        ),
        buildEvidenceReaders(
          clock,
        ),
      );

    const events:
      SetupLifecycleEvent[] = [];

    runtime.subscribeLifecycleEvents(
      (event) => {
        events.push(
          event,
        );
      },
    );

    runtime.start();

    clock.set(
      '2026-07-26T12:10:00.000Z',
    );

    runtime.getStatus();

    const expirationEvents =
      events.filter(
        (event) =>
          event.type
          === 'setup_expired',
      );

    assert.equal(
      expirationEvents.length,
      2,
    );

    assert.ok(
      expirationEvents.every(
        (event) =>
          event.previousStage
            === 'LEVEL_CONFIRMED'
          && event.currentStage
            === 'SETUP_EXPIRED'
          && event.candidate.stage
            === 'SETUP_EXPIRED',
      ),
    );

    assert.deepEqual(
      events.map(
        (event) =>
          event.eventId,
      ),
      [
        1,
        2,
        3,
        4,
      ],
    );

    runtime.stop();
  },
);

test(
  'isolates lifecycle listeners and returns defensive event copies',
  () => {
    const clock =
      new MutableClock(
        Date.parse(
          '2026-07-26T12:06:59.999Z',
        ),
      );

    const source =
      new TestStageRuntimeSource([
        'SOLUSDT',
      ]);

    const runtime =
      new SetupDetectionRuntimeService(
        source,
        buildRuntimeOptions(
          clock,
        ),
        buildEvidenceReaders(
          clock,
        ),
      );

    const observedEvents:
      SetupLifecycleEvent[] = [];

    const unsubscribeMutator =
      runtime
        .subscribeLifecycleEvents(
          (event) => {
            event.candidate
              .level
              .centerPrice = 1;
          },
        );

    const unsubscribeFaulty =
      runtime
        .subscribeLifecycleEvents(
          () => {
            throw new Error(
              'Broken lifecycle listener',
            );
          },
        );

    const unsubscribeObserver =
      runtime
        .subscribeLifecycleEvents(
          (event) => {
            observedEvents.push(
              event,
            );
          },
        );

    runtime.start();

    assert.equal(
      observedEvents.length,
      2,
    );

    assert.ok(
      observedEvents.every(
        (event) =>
          event.candidate
            .level
            .centerPrice
          !== 1,
      ),
    );

    assert.ok(
      runtime
        .getCandidates(
          'SOLUSDT',
        )
        .every(
          (candidate) =>
            candidate.level
              .centerPrice
            !== 1,
        ),
    );

    assert.equal(
      runtime.getStatus()
        .lastError,
      null,
    );

    unsubscribeObserver();

    const observedBefore =
      observedEvents.length;

    const approachKline =
      buildKline(
        'SOLUSDT',
        8,
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

    assert.equal(
      observedEvents.length,
      observedBefore,
    );

    assert.ok(
      runtime
        .getCandidates(
          'SOLUSDT',
        )
        .every(
          (candidate) =>
            candidate.stage
            === 'APPROACHING_THIRD_TOUCH',
        ),
    );

    assert.equal(
      runtime.getStatus()
        .lastError,
      null,
    );

    unsubscribeMutator();
    unsubscribeFaulty();

    runtime.stop();
  },
);
