import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowConfirmationCandidateHistoryStore,
  LevelV2ShadowConfirmationCandidateHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-confirmation-candidate-history.js';
import type {
  LevelV2ShadowConfirmationCandidate,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-confirmation-candidate.types.js';
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

function candidate(
  overrides: Partial<
    LevelV2ShadowConfirmationCandidate
  > = {},
): LevelV2ShadowConfirmationCandidate {
  return {
    id:
      'SOLUSDT:classifier:confirmation-candidate:2',
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
    latestSequence:
      2,
    capturedAt:
      '2026-08-03T12:00:02.000Z',
    latestClassificationStatus:
      'breakout_confirmed',
    expectedDirection:
      'up',
    priceAcceptance:
      true,
    behavior:
      'directional_continuation',
    behaviorConfidence:
      'high',
    aggressionSide:
      'buy',
    priceDirection:
      'up',
    postEventReaction:
      'continuation',
    verdict:
      'supported',
    confidence:
      'high',
    reasons: [
      'price_acceptance_confirmed',
      'directional_continuation_aligned',
      'latest_evidence_complete',
    ],
    evidence: {
      latestAvailability:
        'complete',
      latestEvidenceCapturedAt:
        '2026-08-03T12:00:02.000Z',
      marketEvidenceEntriesCount:
        2,
      usableTapeEntriesCount:
        2,
      completeEntriesCount:
        2,
      behaviorHistoryEntriesCount:
        2,
      stableBehaviorEntriesCount:
        2,
      contradictoryBehaviorEntriesCount:
        0,
      netPriceChangePct:
        1,
      latestOrderBookImbalancePct:
        10,
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    tradeConfirmation:
      false,
    ...overrides,
  };
}

test(
  'deduplicates identical candidates while retaining material verdict transitions',
  () => {
    const store =
      new LevelV2ShadowConfirmationCandidateHistoryStore();
    const first =
      store.recordCandidate(
        candidate(),
      );
    const duplicate =
      store.recordCandidate(
        candidate({
          id:
            'SOLUSDT:classifier:confirmation-candidate:3',
          latestSequence:
            3,
          capturedAt:
            '2026-08-03T12:00:03.000Z',
        }),
      );
    const contradicted =
      store.recordCandidate(
        candidate({
          id:
            'SOLUSDT:classifier:confirmation-candidate:4',
          latestSequence:
            4,
          capturedAt:
            '2026-08-03T12:00:04.000Z',
          latestClassificationStatus:
            'false_breakout',
          priceAcceptance:
            false,
          behavior:
            'aggressive_buy_absorption',
          behaviorConfidence:
            'medium',
          priceDirection:
            'down',
          postEventReaction:
            'rejection',
          verdict:
            'contradicted',
          confidence:
            'high',
          reasons: [
            'false_breakout_classification',
            'aggressive_buy_absorption',
            'latest_evidence_complete',
          ],
        }),
      );

    assert.ok(first);
    assert.equal(
      duplicate,
      null,
    );
    assert.equal(
      contradicted?.changes
        .verdictChanged,
      true,
    );
    assert.equal(
      contradicted?.changes
        .classificationStatusChanged,
      true,
    );
    assert.equal(
      contradicted?.changes
        .postEventReactionChanged,
      true,
    );
    assert.equal(
      store.getStatus()
        .deduplicatedEntriesCount,
      1,
    );
    assert.equal(
      store.getHistory().length,
      2,
    );
  },
);

test(
  'captures reason and availability changes and returns defensive copies',
  () => {
    const store =
      new LevelV2ShadowConfirmationCandidateHistoryStore();

    store.recordCandidate(
      candidate(),
    );
    store.recordCandidate(
      candidate({
        id:
          'SOLUSDT:classifier:confirmation-candidate:3',
        latestSequence:
          3,
        capturedAt:
          '2026-08-03T12:00:03.000Z',
        verdict:
          'mixed',
        confidence:
          'medium',
        reasons: [
          'price_acceptance_confirmed',
          'recent_contradictory_behavior',
          'latest_evidence_tape_only',
        ],
        evidence: {
          ...candidate().evidence,
          latestAvailability:
            'tape_only',
        },
      }),
    );

    const firstRead =
      store.getHistory();

    assert.equal(
      firstRead[0]
        ?.changes.reasonsChanged,
      true,
    );
    assert.equal(
      firstRead[0]
        ?.changes.latestAvailabilityChanged,
      true,
    );

    firstRead[0]
      ?.candidate.reasons
      .push('mutated');
    firstRead[0]!
      .candidate.evidence
      .marketEvidenceEntriesCount = 999;

    const secondRead =
      store.getHistory();

    assert.equal(
      secondRead[0]
        ?.candidate.reasons
        .includes('mutated'),
      false,
    );
    assert.notEqual(
      secondRead[0]
        ?.candidate.evidence
        .marketEvidenceEntriesCount,
      999,
    );
  },
);

test(
  'enforces per-classifier and global history limits',
  () => {
    const store =
      new LevelV2ShadowConfirmationCandidateHistoryStore({
        maxEntriesPerClassifier:
          2,
        maxTotalEntries:
          3,
      });

    for (
      let index = 1;
      index <= 4;
      index += 1
    ) {
      store.recordCandidate(
        candidate({
          id:
            `SOLUSDT:classifier:confirmation-candidate:${index}`,
          latestSequence:
            index,
          capturedAt:
            `2026-08-03T12:00:0${index}.000Z`,
          verdict:
            index % 2 === 0
              ? 'supported'
              : 'mixed',
          confidence:
            index % 2 === 0
              ? 'high'
              : 'medium',
        }),
      );
    }

    store.recordCandidate(
      candidate({
        id:
          'ETHUSDT:classifier:confirmation-candidate:1',
        classifierId:
          'ETHUSDT:classifier',
        levelId:
          'ETHUSDT:support:1',
        symbol:
          'ETHUSDT',
        currentKind:
          'support',
        expectedDirection:
          'down',
        latestSequence:
          1,
        capturedAt:
          '2026-08-03T12:01:00.000Z',
        verdict:
          'insufficient_data',
        confidence:
          'low',
      }),
    );

    const status =
      store.getStatus();

    assert.equal(
      store.getHistory(
        undefined,
        'SOLUSDT:classifier',
        100,
      ).length,
      2,
    );
    assert.equal(
      status.entriesCount,
      3,
    );
    assert.equal(
      status.droppedEntriesCount,
      2,
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
  'rebuilds candidate transitions from temporal market evidence',
  () => {
    const {
      entries,
    } = recorded();
    const store =
      buildLevelV2ShadowConfirmationCandidateHistoryStore(
        entries,
      );
    const history =
      store.getHistory();

    assert.equal(
      history.length,
      2,
    );
    assert.deepEqual(
      history.map(
        (entry) =>
          entry.candidate.verdict,
      ),
      [
        'supported',
        'insufficient_data',
      ],
    );
    assert.equal(
      history[0]
        ?.changes.verdictChanged,
      true,
    );
    assert.equal(
      store.getDiagnostics()
        .verdictTransitionsCount,
      1,
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
        '2026-08-03T12:10:01.000Z',
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
  'exposes candidate history status list and diagnostics through shadow API',
  async () => {
    const app =
      await createApp();

    const statusResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/history/status?symbol=solusdt',
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

    const listResponse =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/history?symbol=solusdt&verdict=supported&limit=1',
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
        .candidate.verdict,
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
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/history/diagnostics',
      });

    assert.equal(
      diagnosticsResponse.statusCode,
      200,
    );
    assert.equal(
      diagnosticsResponse.json()
        .verdictTransitionsCount,
      1,
    );

    await app.close();
  },
);

test(
  'validates history queries and unavailable readers',
  async () => {
    const app =
      await createApp();
    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/history?verdict=confirmed',
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
          '/api/v1/setups/levels-v2/shadow/confirmation-candidates/history',
      });

    assert.equal(
      response.statusCode,
      503,
    );
    await unavailable.close();
  },
);
