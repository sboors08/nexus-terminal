import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  LevelV2ShadowRuntimeService,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  LevelV2ShadowRuntimeLifecycle,
  LevelV2ShadowRuntimeOptions,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  BinanceOneMinuteKlineUpdate,
} from '../src/modules/realtime-market-data/market-wide-one-minute-metrics.js';
import type {
  SetupDetectionKlineChange,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';

const BASE_TIME =
  Date.parse(
    '2026-07-29T12:00:00.000Z',
  );

const testEnv:
AppEnv = {
  nodeEnv:
    'test',
  host:
    '127.0.0.1',
  port:
    4100,
  apiPrefix:
    '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel:
    'silent',
};

function kline(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  isClosed = true,
  symbol = 'SOLUSDT',
): BinanceOneMinuteKlineUpdate {
  const openTime =
    BASE_TIME
    + index * 60_000;

  const closeTime =
    openTime
    + 59_999;

  return {
    symbol,
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
    open,
    high,
    low,
    close,
    quoteVolume:
      10_000 + index,
    tradesCount:
      100 + index,
    takerBuyQuoteVolume:
      5_000,
    isClosed,
  };
}

function resistanceHistory(
  symbol = 'SOLUSDT',
): BinanceOneMinuteKlineUpdate[] {
  return [
    kline(0, 95, 97, 94, 96, true, symbol),
    kline(1, 96, 100, 95, 98, true, symbol),
    kline(2, 98, 99, 94, 95, true, symbol),
    kline(3, 95, 97, 93, 96, true, symbol),
    kline(4, 96, 100.1, 95, 98, true, symbol),
    kline(5, 98, 99, 93, 95, true, symbol),
    kline(6, 95, 97, 92, 96, true, symbol),
    kline(7, 96, 100.05, 95, 98, true, symbol),
    kline(8, 98, 99, 92, 94, true, symbol),
    kline(9, 94, 97, 93, 96, true, symbol),
  ];
}

class TestSource
implements SetupDetectionRuntimeSource {
  readonly histories =
    new Map<
      string,
      BinanceOneMinuteKlineUpdate[]
    >();

  readonly listeners =
    new Set<
      (
        event:
          SetupDetectionKlineChange,
      ) => void
    >();

  readonly failingSymbols =
    new Set<string>();

  getSymbols():
  string[] {
    return [
      ...this.histories.keys(),
    ];
  }

  getKlines(
    symbolValue: string,
    limit = 1_000,
  ): BinanceOneMinuteKlineUpdate[] {
    const symbol =
      symbolValue
        .trim()
        .toUpperCase();

    if (
      this.failingSymbols.has(
        symbol,
      )
    ) {
      throw new Error(
        `Synthetic failure: ${symbol}`,
      );
    }

    return (
      this.histories.get(symbol)
      ?? []
    )
      .slice(-limit)
      .map(
        (item) => ({
          ...item,
        }),
      );
  }

  getState(): null {
    return null;
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

    let subscribed =
      true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed =
        false;

      this.listeners.delete(
        listener,
      );
    };
  }

  emit(
    event:
      SetupDetectionKlineChange,
  ): void {
    for (
      const listener
      of this.listeners
    ) {
      listener(
        event,
      );
    }
  }
}

const options:
LevelV2ShadowRuntimeOptions = {
  ...DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  maxCandles:
    100,
  foundationOptions: {
    atrPeriod:
      2,
    swingLeftCandles:
      1,
    swingRightCandles:
      1,
    minReactionAtr:
      0.4,
    maxReactionLookaheadCandles:
      3,
    plateauToleranceAtr:
      0.05,
    maxPlateauWidthCandles:
      3,
    maxTouchMergeCandles:
      1,
    touchMergeToleranceAtr:
      0.1,
  },
  zonesScoreOptions: {
    minTouches:
      2,
    minTouchSpacingCandles:
      2,
    clusterToleranceAtr:
      0.5,
    maxClusterTolerancePct:
      0.5,
    corePaddingAtr:
      0.05,
    outerPaddingAtr:
      0.1,
    liquidityPaddingAtr:
      0.2,
    acceptanceWindowCandles:
      50,
    maxClosesInsideRatio:
      1,
    maxCrossingsCount:
      100,
    minStructureEdgePosition:
      0.5,
    minLevelScore:
      0,
    freshnessHalfLifeCandles:
      100,
  },
  lifecycleOptions: {
    minActiveTouches:
      3,
    minTouchSpacingCandles:
      2,
    breakoutClosesRequired:
      2,
    breakoutConfirmationPct:
      0.05,
    reactionConfirmationPct:
      0.05,
    maxTestingCandles:
      12,
    maxActiveAgeCandles:
      100,
    maxRetestWaitCandles:
      50,
  },
  schedule: (
    task,
  ) => {
    task();
  },

  now: () =>
    new Date(
      '2026-07-29T13:00:00.000Z',
    ),
};

