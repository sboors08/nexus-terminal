import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  analyzeLevelV2ShadowMarketEvidenceBehavior,
  buildLevelV2ShadowMarketEvidenceBehaviorAnalyses,
  buildLevelV2ShadowMarketEvidenceBehaviorDiagnostics,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-market-evidence-behavior-analysis.js';
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

function recorded(
  values:
    readonly LevelV2ShadowMarketEvidence[],
): {
  store:
    LevelV2ShadowMarketEvidenceHistoryStore;
  entries:
    LevelV2ShadowMarketEvidenceHistoryEntry[];
} {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();

  for (
    const value
    of values
  ) {
    store.recordEvidence(
      value,
    );
  }

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
  'observes directional continuation without changing break classification',
  () => {
    const {
      entries,
    } = recorded([
      evidence(
        '2026-08-03T12:00:00.000Z',
      ),
      evidence(
        '2026-08-03T12:00:01.000Z',
        {
          classificationStatus:
            'breakout_confirmed',
          tape: {
            ...evidence(
              '2026-08-03T12:00:01.000Z',
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
    ]);

    const analysis =
      analyzeLevelV2ShadowMarketEvidenceBehavior(
        entries,
      );

    assert.ok(analysis);
    assert.equal(
      analysis.behavior,
      'directional_continuation',
    );
    assert.equal(
      analysis.aggressionSide,
      'buy',
    );
    assert.equal(
      analysis.priceDirection,
      'up',
    );
    assert.equal(
      analysis.latestClassificationStatus,
      'breakout_confirmed',
    );
    assert.equal(
      analysis.observationalOnly,
      true,
    );
    assert.equal(
      analysis.changesBreakClassification,
      false,
    );
  },
);

test(
  'observes aggressive buy absorption when buys rise but price falls',
  () => {
    const {
      entries,
    } = recorded([
      evidence(
        '2026-08-03T12:01:00.000Z',
      ),
      evidence(
        '2026-08-03T12:01:01.000Z',
        {
          tape: {
            ...evidence(
              '2026-08-03T12:01:01.000Z',
            ).tape!,
            quoteDelta:
              450,
            buySharePct:
              78,
            lastTradePrice:
              99,
            priceChangePct:
              -1,
          },
          orderBook: {
            ...evidence(
              '2026-08-03T12:01:01.000Z',
            ).orderBook!,
            bidDepthQuote:
              7_000,
            askDepthQuote:
              11_000,
            totalDepthQuote:
              18_000,
            imbalancePct:
              -22.22222222,
          },
        },
      ),
    ]);

    const analysis =
      analyzeLevelV2ShadowMarketEvidenceBehavior(
        entries,
      );

    assert.ok(analysis);
    assert.equal(
      analysis.behavior,
      'aggressive_buy_absorption',
    );
    assert.equal(
      analysis.confidence,
      'medium',
    );
  },
);

test(
  'observes aggressive sell absorption when sells dominate but price rises',
  () => {
    const sellTape = {
      ...evidence(
        '2026-08-03T12:02:00.000Z',
      ).tape!,
      buyQuoteValue:
        200,
      sellQuoteValue:
        600,
      totalQuoteValue:
        800,
      quoteDelta:
        -400,
      buySharePct:
        25,
      dominantSide:
        'sell' as const,
    };

    const {
      entries,
    } = recorded([
      evidence(
        '2026-08-03T12:02:00.000Z',
        {
          tape: {
            ...sellTape,
            lastTradePrice:
              100,
          },
        },
      ),
      evidence(
        '2026-08-03T12:02:01.000Z',
        {
          tape: {
            ...sellTape,
            quoteDelta:
              -500,
            buySharePct:
              20,
            lastTradePrice:
              101,
            priceChangePct:
              1,
          },
        },
      ),
    ]);

    const analysis =
      analyzeLevelV2ShadowMarketEvidenceBehavior(
        entries,
      );

    assert.ok(analysis);
    assert.equal(
      analysis.behavior,
      'aggressive_sell_absorption',
    );
    assert.equal(
      analysis.aggressionSide,
      'sell',
    );
  },
);

test(
  'observes momentum exhaustion after activity and aggression contract',
  () => {
    const {
      entries,
    } = recorded([
      evidence(
        '2026-08-03T12:03:00.000Z',
        {
          tape: {
            ...evidence(
              '2026-08-03T12:03:00.000Z',
            ).tape!,
            buyQuoteValue:
              800,
            sellQuoteValue:
              200,
            totalQuoteValue:
              1_000,
            quoteDelta:
              600,
            buySharePct:
              80,
            lastTradePrice:
              100,
          },
        },
      ),
      evidence(
        '2026-08-03T12:03:01.000Z',
        {
          tape: {
            ...evidence(
              '2026-08-03T12:03:01.000Z',
            ).tape!,
            buyQuoteValue:
              700,
            sellQuoteValue:
              200,
            totalQuoteValue:
              900,
            quoteDelta:
              500,
            buySharePct:
              77.77777778,
            lastTradePrice:
              101,
          },
        },
      ),
      evidence(
        '2026-08-03T12:03:02.000Z',
        {
          tape: {
            ...evidence(
              '2026-08-03T12:03:02.000Z',
            ).tape!,
            buyQuoteValue:
              200,
            sellQuoteValue:
              100,
            totalQuoteValue:
              300,
            quoteDelta:
              100,
            buySharePct:
              66.66666667,
            lastTradePrice:
              101.005,
          },
        },
      ),
    ]);

    const analysis =
      analyzeLevelV2ShadowMarketEvidenceBehavior(
        entries,
      );

    assert.ok(analysis);
    assert.equal(
      analysis.behavior,
      'momentum_exhaustion',
    );
    assert.equal(
      analysis.confidence,
      'high',
    );
    assert.equal(
      analysis.metrics
        .activityRatioToPrevious,
      0.33333333,
    );
    assert.equal(
      analysis.metrics
        .deltaRatioToPrevious,
      0.2,
    );
  },
);

test(
  'returns insufficient data and rejects mixed classifier histories',
  () => {
    const one =
      recorded([
        evidence(
          '2026-08-03T12:04:00.000Z',
        ),
      ]).entries;

    assert.equal(
      analyzeLevelV2ShadowMarketEvidenceBehavior(
        one,
      )?.behavior,
      'insufficient_data',
    );

    const secondClassifier =
      recorded([
        evidence(
          '2026-08-03T12:04:01.000Z',
          {
            id:
              'SOLUSDT:second:market:1',
            classifierId:
              'SOLUSDT:second',
          },
        ),
      ]).entries[0]!;

    assert.throws(
      () =>
        analyzeLevelV2ShadowMarketEvidenceBehavior([
          one[0]!,
          secondClassifier,
        ]),
      /requires one classifier history/,
    );
  },
);

test(
  'groups classifier histories and aggregates observational diagnostics',
  () => {
    const first =
      recorded([
        evidence(
          '2026-08-03T12:05:00.000Z',
        ),
        evidence(
          '2026-08-03T12:05:01.000Z',
          {
            tape: {
              ...evidence(
                '2026-08-03T12:05:01.000Z',
              ).tape!,
              lastTradePrice:
                101,
            },
          },
        ),
      ]);

    const second =
      recorded([
        evidence(
          '2026-08-03T12:05:02.000Z',
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
          },
        ),
      ]);

    const entries = [
      ...first.entries,
      ...second.entries,
    ];

    const analyses =
      buildLevelV2ShadowMarketEvidenceBehaviorAnalyses(
        entries,
      );
    const diagnostics =
      buildLevelV2ShadowMarketEvidenceBehaviorDiagnostics(
        analyses,
        entries.length,
        null,
      );

    assert.equal(
      analyses.length,
      2,
    );
    assert.equal(
      diagnostics
        .behaviorCounts
        .directional_continuation,
      1,
    );
    assert.equal(
      diagnostics
        .behaviorCounts
        .insufficient_data,
      1,
    );
    assert.equal(
      diagnostics.observationalOnly,
      true,
    );
  },
);

function reader():
LevelV2ShadowRuntimeReader {
  const {
    store,
  } = recorded([
    evidence(
      '2026-08-03T12:06:00.000Z',
    ),
    evidence(
      '2026-08-03T12:06:01.000Z',
      {
        tape: {
          ...evidence(
            '2026-08-03T12:06:01.000Z',
          ).tape!,
          quoteDelta:
            500,
          buySharePct:
            80,
          lastTradePrice:
            101,
        },
      },
    ),
  ]);

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
        '2026-08-03T12:06:01.000Z',
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
  'exposes behavior analyses and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const listResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-analysis?symbol=solusdt&behavior=directional_continuation&limit=1',
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
        .behavior,
      'directional_continuation',
    );
    assert.equal(
      body.items[0]
        .changesBreakClassification,
      false,
    );

    const diagnosticsResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-analysis/diagnostics?symbol=solusdt',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.equal(
      diagnosticsResponse.json()
        .analyzedClassifiersCount,
      1,
    );

    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-analysis?behavior=confirmed',
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

    const unavailableResponse =
      await unavailable.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/behavior-analysis',
      });

    assert.equal(
      unavailableResponse.statusCode,
      503,
    );

    await unavailable.close();
  },
);
