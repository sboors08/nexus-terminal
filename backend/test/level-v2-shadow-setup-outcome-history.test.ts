import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowSetupOutcomeHistoryStore,
  LevelV2ShadowSetupOutcomeHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-outcome-history.js';
import type {
  LevelV2ShadowSetupOutcomeObservation,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-outcome-observation.types.js';
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

function observation(
  overrides: Partial<
    LevelV2ShadowSetupOutcomeObservation
  > = {},
): LevelV2ShadowSetupOutcomeObservation {
  return {
    id:
      'SOLUSDT:classifier:setup-outcome:2',
    classifierId:
      'SOLUSDT:classifier',
    levelId:
      'SOLUSDT:resistance:1',
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    currentKind:
      'resistance',
    expectedDirection:
      'up',
    anchorCandidateHistoryEntryId:
      'SOLUSDT:classifier:confirmation-history:2',
    anchorCandidateId:
      'SOLUSDT:classifier:confirmation-candidate:2',
    anchorConfidence:
      'high',
    startedAt:
      '2026-08-03T12:00:01.000Z',
    startedSequence: 2,
    windowEndsAt:
      '2026-08-03T12:05:01.000Z',
    entryPrice: 101,
    latestPrice: 101,
    latestPriceAt:
      '2026-08-03T12:00:01.000Z',
    latestSourceObservedAt:
      '2026-08-03T12:00:01.000Z',
    observedPricesCount: 1,
    durationMs: 0,
    observationWindowElapsed: false,
    levelReferencePrice: 100,
    levelBoundaryPrice: 100.5,
    levelGeometryAvailable: true,
    maxFavorableExcursionPct: 0,
    maxAdverseExcursionPct: 0,
    maxFavorablePrice: 101,
    maxAdversePrice: 101,
    continuationReached: false,
    continuationReachedAt: null,
    adverseThresholdReached: false,
    adverseThresholdReachedAt: null,
    returnedInsideLevel: false,
    returnedInsideLevelAt: null,
    failureConditionReached: false,
    failureConditionReachedAt: null,
    status: 'pending',
    resolvedAt: null,
    timeToOutcomeMs: null,
    reasons: [
      'supported_confirmation_candidate_anchor',
      'tape_price_observation_only',
      'outcome_observation_pending',
    ],
    options: {
      successThresholdPct: 0.3,
      failureThresholdPct: 0.2,
      maxObservationMs: 300_000,
    },
    observationalOnly: true,
    changesBreakClassification: false,
    changesProductionSetup: false,
    tradeExecution: false,
    ...overrides,
  };
}

test(
  'deduplicates identical observations while retaining material outcome transitions',
  () => {
    const store =
      new LevelV2ShadowSetupOutcomeHistoryStore();
    const pending =
      observation();

    assert.ok(
      store.recordObservation(
        pending,
      ),
    );
    assert.equal(
      store.recordObservation(
        pending,
      ),
      null,
    );

    store.recordObservation(
      observation({
        latestPrice: 101.5,
        latestPriceAt:
          '2026-08-03T12:00:02.000Z',
        latestSourceObservedAt:
          '2026-08-03T12:00:02.000Z',
        observedPricesCount: 2,
        durationMs: 1_000,
        maxFavorableExcursionPct:
          0.4950495,
        maxFavorablePrice: 101.5,
        continuationReached: true,
        continuationReachedAt:
          '2026-08-03T12:00:02.000Z',
        status:
          'successful_continuation',
        resolvedAt:
          '2026-08-03T12:00:02.000Z',
        timeToOutcomeMs: 1_000,
        reasons: [
          'supported_confirmation_candidate_anchor',
          'tape_price_observation_only',
          'favorable_excursion_threshold_reached',
        ],
      }),
    );

    const history =
      store.getHistory();

    assert.equal(
      history.length,
      2,
    );
    assert.equal(
      history[0]
        ?.observation.status,
      'successful_continuation',
    );
    assert.equal(
      history[0]
        ?.changes.statusChanged,
      true,
    );
    assert.equal(
      history[0]
        ?.changes.continuationReachedChanged,
      true,
    );
    assert.equal(
      store.getStatus()
        .deduplicatedEntriesCount,
      1,
    );
  },
);

test(
  'captures price excursion count and reversal changes and returns defensive copies',
  () => {
    const store =
      new LevelV2ShadowSetupOutcomeHistoryStore();

    store.recordObservation(
      observation(),
    );
    store.recordObservation(
      observation({
        latestPrice: 100.4,
        latestPriceAt:
          '2026-08-03T12:00:02.000Z',
        latestSourceObservedAt:
          '2026-08-03T12:00:02.000Z',
        observedPricesCount: 2,
        durationMs: 1_000,
        maxAdverseExcursionPct:
          0.59405941,
        maxAdversePrice: 100.4,
        adverseThresholdReached: true,
        adverseThresholdReachedAt:
          '2026-08-03T12:00:02.000Z',
        returnedInsideLevel: true,
        returnedInsideLevelAt:
          '2026-08-03T12:00:02.000Z',
        failureConditionReached: true,
        failureConditionReachedAt:
          '2026-08-03T12:00:02.000Z',
        status:
          'failed_reversal',
        resolvedAt:
          '2026-08-03T12:00:02.000Z',
        timeToOutcomeMs: 1_000,
        reasons: [
          'supported_confirmation_candidate_anchor',
          'tape_price_observation_only',
          'adverse_excursion_threshold_reached',
          'price_returned_inside_level_boundary',
        ],
      }),
    );

    const value =
      store.getHistory()[0];

    assert.ok(
      value,
    );
    assert.equal(
      value.latestPriceChangePct,
      -0.59405941,
    );
    assert.equal(
      value.changes.latestPriceChanged,
      true,
    );
    assert.equal(
      value.changes.maxAdverseExcursionPctChanged,
      true,
    );
    assert.equal(
      value.changes.returnedInsideLevelChanged,
      true,
    );
    assert.equal(
      value.changes.observedPricesCountChanged,
      true,
    );

    (value.observation.reasons as string[]).push(
      'mutated',
    );
    value.changes.statusAfter =
      'pending';

    const reread =
      store.getHistory()[0];

    assert.ok(
      reread,
    );
    assert.equal(
      reread.observation.reasons.includes(
        'mutated',
      ),
      false,
    );
    assert.equal(
      reread.changes.statusAfter,
      'failed_reversal',
    );
  },
);

test(
  'enforces per-classifier and global outcome history limits',
  () => {
    const store =
      new LevelV2ShadowSetupOutcomeHistoryStore({
        maxEntriesPerClassifier: 2,
        maxTotalEntries: 3,
      });

    for (
      const latestPrice
      of [
        101,
        101.1,
        101.2,
      ]
    ) {
      store.recordObservation(
        observation({
          latestPrice,
          latestPriceAt:
            `2026-08-03T12:00:0${Math.round((latestPrice - 101) * 10 + 1)}.000Z`,
          latestSourceObservedAt:
            `2026-08-03T12:00:0${Math.round((latestPrice - 101) * 10 + 1)}.000Z`,
          observedPricesCount:
            Math.round(
              (latestPrice - 101) * 10,
            ) + 1,
        }),
      );
    }

    for (
      const latestPrice
      of [
        200,
        199.5,
      ]
    ) {
      store.recordObservation(
        observation({
          id:
            'ETHUSDT:classifier:setup-outcome:2',
          classifierId:
            'ETHUSDT:classifier',
          levelId:
            'ETHUSDT:support:1',
          symbol:
            'ETHUSDT',
          currentKind: 'support',
          expectedDirection: 'down',
          entryPrice: 200,
          latestPrice,
          maxFavorablePrice:
            Math.min(
              200,
              latestPrice,
            ),
          maxAdversePrice:
            Math.max(
              200,
              latestPrice,
            ),
          latestPriceAt:
            latestPrice === 200
              ? '2026-08-03T12:01:01.000Z'
              : '2026-08-03T12:01:02.000Z',
          latestSourceObservedAt:
            latestPrice === 200
              ? '2026-08-03T12:01:01.000Z'
              : '2026-08-03T12:01:02.000Z',
          observedPricesCount:
            latestPrice === 200
              ? 1
              : 2,
        }),
      );
    }

    const status =
      store.getStatus();

    assert.equal(
      status.entriesCount,
      3,
    );
    assert.equal(
      store.getHistory(
        undefined,
        'SOLUSDT:classifier',
      ).length,
      1,
    );
    assert.equal(
      store.getHistory(
        undefined,
        'ETHUSDT:classifier',
      ).length,
      2,
    );
    assert.equal(
      status.droppedEntriesCount,
      2,
    );
  },
);

interface EvidenceInput {
  capturedAt: string;
  classificationStatus:
    LevelV2ShadowMarketEvidence['classificationStatus'];
  price:
    number
    | null;
  availability?:
    LevelV2ShadowMarketEvidence['availability'];
}

function marketEvidence(
  input:
    EvidenceInput,
): LevelV2ShadowMarketEvidence {
  const availability =
    input.availability
    ?? 'complete';
  const hasTape =
    input.price !== null
    && availability !== 'order_book_only'
    && availability !== 'unavailable';
  const referencePrice =
    input.price
    ?? 100;

  return {
    id:
      `SOLUSDT:classifier:market:${input.capturedAt}`,
    classifierId:
      'SOLUSDT:classifier',
    levelId:
      'SOLUSDT:resistance:1',
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    currentKind:
      'resistance',
    classificationStatus:
      input.classificationStatus,
    capturedAt:
      input.capturedAt,
    availability,
    tape: hasTape
      ? {
      snapshotUpdatedAt:
        input.capturedAt,
      lastTradeAt:
        input.capturedAt,
      tradesCount: 3,
      executionsCount: 6,
      buyQuoteValue: 700,
      sellQuoteValue: 100,
      totalQuoteValue: 800,
      quoteDelta: 600,
      buySharePct: 87.5,
      dominantSide: 'buy',
      largestTradeQuoteValue: 700,
      firstTradePrice:
        input.price,
      lastTradePrice:
        input.price,
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
        referencePrice - 0.01,
      bestAsk:
        referencePrice,
      spreadPct: 0.01,
      bidDepthQuote: 10_000,
      askDepthQuote: 8_000,
      totalDepthQuote: 18_000,
      imbalancePct: 11.11111111,
    },
    sourceErrors: [],
  };
}

function levelState():
LevelV2LifecycleState {
  return {
    id:
      'SOLUSDT:resistance:1',
    currentKind: 'resistance',
    originalKind: 'resistance',
    level: {
      id:
        'SOLUSDT:resistance:1',
      version: 2,
      symbol: 'SOLUSDT',
      timeframe: '1m',
      kind: 'resistance',
      sourceKind: 'swing_high',
      zone: {
        referencePrice: 100,
        coreLow: 99.8,
        coreHigh: 100.2,
        outerLow: 99.5,
        outerHigh: 100.5,
        liquidityLow: 99.2,
        liquidityHigh: 100.8,
        widthPct: 1,
        widthAtr: 1,
      },
      touches: [],
      touchesCount: 3,
      firstTouchAt:
        '2026-08-03T11:00:00.000Z',
      lastTouchAt:
        '2026-08-03T11:05:00.000Z',
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
      '2026-08-03T11:00:00.000Z',
    registeredCandleIndex: 1,
    lineStartCandleIndex: 1,
    lineEndCandleIndex: 6,
    lineEndAt:
      '2026-08-03T12:00:01.000Z',
    testOriginStatus: null,
    testingStartedCandleIndex: null,
    testingStartedAt: null,
    testingTouchCandleIndex: null,
    breakClosesCount: 2,
    breakFirstCandleIndex: 5,
    breakFirstAt:
      '2026-08-03T12:00:00.000Z',
    brokenCandleIndex: 6,
    brokenAt:
      '2026-08-03T12:00:01.000Z',
    breakConfirmedAt:
      '2026-08-03T12:00:01.000Z',
    retestStartedCandleIndex: null,
    retestStartedAt: null,
    flippedCandleIndex: null,
    flippedAt: null,
    flippedLineStartCandleIndex: null,
    expiredCandleIndex: null,
    expiredAt: null,
    lastProcessedCandleIndex: 6,
    lastProcessedCloseTime:
      '2026-08-03T12:00:01.000Z',
    transitionSequence: 2,
  };
}

function scenario(): {
  store:
    LevelV2ShadowMarketEvidenceHistoryStore;
  entries:
    LevelV2ShadowMarketEvidenceHistoryEntry[];
  level:
    LevelV2LifecycleState;
} {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();

  for (
    const point
    of [
      {
        capturedAt:
          '2026-08-03T12:00:00.000Z',
        classificationStatus:
          'breakout_pending' as const,
        price: 100,
      },
      {
        capturedAt:
          '2026-08-03T12:00:01.000Z',
        classificationStatus:
          'breakout_confirmed' as const,
        price: 101,
      },
      {
        capturedAt:
          '2026-08-03T12:00:02.000Z',
        classificationStatus:
          'breakout_confirmed' as const,
        price: 101.2,
      },
      {
        capturedAt:
          '2026-08-03T12:00:03.000Z',
        classificationStatus:
          'breakout_confirmed' as const,
        price: 101.5,
      },
      {
        capturedAt:
          '2026-08-03T12:00:04.000Z',
        classificationStatus:
          'false_breakout' as const,
        price: 100.4,
      },
    ]
  ) {
    store.recordEvidence(
      marketEvidence(
        point,
      ),
    );
  }

  return {
    store,
    entries:
      store.getHistory(
        undefined,
        undefined,
        10_000,
      ),
    level:
      levelState(),
  };
}

test(
  'rebuilds pending continuation and mixed transitions from temporal market evidence',
  () => {
    const value =
      scenario();
    const store =
      buildLevelV2ShadowSetupOutcomeHistoryStore(
        value.entries,
        [
          value.level,
        ],
      );
    const ordered =
      store.getHistory()
        .reverse();
    const statuses =
      ordered.map(
        (entry) =>
          entry.observation.status,
      );

    assert.ok(
      statuses.includes(
        'pending',
      ),
    );
    assert.ok(
      statuses.includes(
        'successful_continuation',
      ),
    );
    assert.equal(
      statuses.at(-1),
      'mixed',
    );
    assert.ok(
      store.getDiagnostics()
        .statusTransitionsCount
        >= 2,
    );
    assert.equal(
      ordered.at(-1)
        ?.tradeExecution,
      false,
    );
  },
);

test(
  'deduplicates order-book-only source updates without inventing a new outcome price',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();

    store.recordEvidence(
      marketEvidence({
        capturedAt:
          '2026-08-03T12:10:00.000Z',
        classificationStatus:
          'breakout_pending',
        price: 100,
      }),
    );
    store.recordEvidence(
      marketEvidence({
        capturedAt:
          '2026-08-03T12:10:01.000Z',
        classificationStatus:
          'breakout_confirmed',
        price: 101,
      }),
    );

    const before =
      buildLevelV2ShadowSetupOutcomeHistoryStore(
        store.getHistory(
          undefined,
          undefined,
          10_000,
        ),
        [
          levelState(),
        ],
      );

    store.recordEvidence(
      marketEvidence({
        capturedAt:
          '2026-08-03T12:10:02.000Z',
        classificationStatus:
          'breakout_confirmed',
        price: null,
        availability:
          'order_book_only',
      }),
    );

    const after =
      buildLevelV2ShadowSetupOutcomeHistoryStore(
        store.getHistory(
          undefined,
          undefined,
          10_000,
        ),
        [
          levelState(),
        ],
      );

    assert.equal(
      after.getHistory().length,
      before.getHistory().length,
    );
    assert.ok(
      after.getStatus()
        .deduplicatedEntriesCount
        >= 1,
    );
    assert.equal(
      after.getHistory()[0]
        ?.observation.latestPrice,
      101,
    );
  },
);

function runtimeSnapshot(
  level:
    LevelV2LifecycleState,
): LevelV2ShadowSnapshot {
  return {
    symbol: 'SOLUSDT',
    timeframe: '1m',
    generatedAt:
      '2026-08-03T12:00:04.000Z',
    triggerSource: 'live',
    sourceCandlesCount: 100,
    closedCandlesCount: 99,
    detectedZonesCount: 1,
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
        '2026-08-03T12:00:04.000Z',
      symbol: 'SOLUSDT',
      timeframe: '1m',
      v1LevelsCount: 0,
      v2LevelsCount: 1,
      matchedLevelsCount: 0,
      unmatchedV1LevelsCount: 0,
      unmatchedV2LevelsCount: 1,
      setupEligibleV2LevelsCount: 0,
      matches: [],
      unmatchedV1LevelIds: [],
      unmatchedV2LevelIds: [
        level.id,
      ],
    },
    levels: [
      level,
    ],
    lifecycleEvents: [],
    breakClassifications: [],
    breakClassificationEvents: [],
    marketEvidence: [],
  } as unknown as LevelV2ShadowSnapshot;
}