test(
  'queues live shadow scans cooperatively and coalesces repeated symbols',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(
        'SOLUSDT',
      ),
    );

    source.histories.set(
      'ETHUSDT',
      resistanceHistory(
        'ETHUSDT',
      ),
    );

    const scheduled:
      Array<
        () => void
      > = [];

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        {
          ...options,

          schedule: (
            task,
          ) => {
            scheduled.push(
              task,
            );
          },
        },
      );

    /*
     * Initial scans keep their historical synchronous
     * semantics. Only realtime-triggered rescans are queued.
     */
    runtime.start();

    const initialScans =
      runtime.getStatus()
        .scansCount;

    assert.equal(
      initialScans,
      2,
    );

    source.emit({
      source:
        'live',

      symbols: [
        'SOLUSDT',
        'ETHUSDT',
      ],
    });

    /*
     * Duplicate SOL arrives before the queue drains.
     * It must replace/coalesce the pending SOL entry,
     * not add another expensive scan.
     */
    source.emit({
      source:
        'live',

      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans,
      'live callback synchronously executed a shadow scan',
    );

    assert.equal(
      scheduled.length,
      1,
      'more than one drain was scheduled for the same burst',
    );

    const first =
      scheduled.shift();

    assert.ok(
      first,
    );

    first();

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans + 1,
      'one scheduled turn must scan exactly one symbol',
    );

    assert.equal(
      scheduled.length,
      1,
      'remaining symbol must be scheduled for a later turn',
    );

    const second =
      scheduled.shift();

    assert.ok(
      second,
    );

    second();

    assert.equal(
      runtime.getStatus()
        .scansCount,
      initialScans + 2,
      'duplicate pending symbol was not coalesced',
    );

    assert.equal(
      scheduled.length,
      0,
    );

    assert.equal(
      runtime.getSnapshot(
        'SOLUSDT',
      )?.triggerSource,
      'live',
    );

    assert.equal(
      runtime.getSnapshot(
        'ETHUSDT',
      )?.triggerSource,
      'live',
    );

    runtime.stop();
  },
);


test(
  'drops queued live shadow work after stop',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const scheduled:
      Array<
        () => void
      > = [];

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        {
          ...options,

          schedule: (
            task,
          ) => {
            scheduled.push(
              task,
            );
          },
        },
      );

    runtime.start();

    const before =
      runtime.getStatus()
        .scansCount;

    source.emit({
      source:
        'live',

      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      scheduled.length,
      1,
    );

    runtime.stop();

    const queued =
      scheduled.shift();

    assert.ok(
      queued,
    );

    queued();

    assert.equal(
      runtime.getStatus()
        .scansCount,
      before,
      'queued scan ran after runtime.stop()',
    );
  },
);


test(
  'builds a shadow snapshot from retained market candles',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const snapshot =
      runtime.getSnapshot(
        'solusdt',
      );

    assert.ok(
      snapshot,
    );

    assert.equal(
      snapshot.closedCandlesCount,
      10,
    );

    assert.ok(
      snapshot.detectedZonesCount
        >= 1,
    );

    assert.ok(
      snapshot.levels.some(
        (level) =>
          level.currentKind
            === 'resistance',
      ),
    );

    runtime.stop();
  },
);

test(
  'keeps the shadow runtime separate from production setup candidates',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const snapshot =
      runtime.getSnapshot(
        'SOLUSDT',
      );

    assert.ok(
      snapshot,
    );

    assert.equal(
      'candidates' in snapshot,
      false,
    );

    runtime.stop();
  },
);

