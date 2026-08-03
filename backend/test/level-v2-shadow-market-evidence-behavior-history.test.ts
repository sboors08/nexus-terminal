import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore,
  LevelV2ShadowMarketEvidenceBehaviorHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-history.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorAnalysis,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-analysis.types.js';
import {
  LevelV2ShadowMarketEvidenceHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-history.js';
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

function behaviorAnalysis(
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
      'breakout_pending',
    firstSequence:
      1,
    latestSequence:
      2,
    firstCapturedAt:
      '2026-08-03T14:00:00.000Z',
    latestCapturedAt:
      '2026-08-03T14:00:01.000Z',
    behavior:
      'directional_continuation',
    confidence:
      'medium',
    aggressionSide:
      'buy',
    priceDirection:
      'up',
    reasons: [
      'buy aggression moved with price',
    ],
    metrics: {
      sourceEntriesCount:
        2,
      usableTapeEntriesCount:
        2,
      completeEntriesCount:
        2,
      classificationTransitionsCount:
        0,
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
        8,
      latestTotalQuoteValue:
        800,
      activityRatioToPrevious:
        1.1,
      deltaRatioToPrevious:
        1.2,
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

function evidenceStore() {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();

  store.recordEvidence(
    evidence(
      '2026-08-03T14:10:00.000Z',
    ),
  );
  store.recordEvidence(
    evidence(
      '2026-08-03T14:10:01.000Z',
      {
        classificationStatus:
          'breakout_confirmed',
        tape: {
          ...evidence(
            '2026-08-03T14:10:01.000Z',
          ).tape!,
          buyQuoteValue:
            650,
          sellQuoteValue:
            150,
          totalQuoteValue:
            800,
          quoteDelta:
            500,
          buySharePct:
            81.25,
          lastTradePrice:
            101,
          priceChangePct:
            1,
        },
      },
    ),
  );

  return store;
}

test(
  'deduplicates identical behavior results while retaining material transitions',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceBehaviorHistoryStore();

    const first =
      store.recordAnalysis(
        behaviorAnalysis(),
      );
    const duplicate =
      store.recordAnalysis(
        behaviorAnalysis({
          id:
            'SOLUSDT:classifier:behavior:3',
          latestSequence:
            3,
          latestCapturedAt:
            '2026-08-03T14:00:02.000Z',
          metrics: {
            ...behaviorAnalysis().metrics,
            sourceEntriesCount:
              3,
          },
        }),
      );
    const transition =
      store.recordAnalysis(
        behaviorAnalysis({
          id:
            'SOLUSDT:classifier:behavior:4',
          latestSequence:
            4,
          latestCapturedAt:
            '2026-08-03T14:00:03.000Z',
          behavior:
            'aggressive_buy_absorption',
          confidence:
            'high',
          priceDirection:
            'down',
          reasons: [
            'buy aggression rose while price fell',
          ],
        }),
      );

    assert.ok(first);
    assert.equal(
      duplicate,
      null,
    );
    assert.ok(transition);
    assert.equal(
      transition.changes
        .behaviorChanged,
      true,
    );
    assert.equal(
      transition.changes
        .confidenceChanged,
      true,
    );
    assert.equal(
      transition.changes
        .priceDirectionChanged,
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
  'captures classification and reason changes without changing break classification',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceBehaviorHistoryStore();

    store.recordAnalysis(
      behaviorAnalysis(),
    );
    const entry =
      store.recordAnalysis(
        behaviorAnalysis({
          latestClassificationStatus:
            'breakout_confirmed',
          reasons: [
            'continuation persisted after acceptance',
          ],
        }),
      );

    assert.ok(entry);
    assert.equal(
      entry.changes
        .classificationStatusChanged,
      true,
    );
    assert.equal(
      entry.changes
        .reasonsChanged,
      true,
    );
    assert.equal(
      entry.observationalOnly,
      true,
    );
    assert.equal(
      entry.changesBreakClassification,
      false,
    );
    assert.equal(
      entry.analysis
        .latestClassificationStatus,
      'breakout_confirmed',
    );
  },
);

test(
  'enforces bounded histories and returns defensive copies',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceBehaviorHistoryStore({
        maxEntriesPerClassifier:
          2,
        maxTotalEntries:
          3,
      });

    for (
      let index = 0;
      index < 4;
      index += 1
    ) {
      store.recordAnalysis(
        behaviorAnalysis({
          id:
            `SOLUSDT:classifier:behavior:${index}`,
          latestCapturedAt:
            `2026-08-03T14:01:0${index}.000Z`,
          behavior:
            index % 2 === 0
              ? 'directional_continuation'
              : 'mixed',
        }),
      );
    }

    store.recordAnalysis(
      behaviorAnalysis({
        id:
          'ETHUSDT:classifier:behavior:1',
        classifierId:
          'ETHUSDT:classifier',
        levelId:
          'ETHUSDT:support:1',
        symbol:
          'ETHUSDT',
        currentKind:
          'support',
        behavior:
          'insufficient_data',
        aggressionSide:
          'unknown',
        priceDirection:
          'unknown',
      }),
    );

    const values =
      store.getHistory(
        undefined,
        undefined,
        100,
      );

    assert.equal(
      values.length,
      3,
    );
    assert.ok(
      store.getStatus()
        .droppedEntriesCount
        >= 2,
    );

    values[0]!.analysis.reasons
      .push('mutated');

    assert.equal(
      store.getHistory(
        undefined,
        undefined,
        100,
      )[0]!.analysis.reasons
        .includes('mutated'),
      false,
    );
  },
);

test(
  'rebuilds behavior transitions from temporal market evidence',
  () => {
    const source =
      evidenceStore();
    const store =
      buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore(
        source.getHistory(
          undefined,
          undefined,
          100,
        ),
      );
    const values =
      store.getHistory(
        'SOLUSDT',
        'SOLUSDT:classifier',
        100,
      );

    assert.equal(
      values.length,
      2,
    );
    assert.equal(
      values[0]!.analysis
        .behavior,
      'directional_continuation',
    );
    assert.equal(
      values[0]!.changes
        .behaviorBefore,
      'insufficient_data',
    );
    assert.equal(
      values[0]!.changes
        .behaviorChanged,
      true,
    );
    assert.equal(
      values[1]!.analysis
        .behavior,
      'insufficient_data',
    );
  },
);

function reader():
LevelV2ShadowRuntimeReader {
  const store =
    evidenceStore();

  return {
    getStatus: () => ({
      state:
        'running',
      snapshotsCount:
        1,
      levelsCount:
        1,
      eligibleLevelsCount:
        1,
      scansCount:
        2,
      failedScans:
        0,
      lastScanAt:
        '2026-08-03T14:10:01.000Z',
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
  'exposes behavior history status list and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const listResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-history?symbol=solusdt&behavior=directional_continuation&limit=1',
      });
    const listBody =
      listResponse.json();

    assert.equal(
      listResponse.statusCode,
      200,
    );
    assert.equal(
      listBody.count,
      1,
    );
    assert.equal(
      listBody.items[0]
        .analysis.behavior,
      'directional_continuation',
    );
    assert.equal(
      listBody.items[0]
        .changesBreakClassification,
      false,
    );

    const statusResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-history/status?symbol=solusdt',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );
    assert.equal(
      statusResponse.json()
        .entriesCount,
      2,
    );
    assert.equal(
      statusResponse.json()
        .observationalOnly,
      true,
    );

    const diagnosticsResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-history/diagnostics?symbol=solusdt',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.equal(
      diagnosticsResponse.json()
        .behaviorTransitionsCount,
      1,
    );

    await app.close();
  },
);

test(
  'validates behavior-history queries and unavailable readers',
  async () => {
    const app =
      await createApp();

    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-history?behavior=confirmed',
      });

    assert.equal(
      invalid.statusCode,
      400,
    );

    await app.close();

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
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-history',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await unavailable.close();
  },
);
