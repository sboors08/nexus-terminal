import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowSetupOutcomeObservationDiagnostics,
  buildLevelV2ShadowSetupOutcomeObservationSnapshot,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-outcome-observation.js';
import {
  LevelV2ShadowMarketEvidenceHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-history.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryEntry,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-history.types.js';
import type {
  LevelV2ShadowMarketEvidence,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence.types.js';
import type {
  LevelV2LifecycleState,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';

const testEnv = {
  nodeEnv: 'test',
  logLevel: 'silent',
  port: 0,
  host: '127.0.0.1',
  apiPrefix: '/api/v1',
  corsOrigins: ['*'],
} as unknown as AppEnv;

interface EvidenceInput {
  symbol: string;
  classifierId: string;
  levelId: string;
  currentKind:
    'support'
    | 'resistance';
  capturedAt: string;
  classificationStatus:
    LevelV2ShadowMarketEvidence['classificationStatus'];
  lastTradePrice:
    number
    | null;
  availability?:
    LevelV2ShadowMarketEvidence['availability'];
  buyQuoteValue?: number;
  sellQuoteValue?: number;
}

function evidence(
  input:
    EvidenceInput,
): LevelV2ShadowMarketEvidence {
  const availability =
    input.availability
    ?? 'complete';
  const hasTape =
    input.lastTradePrice !== null
    && availability !== 'order_book_only'
    && availability !== 'unavailable';
  const buyQuoteValue =
    input.buyQuoteValue
    ?? 700;
  const sellQuoteValue =
    input.sellQuoteValue
    ?? 100;
  const totalQuoteValue =
    buyQuoteValue
    + sellQuoteValue;

  return {
    id:
      `${input.classifierId}:market:${input.capturedAt}`,
    classifierId:
      input.classifierId,
    levelId:
      input.levelId,
    symbol:
      input.symbol,
    timeframe:
      '1m',
    currentKind:
      input.currentKind,
    classificationStatus:
      input.classificationStatus,
    capturedAt:
      input.capturedAt,
    availability,
    tape:
      hasTape
        ? {
            snapshotUpdatedAt:
              input.capturedAt,
            lastTradeAt:
              input.capturedAt,
            tradesCount: 3,
            executionsCount: 6,
            buyQuoteValue,
            sellQuoteValue,
            totalQuoteValue,
            quoteDelta:
              buyQuoteValue
              - sellQuoteValue,
            buySharePct:
              totalQuoteValue === 0
                ? null
                : buyQuoteValue
                  / totalQuoteValue
                  * 100,
            dominantSide:
              buyQuoteValue
                > sellQuoteValue
                ? 'buy'
                : 'sell',
            largestTradeQuoteValue:
              Math.max(
                buyQuoteValue,
                sellQuoteValue,
              ),
            firstTradePrice:
              input.lastTradePrice,
            lastTradePrice:
              input.lastTradePrice,
            priceChangePct: 0,
          }
        : null,
    orderBook:
      availability === 'unavailable'
        ? null
        : {
            state: 'live',
            synchronized: true,
            updatedAt:
              input.capturedAt,
            ageMs: 20,
            staleAfterMs: 5_000,
            bestBid:
              input.lastTradePrice === null
                ? 100
                : input.lastTradePrice
                  - 0.01,
            bestAsk:
              input.lastTradePrice === null
                ? 100.01
                : input.lastTradePrice,
            spreadPct: 0.01,
            bidDepthQuote: 10_000,
            askDepthQuote: 8_000,
            totalDepthQuote: 18_000,
            imbalancePct: 11.11111111,
          },
    sourceErrors: [],
  };
}

function levelState(
  symbol: string,
  levelId: string,
  currentKind:
    'support'
    | 'resistance',
  referencePrice = 100,
): LevelV2LifecycleState {
  return {
    id:
      levelId,
    currentKind,
    originalKind:
      currentKind,
    level: {
      id:
        levelId,
      version: 2,
      symbol,
      timeframe: '1m',
      kind:
        currentKind,
      sourceKind:
        currentKind === 'resistance'
          ? 'swing_high'
          : 'swing_low',
      zone: {
        referencePrice,
        coreLow:
          referencePrice - 0.2,
        coreHigh:
          referencePrice + 0.2,
        outerLow:
          referencePrice - 0.5,
        outerHigh:
          referencePrice + 0.5,
        liquidityLow:
          referencePrice - 0.8,
        liquidityHigh:
          referencePrice + 0.8,
        widthPct: 1,
        widthAtr: 1,
      },
      touches: [],
      touchesCount: 3,
      firstTouchAt:
        '2026-08-03T12:00:00.000Z',
      lastTouchAt:
        '2026-08-03T12:05:00.000Z',
      firstTouchCandleIndex: 1,
      lastTouchCandleIndex: 5,
      cleanliness: {
        closesInsideRatio: 0,
        closesAboveRatio: 0,
        closesBelowRatio: 1,
        crossingsCount: 0,
        timeInsideCandles: 0,
        rangeEdgePosition: 1,
        isAcceptanceZone: false,
      },
      score: {
        total: 90,
        touches: 90,
        reactions: 90,
        cleanliness: 90,
        spacing: 90,
        freshness: 90,
        precision: 90,
        structureEdge: 90,
      },
    },
    status: 'broken',
    qualifiedTouchesCount: 3,
    lastQualifiedTouchCandleIndex: 5,
    eligibleForSetups: false,
    registeredAt:
      '2026-08-03T12:00:00.000Z',
    registeredCandleIndex: 1,
    lineStartCandleIndex: 1,
    lineEndCandleIndex: 6,
    lineEndAt:
      '2026-08-03T12:10:01.000Z',
    testOriginStatus: null,
    testingStartedCandleIndex: null,
    testingStartedAt: null,
    testingTouchCandleIndex: null,
    breakClosesCount: 2,
    breakFirstCandleIndex: 5,
    breakFirstAt:
      '2026-08-03T12:10:00.000Z',
    brokenCandleIndex: 6,
    brokenAt:
      '2026-08-03T12:10:01.000Z',
    breakConfirmedAt:
      '2026-08-03T12:10:01.000Z',
    retestStartedCandleIndex: null,
    retestStartedAt: null,
    flippedCandleIndex: null,
    flippedAt: null,
    flippedLineStartCandleIndex: null,
    expiredCandleIndex: null,
    expiredAt: null,
    lastProcessedCandleIndex: 6,
    lastProcessedCloseTime:
      '2026-08-03T12:10:01.000Z',
    transitionSequence: 2,
  };
}

function recordResistanceScenario(
  store:
    LevelV2ShadowMarketEvidenceHistoryStore,
  symbol: string,
  suffix: string,
  prices:
    readonly {
      capturedAt: string;
      classificationStatus:
        LevelV2ShadowMarketEvidence['classificationStatus'];
      price:
        number
        | null;
      availability?:
        LevelV2ShadowMarketEvidence['availability'];
    }[],
): {
  classifierId: string;
  levelId: string;
  level:
    LevelV2LifecycleState;
} {
  const classifierId =
    `${symbol}:classifier:${suffix}`;
  const levelId =
    `${symbol}:resistance:${suffix}`;

  for (
    const point
    of prices
  ) {
    store.recordEvidence(
      evidence({
        symbol,
        classifierId,
        levelId,
        currentKind:
          'resistance',
        capturedAt:
          point.capturedAt,
        classificationStatus:
          point.classificationStatus,
        lastTradePrice:
          point.price,
        ...(point.availability
          ? {
              availability:
                point.availability,
            }
          : {}),
      }),
    );
  }

  return {
    classifierId,
    levelId,
    level:
      levelState(
        symbol,
        levelId,
        'resistance',
      ),
  };
}

function recordSupportScenario(
  store:
    LevelV2ShadowMarketEvidenceHistoryStore,
  symbol: string,
  suffix: string,
  prices:
    readonly {
      capturedAt: string;
      classificationStatus:
        LevelV2ShadowMarketEvidence['classificationStatus'];
      price: number;
    }[],
): {
  level:
    LevelV2LifecycleState;
} {
  const classifierId =
    `${symbol}:classifier:${suffix}`;
  const levelId =
    `${symbol}:support:${suffix}`;

  for (
    const point
    of prices
  ) {
    store.recordEvidence(
      evidence({
        symbol,
        classifierId,
        levelId,
        currentKind: 'support',
        capturedAt:
          point.capturedAt,
        classificationStatus:
          point.classificationStatus,
        lastTradePrice:
          point.price,
        buyQuoteValue: 100,
        sellQuoteValue: 700,
      }),
    );
  }

  return {
    level:
      levelState(
        symbol,
        levelId,
        'support',
      ),
  };
}

function entries(
  store:
    LevelV2ShadowMarketEvidenceHistoryStore,
): LevelV2ShadowMarketEvidenceHistoryEntry[] {
  return store.getHistory(
    undefined,
    undefined,
    10_000,
  );
}

function successScenario() {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();
  const scenario =
    recordResistanceScenario(
      store,
      'SOLUSDT',
      'success',
      [
        {
          capturedAt:
            '2026-08-03T12:10:00.000Z',
          classificationStatus:
            'breakout_pending',
          price: 100,
        },
        {
          capturedAt:
            '2026-08-03T12:10:01.000Z',
          classificationStatus:
            'breakout_confirmed',
          price: 101,
        },
        {
          capturedAt:
            '2026-08-03T12:10:02.000Z',
          classificationStatus:
            'breakout_confirmed',
          price: 101.5,
        },
      ],
    );

  return {
    store,
    scenario,
  };
}

test(
  'observes successful continuation with MFE and no production mutation',
  () => {
    const {
      store,
      scenario,
    } = successScenario();
    const snapshot =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          store,
        ),
        [
          scenario.level,
        ],
      );
    const observation =
      snapshot.observations[0];

    assert.ok(
      observation,
    );
    assert.equal(
      observation.status,
      'successful_continuation',
    );
    assert.equal(
      observation.entryPrice,
      101,
    );
    assert.equal(
      observation.latestPrice,
      101.5,
    );
    assert.equal(
      observation.maxFavorableExcursionPct,
      0.4950495,
    );
    assert.equal(
      observation.maxAdverseExcursionPct,
      0,
    );
    assert.equal(
      observation.returnedInsideLevel,
      false,
    );
    assert.equal(
      observation.changesProductionSetup,
      false,
    );
    assert.equal(
      observation.tradeExecution,
      false,
    );
  },
);

test(
  'mirrors favorable excursion for a supported breakdown',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();
    const scenario =
      recordSupportScenario(
        store,
        'DOGEUSDT',
        'success',
        [
          {
            capturedAt:
              '2026-08-03T12:15:00.000Z',
            classificationStatus:
              'breakout_pending',
            price: 100,
          },
          {
            capturedAt:
              '2026-08-03T12:15:01.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 99,
          },
          {
            capturedAt:
              '2026-08-03T12:15:02.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 98.5,
          },
        ],
      );
    const observation =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          store,
        ),
        [
          scenario.level,
        ],
      ).observations[0];

    assert.ok(
      observation,
    );
    assert.equal(
      observation.expectedDirection,
      'down',
    );
    assert.equal(
      observation.status,
      'successful_continuation',
    );
    assert.equal(
      observation.maxFavorableExcursionPct,
      0.50505051,
    );
    assert.equal(
      observation.returnedInsideLevel,
      false,
    );
  },
);

