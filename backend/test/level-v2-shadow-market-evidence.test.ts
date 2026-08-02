import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import {
  buildLevelV2ShadowMarketEvidence,
  cloneLevelV2ShadowMarketEvidence,
  LevelV2ShadowMarketEvidenceAdapter,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence.js';
import type {
  LevelV2BreakClassificationState,
} from '../src/modules/setup-engine/level-v2/level-v2-break-classification.types.js';
import type {
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  RealtimeSymbolSnapshot,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';
import type {
  OrderBookDepthRuntimeSnapshot,
} from '../src/modules/realtime-market-data/order-book-depth-runtime.types.js';
import type {
  AppEnv,
} from '../src/config/env.js';

const testEnv = {
  nodeEnv: 'test',
  logLevel: 'silent',
  port: 0,
  host: '127.0.0.1',
  apiPrefix: '/api/v1',
  corsOrigins: ['*'],
} as unknown as AppEnv;

function state(
  id: string,
  levelId: string,
): LevelV2BreakClassificationState {
  return {
    id,
    currentKind: 'resistance',
    status: 'breakout_pending',
    level: {
      id: levelId,
      symbol: 'SOLUSDT',
      timeframe: '1m',
    },
  } as unknown as
    LevelV2BreakClassificationState;
}

function tapeSnapshot():
RealtimeSymbolSnapshot {
  return {
    symbol: 'SOLUSDT',
    lastTrade: {
      id: '3',
      symbol: 'SOLUSDT',
      timestamp: '2026-08-02T12:00:03.000Z',
      price: 102,
      quantity: 2,
      quoteValue: 204,
      tradesCount: 2,
      side: 'buy',
      isBuyerMaker: false,
    },
    bookTicker: null,
    recentTrades: [
      {
        id: '1',
        symbol: 'SOLUSDT',
        timestamp: '2026-08-02T12:00:01.000Z',
        price: 100,
        quantity: 1,
        quoteValue: 100,
        tradesCount: 1,
        side: 'sell',
        isBuyerMaker: true,
      },
      {
        id: '2',
        symbol: 'SOLUSDT',
        timestamp: '2026-08-02T12:00:02.000Z',
        price: 101,
        quantity: 3,
        quoteValue: 303,
        tradesCount: 3,
        side: 'buy',
        isBuyerMaker: false,
      },
      {
        id: '3',
        symbol: 'SOLUSDT',
        timestamp: '2026-08-02T12:00:03.000Z',
        price: 102,
        quantity: 2,
        quoteValue: 204,
        tradesCount: 2,
        side: 'buy',
        isBuyerMaker: false,
      },
    ],
    updatedAt:
      '2026-08-02T12:00:03.000Z',
  };
}

function orderBookSnapshot():
OrderBookDepthRuntimeSnapshot {
  return {
    symbol: 'SOLUSDT',
    state: 'live',
    synchronized: true,
    lastUpdateId: 10,
    bids: [],
    asks: [],
    buckets: null,
    metrics: {
      symbol: 'SOLUSDT',
      synchronized: true,
      bestBid: 101.9,
      bestAsk: 102.1,
      midpoint: 102,
      spread: 0.2,
      spreadPct: 0.19607843,
      depthRangePct: 0.5,
      bidDepthQuote: 75_000,
      askDepthQuote: 50_000,
      totalDepthQuote: 125_000,
      imbalancePct: 20,
      updatedAt:
        '2026-08-02T12:00:03.000Z',
    },
    updatedAt:
      '2026-08-02T12:00:03.000Z',
    ageMs: 50,
    staleAfterMs: 5_000,
    lastError: null,
  };
}

test(
  'aggregates tape and order-book snapshots without interpreting confirmation',
  () => {
    const adapter =
      new LevelV2ShadowMarketEvidenceAdapter({
        tapeReader: {
          getSnapshots: () => [
            tapeSnapshot(),
          ],
        },
        orderBookReader: {
          getSnapshot: () =>
            orderBookSnapshot(),
        },
      });

    const capture =
      adapter.capture(
        'SOLUSDT',
        '2026-08-02T12:00:04.000Z',
      );

    assert.equal(
      capture.tape?.tradesCount,
      3,
    );
    assert.equal(
      capture.tape?.executionsCount,
      6,
    );
    assert.equal(
      capture.tape?.buyQuoteValue,
      507,
    );
    assert.equal(
      capture.tape?.sellQuoteValue,
      100,
    );
    assert.equal(
      capture.tape?.dominantSide,
      'buy',
    );
    assert.equal(
      capture.tape?.priceChangePct,
      2,
    );
    assert.equal(
      capture.orderBook?.imbalancePct,
      20,
    );
    assert.deepEqual(
      capture.sourceErrors,
      [],
    );
  },
);

test(
  'isolates tape and order-book source failures from shadow evidence capture',
  () => {
    const adapter =
      new LevelV2ShadowMarketEvidenceAdapter({
        tapeReader: {
          getSnapshots: () => {
            throw new Error(
              'tape offline',
            );
          },
        },
        orderBookReader: {
          getSnapshot: () => {
            throw new Error(
              'depth offline',
            );
          },
        },
      });

    const capture =
      adapter.capture(
        'SOLUSDT',
        '2026-08-02T12:00:04.000Z',
      );

    assert.equal(
      capture.tape,
      null,
    );
    assert.equal(
      capture.orderBook,
      null,
    );
    assert.deepEqual(
      capture.sourceErrors,
      [
        'tape: tape offline',
        'order_book: depth offline',
      ],
    );
  },
);

test(
  'maps one defensive market-evidence record to every isolated classifier',
  () => {
    const states = [
      state(
        'classifier-a',
        'level-a',
      ),
      state(
        'classifier-b',
        'level-b',
      ),
    ];

    const evidence =
      buildLevelV2ShadowMarketEvidence(
        states,
        new LevelV2ShadowMarketEvidenceAdapter({
          tapeReader: {
            getSnapshots: () => [
              tapeSnapshot(),
            ],
          },
          orderBookReader: null,
        }),
        '2026-08-02T12:00:04.000Z',
      );

    assert.equal(
      evidence.length,
      2,
    );
    assert.equal(
      evidence[0]?.availability,
      'tape_only',
    );
    assert.equal(
      evidence[1]?.classifierId,
      'classifier-b',
    );

    const clone =
      cloneLevelV2ShadowMarketEvidence(
        evidence[0]!,
      );

    (
      clone.sourceErrors as
        string[]
    ).push(
      'mutated',
    );

    assert.deepEqual(
      evidence[0]?.sourceErrors,
      [],
    );
  },
);

function reader():
LevelV2ShadowRuntimeReader {
  const classification =
    state(
      'classifier-a',
      'level-a',
    );

  const marketEvidence =
    buildLevelV2ShadowMarketEvidence(
      [classification],
      new LevelV2ShadowMarketEvidenceAdapter({
        tapeReader: {
          getSnapshots: () => [
            tapeSnapshot(),
          ],
        },
        orderBookReader: {
          getSnapshot: () =>
            orderBookSnapshot(),
        },
      }),
      '2026-08-02T12:00:04.000Z',
    );

  const snapshot = {
    symbol: 'SOLUSDT',
    timeframe: '1m',
    generatedAt:
      '2026-08-02T12:00:04.000Z',
    breakClassifications: [
      classification,
    ],
    breakClassificationEvents: [],
    marketEvidence,
  } as unknown as
    LevelV2ShadowSnapshot;

  return {
    getStatus: () => ({
      state: 'running',
      snapshotsCount: 1,
      levelsCount: 1,
      eligibleLevelsCount: 1,
      scansCount: 1,
      failedScans: 0,
      lastScanAt:
        snapshot.generatedAt,
      lastTriggerSource: 'live',
      lastError: null,
    }),
    getSnapshots: () => [
      structuredClone(
        snapshot,
      ),
    ],
    getSnapshot: () =>
      structuredClone(
        snapshot,
      ),
  };
}

test(
  'exposes classifier market evidence and evidence diagnostics through shadow API',
  async () => {
    const app =
      await buildApp({
        env:
          testEnv,
        realtimeMarketDataService:
          null,
        orderBookDepthService:
          null,
        binanceSymbolUniverseService:
          null,
        marketWideRealtimeService:
          null,
        marketWideHistoryWarmupService:
          null,
        setupDetectionRuntimeService:
          null,
        levelV2ShadowRuntimeService:
          null,
        levelV2ShadowRuntimeReader:
          reader(),
      });

    const listResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications',
      });

    assert.equal(
      listResponse.statusCode,
      200,
    );
    assert.equal(
      listResponse.json()
        .items[0]
        .marketEvidence
        .availability,
      'complete',
    );

    const diagnosticsResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications/diagnostics',
      });

    const diagnostics =
      diagnosticsResponse.json();

    assert.equal(
      diagnostics.marketEvidenceCount,
      1,
    );
    assert.equal(
      diagnostics.completeMarketEvidenceCount,
      1,
    );
    assert.equal(
      diagnostics.tapeAvailableCount,
      1,
    );
    assert.equal(
      diagnostics.orderBookAvailableCount,
      1,
    );
    assert.equal(
      diagnostics.marketEvidenceSourceErrorsCount,
      0,
    );

    await app.close();
  },
);
