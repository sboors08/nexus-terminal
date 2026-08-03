import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowConfirmationCandidateDiagnostics,
  buildLevelV2ShadowConfirmationCandidates,
  evaluateLevelV2ShadowConfirmationCandidate,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-confirmation-candidate.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-analysis.types.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorHistoryEntry,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-history.types.js';
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
  LevelV2ShadowRuntimeReader,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';

const testEnv = {
  nodeEnv: 'test',
  logLevel: 'silent',
  port: 0,
  host: '127.0.0.1',
  apiPrefix: '/api/v1',
  corsOrigins: ['*'],
} as unknown as AppEnv;

function analysis(
  overrides: Partial<
    LevelV2ShadowMarketEvidenceBehaviorAnalysis
  > = {},
): LevelV2ShadowMarketEvidenceBehaviorAnalysis {
  return {
    id:
      'SOLUSDT:classifier:behavior:2',
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
    latestClassificationStatus:
      'breakout_confirmed',
    firstSequence:
      1,
    latestSequence:
      2,
    firstCapturedAt:
      '2026-08-03T12:00:00.000Z',
    latestCapturedAt:
      '2026-08-03T12:00:01.000Z',
    behavior:
      'directional_continuation',
    confidence:
      'high',
    aggressionSide:
      'buy',
    priceDirection:
      'up',
    reasons: [
      'buy_aggression_and_price_move_align',
    ],
    metrics: {
      sourceEntriesCount:
        2,
      usableTapeEntriesCount:
        2,
      completeEntriesCount:
        2,
      classificationTransitionsCount:
        1,
      firstTradePrice:
        100,
      latestTradePrice:
        101,
      netPriceChangePct:
        1,
      latestQuoteDelta:
        500,
      quoteDeltaChange:
        200,
      latestBuySharePct:
        80,
      buySharePctChange:
        10,
      latestTotalQuoteValue:
        800,
      activityRatioToPrevious:
        1.2,
      deltaRatioToPrevious:
        1.5,
      latestOrderBookImbalancePct:
        10,
      orderBookImbalancePctChange:
        2,
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    ...overrides,
  };
}

function behaviorEntry(
  sequence: number,
  value:
    LevelV2ShadowMarketEvidenceBehaviorAnalysis =
      analysis(),
): LevelV2ShadowMarketEvidenceBehaviorHistoryEntry {
  return {
    id:
      `${value.classifierId}:behavior-history:${sequence}`,
    sequence,
    classifierId:
      value.classifierId,
    levelId:
      value.levelId,
    symbol:
      value.symbol,
    timeframe:
      value.timeframe,
    capturedAt:
      value.latestCapturedAt,
    analysis:
      value,
    changes: {
      previousEntryId:
        null,
      behaviorBefore:
        null,
      behaviorAfter:
        value.behavior,
      confidenceBefore:
        null,
      confidenceAfter:
        value.confidence,
      aggressionSideBefore:
        null,
      aggressionSideAfter:
        value.aggressionSide,
      priceDirectionBefore:
        null,
      priceDirectionAfter:
        value.priceDirection,
      classificationStatusBefore:
        null,
      classificationStatusAfter:
        value.latestClassificationStatus,
      behaviorChanged:
        false,
      confidenceChanged:
        false,
      aggressionSideChanged:
        false,
      priceDirectionChanged:
        false,
      classificationStatusChanged:
        false,
      reasonsChanged:
        false,
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
  };
}

function marketEntry(
  sequence: number,
  availability:
    LevelV2ShadowMarketEvidence['availability'] =
      'complete',
): LevelV2ShadowMarketEvidenceHistoryEntry {
  const capturedAt =
    `2026-08-03T12:00:0${sequence}.000Z`;

  return {
    id:
      `SOLUSDT:classifier:market-history:${sequence}`,
    sequence,
    evidence: {
      id:
        `SOLUSDT:classifier:market:${sequence}`,
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
        'breakout_confirmed',
      capturedAt,
      availability,
      tape:
        null,
      orderBook:
        null,
      sourceErrors: [],
    },
    changes: {
      previousEntryId:
        null,
      classificationStatusBefore:
        null,
      classificationStatusAfter:
        'breakout_confirmed',
      availabilityBefore:
        null,
      availabilityAfter:
        availability,
      tapeQuoteDeltaChange:
        null,
      tapeBuySharePctChange:
        null,
      tapePriceChangePctChange:
        null,
      tapeDominantSideChanged:
        false,
      orderBookImbalancePctChange:
        null,
      orderBookBidDepthQuoteChange:
        null,
      orderBookAskDepthQuoteChange:
        null,
      orderBookSpreadPctChange:
        null,
      orderBookStateChanged:
        false,
      sourceErrorsChanged:
        false,
    },
  };
}

test(
  'supports a price-accepted directional continuation without changing break classification',
  () => {
    const value =
      analysis();
    const candidate =
      evaluateLevelV2ShadowConfirmationCandidate(
        value,
        [
          behaviorEntry(
            2,
            value,
          ),
          behaviorEntry(
            1,
            value,
          ),
        ],
        [
          marketEntry(
            1,
          ),
          marketEntry(
            2,
          ),
        ],
      );

    assert.equal(
      candidate.verdict,
      'supported',
    );
    assert.equal(
      candidate.confidence,
      'high',
    );
    assert.equal(
      candidate.priceAcceptance,
      true,
    );
    assert.equal(
      candidate.postEventReaction,
      'continuation',
    );
    assert.equal(
      candidate.changesBreakClassification,
      false,
    );
    assert.equal(
      candidate.tradeConfirmation,
      false,
    );
  },
);

test(
  'does not support a wick pierce without price acceptance',
  () => {
    const value =
      analysis({
        latestClassificationStatus:
          'pierce',
      });
    const candidate =
      evaluateLevelV2ShadowConfirmationCandidate(
        value,
        [
          behaviorEntry(
            1,
            value,
          ),
        ],
        [
          marketEntry(
            1,
          ),
        ],
      );

    assert.equal(
      candidate.verdict,
      'mixed',
    );
    assert.equal(
      candidate.priceAcceptance,
      false,
    );
    assert.ok(
      candidate.reasons.includes(
        'wick_pierce_without_price_acceptance',
      ),
    );
  },
);

test(
  'contradicts false breakouts absorption and exhaustion',
  () => {
    for (
      const value
      of [
        analysis({
          latestClassificationStatus:
            'false_breakout',
        }),
        analysis({
          behavior:
            'aggressive_buy_absorption',
          confidence:
            'medium',
          priceDirection:
            'down',
        }),
        analysis({
          behavior:
            'momentum_exhaustion',
          priceDirection:
            'flat',
        }),
      ]
    ) {
      const candidate =
        evaluateLevelV2ShadowConfirmationCandidate(
          value,
          [
            behaviorEntry(
              1,
              value,
            ),
          ],
          [
            marketEntry(
              1,
            ),
          ],
        );

      assert.equal(
        candidate.verdict,
        'contradicted',
      );
    }
  },
);

test(
  'treats order-book-only evidence as insufficient and never as execution',
  () => {
    const value =
      analysis();
    const candidate =
      evaluateLevelV2ShadowConfirmationCandidate(
        value,
        [
          behaviorEntry(
            1,
            value,
          ),
        ],
        [
          marketEntry(
            1,
            'order_book_only',
          ),
        ],
      );

    assert.equal(
      candidate.verdict,
      'insufficient_data',
    );
    assert.ok(
      candidate.reasons.includes(
        'order_book_without_tape_cannot_support',
      ),
    );
  },
);

function evidence(
  capturedAt: string,
  overrides: Partial<
    LevelV2ShadowMarketEvidence
  > = {},
): LevelV2ShadowMarketEvidence {
  return {
    id:
      `SOLUSDT:classifier:market:${capturedAt}`,
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
      'breakout_pending',
    capturedAt,
    availability:
      'complete',
    tape: {
      snapshotUpdatedAt:
        capturedAt,
      lastTradeAt:
        capturedAt,
      tradesCount:
        3,
      executionsCount:
        6,
      buyQuoteValue:
        500,
      sellQuoteValue:
        200,
      totalQuoteValue:
        700,
      quoteDelta:
        300,
      buySharePct:
        71.42857143,
      dominantSide:
        'buy',
      largestTradeQuoteValue:
        300,
      firstTradePrice:
        100,
      lastTradePrice:
        100,
      priceChangePct:
        0,
    },
    orderBook: {
      state:
        'live',
      synchronized:
        true,
      updatedAt:
        capturedAt,
      ageMs:
        20,
      staleAfterMs:
        5_000,
      bestBid:
        99.9,
      bestAsk:
        100,
      spreadPct:
        0.10005003,
      bidDepthQuote:
        10_000,
      askDepthQuote:
        8_000,
      totalDepthQuote:
        18_000,
      imbalancePct:
        11.11111111,
    },
    sourceErrors: [],
    ...overrides,
  };
}

function recorded(): {
  store:
    LevelV2ShadowMarketEvidenceHistoryStore;
  entries:
    LevelV2ShadowMarketEvidenceHistoryEntry[];
} {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();

  store.recordEvidence(
    evidence(
      '2026-08-03T12:10:00.000Z',
    ),
  );
  store.recordEvidence(
    evidence(
      '2026-08-03T12:10:01.000Z',
      {
        classificationStatus:
          'breakout_confirmed',
        tape: {
          ...evidence(
            '2026-08-03T12:10:01.000Z',
          ).tape!,
          buyQuoteValue:
            700,
          sellQuoteValue:
            100,
          totalQuoteValue:
            800,
          quoteDelta:
            600,
          buySharePct:
            87.5,
          lastTradePrice:
            101,
          priceChangePct:
            1,
        },
      },
    ),
  );
  store.recordEvidence(
    evidence(
      '2026-08-03T12:10:02.000Z',
      {
        id:
          'ETHUSDT:classifier:market:1',
        classifierId:
          'ETHUSDT:classifier',
        levelId:
          'ETHUSDT:support:1',
        symbol:
          'ETHUSDT',
        currentKind:
          'support',
        classificationStatus:
          'pierce',
        availability:
          'order_book_only',
        tape:
          null,
      },
    ),
  );

  return {
    store,
    entries:
      store.getHistory(
        undefined,
        undefined,
        100,
      ),
  };
}

test(
  'builds isolated candidates and aggregate diagnostics',
  () => {
    const {
      entries,
    } = recorded();
    const candidates =
      buildLevelV2ShadowConfirmationCandidates(
        entries,
      );
    const diagnostics =
      buildLevelV2ShadowConfirmationCandidateDiagnostics(
        candidates,
      );

    assert.equal(
      candidates.length,
      2,
    );
    assert.equal(
      candidates.find(
        (candidate) =>
          candidate.symbol
            === 'SOLUSDT',
      )?.verdict,
      'supported',
    );
    assert.equal(
      candidates.find(
        (candidate) =>
          candidate.symbol
            === 'ETHUSDT',
      )?.verdict,
      'insufficient_data',
    );
    assert.equal(
      diagnostics.candidatesCount,
      2,
    );
    assert.equal(
      diagnostics.verdictCounts
        .supported,
      1,
    );
    assert.equal(
      diagnostics.tradeConfirmation,
      false,
    );
  },
);

function reader():
LevelV2ShadowRuntimeReader {
  const {
    store,
  } = recorded();

  return {
    getStatus: () => ({
      state:
        'running',
      snapshotsCount:
        2,
      levelsCount:
        2,
      eligibleLevelsCount:
        2,
      scansCount:
        3,
      failedScans:
        0,
      lastScanAt:
        '2026-08-03T12:10:02.000Z',
      lastTriggerSource:
        'live',
      lastError:
        null,
    }),
    getSnapshots: () => [],
    getSnapshot: () => null,
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
      runtimeReader,
  });
}

test(
  'exposes filtered confirmation candidates and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const listResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates?symbol=solusdt&verdict=supported&limit=1',
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
        .verdict,
      'supported',
    );
    assert.equal(
      body.items[0]
        .tradeConfirmation,
      false,
    );

    const diagnosticsResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/diagnostics',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.equal(
      diagnosticsResponse.json()
        .candidatesCount,
      2,
    );

    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates?verdict=confirmed',
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
    const unavailable =
      await createApp({
        getStatus:
          reader().getStatus,
        getSnapshots: () => [],
        getSnapshot: () => null,
      });
    const response =
      await unavailable.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await unavailable.close();
  },
);