test(
  'marks a return inside the level as a failed reversal',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();
    const scenario =
      recordResistanceScenario(
        store,
        'ETHUSDT',
        'failure',
        [
          {
            capturedAt:
              '2026-08-03T12:20:00.000Z',
            classificationStatus:
              'breakout_pending',
            price: 100,
          },
          {
            capturedAt:
              '2026-08-03T12:20:01.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 101,
          },
          {
            capturedAt:
              '2026-08-03T12:20:02.000Z',
            classificationStatus:
              'false_breakout',
            price: 100.4,
          },
        ],
      );
    const observation =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          store,
        ),
        [
          scenario.level,
        ],
      ).observations[0];

    assert.ok(
      observation,
    );
    assert.equal(
      observation.status,
      'failed_reversal',
    );
    assert.equal(
      observation.returnedInsideLevel,
      true,
    );
    assert.equal(
      observation.failureConditionReached,
      true,
    );
    assert.equal(
      observation.timeToOutcomeMs,
      1_000,
    );
  },
);

test(
  'classifies a continuation followed by reversal as mixed',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();
    const scenario =
      recordResistanceScenario(
        store,
        'BNBUSDT',
        'mixed',
        [
          {
            capturedAt:
              '2026-08-03T12:30:00.000Z',
            classificationStatus:
              'breakout_pending',
            price: 100,
          },
          {
            capturedAt:
              '2026-08-03T12:30:01.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 101,
          },
          {
            capturedAt:
              '2026-08-03T12:30:02.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 101.5,
          },
          {
            capturedAt:
              '2026-08-03T12:30:03.000Z',
            classificationStatus:
              'false_breakout',
            price: 100.4,
          },
        ],
      );
    const observation =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          store,
        ),
        [
          scenario.level,
        ],
      ).observations[0];

    assert.ok(
      observation,
    );
    assert.equal(
      observation.status,
      'mixed',
    );
    assert.equal(
      observation.continuationReached,
      true,
    );
    assert.equal(
      observation.failureConditionReached,
      true,
    );
    assert.equal(
      observation.timeToOutcomeMs,
      2_000,
    );
  },
);