test(
  'ignores an open candle when building the closed shadow history',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      [
        ...resistanceHistory(),
        kline(
          10,
          96,
          110,
          95,
          109,
          false,
        ),
      ],
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const snapshot =
      runtime.getSnapshot(
        'SOLUSDT',
      );

    assert.ok(
      snapshot,
    );

    assert.equal(
      snapshot.sourceCandlesCount,
      11,
    );

    assert.equal(
      snapshot.closedCandlesCount,
      10,
    );

    runtime.stop();
  },
);

test(
  'rescans only after a source change event',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const before =
      runtime.getStatus()
        .scansCount;

    source.emit({
      source:
        'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      runtime.getStatus()
        .scansCount,
      before + 1,
    );

    assert.equal(
      runtime.getSnapshot(
        'SOLUSDT',
      )?.triggerSource,
      'live',
    );

    runtime.stop();
  },
);

test(
  'start is idempotent and stop unsubscribes the source',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();
    runtime.start();

    assert.equal(
      source.listeners.size,
      1,
    );

    runtime.stop();

    assert.equal(
      source.listeners.size,
      0,
    );
  },
);

test(
  'does not rescan after the shadow runtime is stopped',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();
    runtime.stop();

    const before =
      runtime.getStatus()
        .scansCount;

    source.emit({
      source:
        'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      runtime.getStatus()
        .scansCount,
      before,
    );
  },
);

test(
  'isolates one failed symbol scan from successful symbols',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    source.histories.set(
      'ETHUSDT',
      resistanceHistory(
        'ETHUSDT',
      ),
    );

    source.failingSymbols.add(
      'ETHUSDT',
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    assert.ok(
      runtime.getSnapshot(
        'SOLUSDT',
      ),
    );

    assert.equal(
      runtime.getSnapshot(
        'ETHUSDT',
      ),
      null,
    );

    assert.equal(
      runtime.getStatus()
        .failedScans,
      1,
    );

    runtime.stop();
  },
);

test(
  'returns defensive shadow snapshot copies',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const first =
      runtime.getSnapshot(
        'SOLUSDT',
      );

    assert.ok(
      first,
    );

    const level =
      first.levels[0];

    assert.ok(
      level,
    );

    level.level.zone
      .referencePrice = 1;

    const stored =
      runtime.getSnapshot(
        'SOLUSDT',
      );

    assert.ok(
      stored,
    );

    assert.notEqual(
      stored.levels[0]
        ?.level.zone
        .referencePrice,
      1,
    );

    runtime.stop();
  },
);

test(
  'reports tracked and setup-eligible level counts',
  () => {
    const source =
      new TestSource();

    source.histories.set(
      'SOLUSDT',
      resistanceHistory(),
    );

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        options,
      );

    runtime.start();

    const status =
      runtime.getStatus();

    assert.equal(
      status.snapshotsCount,
      1,
    );

    assert.ok(
      status.levelsCount
        >= 1,
    );

    assert.ok(
      status.eligibleLevelsCount
        >= 1,
    );

    runtime.stop();
  },
);

test(
  'buildApp starts and stops an injected shadow runtime lifecycle',
  async () => {
    let starts = 0;
    let stops = 0;

    const lifecycle:
    LevelV2ShadowRuntimeLifecycle = {
      start: () => {
        starts += 1;
      },
      stop: () => {
        stops += 1;
      },
    };

    const app =
      await buildApp({
        env:
          testEnv,
        marketWideRealtimeService:
          null,
        levelV2ShadowRuntimeService:
          lifecycle,
      });

    await app.ready();

    assert.equal(
      starts,
      1,
    );

    await app.close();

    assert.equal(
      stops,
      1,
    );
  },
);

test(
  'rejects invalid shadow runtime options',
  () => {
    const source =
      new TestSource();

    assert.throws(
      () =>
        new LevelV2ShadowRuntimeService(
          source,
          {
            ...options,
            maxCandles:
              0,
          },
        ),
      /maxCandles/u,
    );
  },
);

test(
  'bounds default Level v2 histories to the readable retention window',
  () => {
    assert.equal(
      DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS
        .historyOptions
        ?.maxTotalEntries,
      10_000,
    );

    assert.equal(
      DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS
        .marketEvidenceHistoryOptions
        ?.maxTotalEntries,
      10_000,
    );
  },
);