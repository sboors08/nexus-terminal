import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
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
        101,
      priceChangePct:
        1,
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
        100.9,
      bestAsk:
        101,
      spreadPct:
        0.09905847,
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

test(
  'records temporal market-evidence changes without interpreting confirmation',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();

    const first =
      store.recordEvidence(
        evidence(
          '2026-08-02T12:00:00.000Z',
        ),
      );

    const second =
      store.recordEvidence(
        evidence(
          '2026-08-02T12:00:01.000Z',
          {
            classificationStatus:
              'breakout_confirmed',
            tape: {
              ...evidence(
                '2026-08-02T12:00:01.000Z',
              ).tape!,
              quoteDelta:
                450,
              buySharePct:
                80,
              priceChangePct:
                1.4,
            },
            orderBook: {
              ...evidence(
                '2026-08-02T12:00:01.000Z',
              ).orderBook!,
              bidDepthQuote:
                11_500,
              askDepthQuote:
                7_500,
              imbalancePct:
                21.05263158,
              spreadPct:
                0.08,
            },
          },
        ),
      );

    assert.ok(first);
    assert.ok(second);
    assert.equal(
      second.changes
        .classificationStatusBefore,
      'breakout_pending',
    );
    assert.equal(
      second.changes
        .classificationStatusAfter,
      'breakout_confirmed',
    );
    assert.equal(
      second.changes
        .tapeQuoteDeltaChange,
      150,
    );
    assert.equal(
      second.changes
        .tapePriceChangePctChange,
      0.4,
    );
    assert.equal(
      second.changes
        .orderBookBidDepthQuoteChange,
      1_500,
    );
    assert.equal(
      second.changes
        .orderBookAskDepthQuoteChange,
      -500,
    );
  },
);

test(
  'deduplicates unchanged evidence even when capture ids and timestamps change',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();

    store.recordEvidence(
      evidence(
        '2026-08-02T12:00:00.000Z',
      ),
    );

    const duplicate =
      store.recordEvidence(
        evidence(
          '2026-08-02T12:00:01.000Z',
        ),
      );

    assert.equal(
      duplicate,
      null,
    );
    assert.equal(
      store.getStatus()
        .deduplicatedEntriesCount,
      1,
    );
  },
);

test(
  'isolates classifier histories and returns defensive copies',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore();

    store.recordEvidence(
      evidence(
        '2026-08-02T12:00:00.000Z',
      ),
    );
    store.recordEvidence(
      evidence(
        '2026-08-02T12:00:01.000Z',
        {
          id:
            'SOLUSDT:second:market:1',
          classifierId:
            'SOLUSDT:second',
          levelId:
            'SOLUSDT:support:2',
          currentKind:
            'support',
        },
      ),
    );

    const firstHistory =
      store.getHistory(
        'solusdt',
        'SOLUSDT:classifier',
      );

    assert.equal(
      firstHistory.length,
      1,
    );

    firstHistory[0]!
      .evidence.tape!
      .quoteDelta = 999;

    assert.deepEqual(
      store.getHistory(
        'SOLUSDT',
        'SOLUSDT:classifier',
      )[0]?.evidence
        .tape
        ?.quoteDelta,
      300,
    );
  },
);

test(
  'enforces per-classifier and global history limits',
  () => {
    const store =
      new LevelV2ShadowMarketEvidenceHistoryStore({
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
      store.recordEvidence(
        evidence(
          `2026-08-02T12:00:0${index}.000Z`,
          {
            tape: {
              ...evidence(
                '2026-08-02T12:00:00.000Z',
              ).tape!,
              quoteDelta:
                300 + index,
            },
          },
        ),
      );
    }

    assert.equal(
      store.getHistory(
        undefined,
        'SOLUSDT:classifier',
        10,
      ).length,
      2,
    );
    assert.equal(
      store.getStatus()
        .droppedEntriesCount,
      2,
    );
  },
);

function reader():
LevelV2ShadowRuntimeReader {
  const store =
    new LevelV2ShadowMarketEvidenceHistoryStore();

  store.recordEvidence(
    evidence(
      '2026-08-02T12:00:00.000Z',
    ),
  );

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
        1,
      failedScans:
        0,
      lastScanAt:
        '2026-08-02T12:00:00.000Z',
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
  'exposes market-evidence history and status through shadow API',
  async () => {
    const app =
      await createApp();

    const listResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/history?symbol=solusdt&classifierId=SOLUSDT:classifier&limit=1',
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
        .evidence.classifierId,
      'SOLUSDT:classifier',
    );

    const statusResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/history/status',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );
    assert.equal(
      statusResponse.json()
        .entriesCount,
      1,
    );

    await app.close();
  },
);

test(
  'validates market-evidence history queries and unavailable readers',
  async () => {
    const app =
      await createApp();

    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/market-evidence/history?limit=0',
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
          '/api/v1/setups/levels-v2/shadow/market-evidence/history/status',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await unavailable.close();
  },
);