test(
  'keeps an outcome pending and never treats order-book-only data as a price',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();
    const scenario =
      recordResistanceScenario(
        store,
        'XRPUSDT',
        'pending',
        [
          {
            capturedAt:
              '2026-08-03T12:40:00.000Z',
            classificationStatus:
              'breakout_pending',
            price: 100,
          },
          {
            capturedAt:
              '2026-08-03T12:40:01.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 101,
          },
          {
            capturedAt:
              '2026-08-03T12:40:02.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: null,
            availability:
              'order_book_only',
          },
        ],
      );
    const observation =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          store,
        ),
        [
          scenario.level,
        ],
      ).observations[0];

    assert.ok(
      observation,
    );
    assert.equal(
      observation.status,
      'pending',
    );
    assert.equal(
      observation.latestPrice,
      101,
    );
    assert.equal(
      observation.observedPricesCount,
      1,
    );
    assert.equal(
      observation.tradeExecution,
      false,
    );
  },
);

test(
  'isolates classifiers and aggregates outcome diagnostics',
  () => {
    const success =
      successScenario();
    const failure =
      recordResistanceScenario(
        success.store,
        'ADAUSDT',
        'failure',
        [
          {
            capturedAt:
              '2026-08-03T12:50:00.000Z',
            classificationStatus:
              'breakout_pending',
            price: 100,
          },
          {
            capturedAt:
              '2026-08-03T12:50:01.000Z',
            classificationStatus:
              'breakout_confirmed',
            price: 101,
          },
          {
            capturedAt:
              '2026-08-03T12:50:02.000Z',
            classificationStatus:
              'false_breakout',
            price: 100.4,
          },
        ],
      );
    const snapshot =
      buildLevelV2ShadowSetupOutcomeObservationSnapshot(
        entries(
          success.store,
        ),
        [
          success.scenario.level,
          failure.level,
        ],
      );
    const diagnostics =
      buildLevelV2ShadowSetupOutcomeObservationDiagnostics(
        snapshot.observations,
      );

    assert.equal(
      snapshot.observations.length,
      2,
    );
    assert.equal(
      diagnostics.statusCounts
        .successful_continuation,
      1,
    );
    assert.equal(
      diagnostics.statusCounts
        .failed_reversal,
      1,
    );
    assert.equal(
      diagnostics.returnedInsideLevelCount,
      1,
    );
    assert.equal(
      diagnostics.changesProductionSetup,
      false,
    );
  },
);