function reader():
LevelV2ShadowRuntimeReader {
  const value =
    scenario();
  const snapshot =
    runtimeSnapshot(
      value.level,
    );

  return {
    getStatus: () => ({
      state: 'running',
      snapshotsCount: 1,
      levelsCount: 1,
      eligibleLevelsCount: 0,
      scansCount: 5,
      failedScans: 0,
      lastScanAt:
        '2026-08-03T12:00:04.000Z',
      lastTriggerSource: 'live',
      lastError: null,
    }),
    getSnapshots: () => [
      snapshot,
    ],
    getSnapshot: (
      symbol,
    ) =>
      symbol === 'SOLUSDT'
        ? snapshot
        : null,
    getMarketEvidenceHistory: (
      symbol,
      classifierId,
      limit,
    ) =>
      value.store.getHistory(
        symbol,
        classifierId,
        limit,
      ),
    getMarketEvidenceHistoryStatus: () =>
      value.store.getStatus(),
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
  'exposes outcome history status list and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const statusResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history/status?symbol=solusdt',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );
    assert.ok(
      statusResponse.json()
        .entriesCount
        >= 3,
    );

    const listResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history?symbol=solusdt&status=mixed&expectedDirection=up&limit=1',
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
        .observation.status,
      'mixed',
    );
    assert.equal(
      body.items[0]
        .changesProductionSetup,
      false,
    );

    const diagnosticsResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history/diagnostics',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.ok(
      diagnosticsResponse.json()
        .statusTransitionsCount
        >= 2,
    );

    const invalid =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history?status=confirmed',
      });

    assert.equal(
      invalid.statusCode,
      400,
    );

    await app.close();
  },
);

test(
  'validates outcome history queries and unavailable readers',
  async () => {
    const app =
      await createApp();
    const invalidLimit =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history?limit=0',
      });

    assert.equal(
      invalidLimit.statusCode,
      400,
    );
    await app.close();

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
          '/api/v1/setups/levels-v2/shadow/setup-outcomes/history',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await unavailable.close();
  },
);