function runtimeSnapshot(
  symbol: string,
  levels:
    readonly LevelV2LifecycleState[],
): LevelV2ShadowSnapshot {
  return {
    symbol,
    timeframe: '1m',
    generatedAt:
      '2026-08-03T12:10:02.000Z',
    triggerSource: 'live',
    sourceCandlesCount: 100,
    closedCandlesCount: 99,
    detectedZonesCount:
      levels.length,
    rejectedZonesCount: 0,
    rejectionCounts: {
      insufficientTouches: 0,
      acceptanceZone: 0,
      structureMidrange: 0,
      scoreBelowThreshold: 0,
    },
    evaluation: {
      version: 2,
      generatedAt:
        '2026-08-03T12:10:02.000Z',
      symbol,
      timeframe: '1m',
      v1LevelsCount: 0,
      v2LevelsCount:
        levels.length,
      matchedLevelsCount: 0,
      unmatchedV1LevelsCount: 0,
      unmatchedV2LevelsCount:
        levels.length,
      setupEligibleV2LevelsCount: 0,
      matches: [],
      unmatchedV1LevelIds: [],
      unmatchedV2LevelIds:
        levels.map(
          (level) =>
            level.id,
        ),
    },
    levels,
    lifecycleEvents: [],
    breakClassifications: [],
    breakClassificationEvents: [],
    marketEvidence: [],
  } as unknown as LevelV2ShadowSnapshot;
}

function reader():
LevelV2ShadowRuntimeReader {
  const {
    store,
    scenario,
  } = successScenario();
  const snapshots = [
    runtimeSnapshot(
      scenario.level.level.symbol,
      [
        scenario.level,
      ],
    ),
  ];

  return {
    getStatus: () => ({
      state: 'running',
      snapshotsCount: 1,
      levelsCount: 1,
      eligibleLevelsCount: 0,
      scansCount: 3,
      failedScans: 0,
      lastScanAt:
        '2026-08-03T12:10:02.000Z',
      lastTriggerSource: 'live',
      lastError: null,
    }),
    getSnapshots: () =>
      snapshots,
    getSnapshot: (
      symbol,
    ) =>
      snapshots.find(
        (snapshot) =>
          snapshot.symbol === symbol,
      )
      ?? null,
    getMarketEvidenceHistory: (
      symbol,
      classifierId,
      limit,
    ) =>
      store.getHistory(
        symbol,
        classifierId,
        limit,
      ),
    getMarketEvidenceHistoryStatus: () =>
      store.getStatus(),
  };
}

async function createApp(
  runtimeReader:
    LevelV2ShadowRuntimeReader
    | null = reader(),
) {
  return buildApp({
    env:
      testEnv,
    realtimeMarketDataService: null,
    orderBookDepthService: null,
    binanceSymbolUniverseService: null,
    marketWideRealtimeService: null,
    marketWideHistoryWarmupService: null,
    setupDetectionRuntimeService: null,
    levelV2ShadowRuntimeService: null,
    levelV2ShadowRuntimeReader:
      runtimeReader,
  });
}

test(
  'exposes filtered outcome status list and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const statusResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/status?symbol=solusdt',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );
    assert.equal(
      statusResponse.json()
        .observationsCount,
      1,
    );

    const listResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes?symbol=solusdt&status=successful_continuation&expectedDirection=up&limit=1',
      });
    const body =
      listResponse.json();

    assert.equal(
      listResponse.statusCode,
      200,
    );
    assert.equal(
      body.count,
      1,
    );
    assert.equal(
      body.items[0]
        .status,
      'successful_continuation',
    );
    assert.equal(
      body.items[0]
        .tradeExecution,
      false,
    );

    const diagnosticsResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/diagnostics',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.equal(
      diagnosticsResponse.json()
        .continuationReachedCount,
      1,
    );

    const invalid =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes?status=confirmed',
      });

    assert.equal(
      invalid.statusCode,
      400,
    );

    await app.close();
  },
);

test(
  'returns unavailable when the reader has no market-evidence history',
  async () => {
    const base =
      reader();
    const unavailable =
      await createApp({
        getStatus:
          base.getStatus,
        getSnapshots:
          base.getSnapshots,
        getSnapshot:
          base.getSnapshot,
      });
    const response =
      await unavailable.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await unavailable.close();
  },
);
