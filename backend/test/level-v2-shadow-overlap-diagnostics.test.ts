import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  buildLevelV2ShadowOverlapDiagnostics,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-overlap-diagnostics.js';
import type {
  LevelV2LifecycleState,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowHistoryEntry,
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from '../src/modules/setup-engine/level-v2/index.js';

const TEST_ENV:
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

function level(
  values: {
    id: string;
    referencePrice: number;
    coreLow: number;
    coreHigh: number;
    outerLow: number;
    outerHigh: number;
    kind?:
      'support'
      | 'resistance';
    originalKind?:
      'support'
      | 'resistance';
    status?:
      'forming'
      | 'active'
      | 'testing'
      | 'broken'
      | 'retest_pending'
      | 'flipped'
      | 'expired';
    eligibleForSetups?: boolean;
    score?: number;
  },
):
LevelV2LifecycleState {
  const kind =
    values.kind
    ?? 'resistance';

  return {
    id:
      `${values.id}:lifecycle`,
    originalKind:
      values.originalKind
      ?? kind,
    currentKind:
      kind,
    status:
      values.status
      ?? 'active',
    eligibleForSetups:
      values.eligibleForSetups
      ?? true,
    qualifiedTouchesCount:
      3,
    level: {
      id:
        values.id,
      kind:
        values.originalKind
        ?? kind,
      touchesCount:
        3,
      zone: {
        referencePrice:
          values.referencePrice,
        coreLow:
          values.coreLow,
        coreHigh:
          values.coreHigh,
        outerLow:
          values.outerLow,
        outerHigh:
          values.outerHigh,
        liquidityLow:
          values.outerLow - 0.1,
        liquidityHigh:
          values.outerHigh + 0.1,
      },
      score: {
        total:
          values.score
          ?? 80,
      },
    },
  } as
    unknown as
      LevelV2LifecycleState;
}

function snapshot(
  symbol: string,
  levels:
    readonly LevelV2LifecycleState[],
):
LevelV2ShadowSnapshot {
  return {
    symbol,
    timeframe:
      '1m',
    generatedAt:
      '2026-07-29T19:30:00.000Z',
    triggerSource:
      'history',
    sourceCandlesCount:
      240,
    closedCandlesCount:
      240,
    detectedZonesCount:
      levels.length,
    rejectedZonesCount:
      0,
    rejectionCounts: {
      insufficientTouches:
        0,
      acceptanceZone:
        0,
      structureMidrange:
        0,
      scoreBelowThreshold:
        0,
    },
    evaluation: {
      summary: {
        v1LevelsCount:
          levels.length,
        v2LevelsCount:
          levels.length,
        matchedLevelsCount:
          levels.length,
        v1OnlyLevelsCount:
          0,
        v2OnlyLevelsCount:
          0,
        setupEligibleV2LevelsCount:
          levels.filter(
            (item) =>
              item.eligibleForSetups,
          ).length,
        matchRatePct:
          100,
        meanMatchedDistancePct:
          0,
        lifecycleStatuses: {
          forming:
            0,
          active:
            levels.length,
          testing:
            0,
          broken:
            0,
          retestPending:
            0,
          flipped:
            0,
          expired:
            0,
        },
      },
      matches: [],
      v1OnlyLevels: [],
      v2OnlyLevels: [],
    },
    levels,
    lifecycleEvents: [],
  };
}

function historyEntry(
  sequence: number,
  ids:
    readonly string[],
):
LevelV2ShadowHistoryEntry {
  return {
    id:
      `SOLUSDT:history:${sequence}`,
    sequence,
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    generatedAt:
      `2026-07-29T19:${String(sequence).padStart(2, '0')}:00.000Z`,
    triggerSource:
      'history',
    sourceCandlesCount:
      240,
    closedCandlesCount:
      240,
    detectedZonesCount:
      ids.length,
    rejectedZonesCount:
      0,
    levelsCount:
      ids.length,
    eligibleLevelsCount:
      ids.length,
    evaluationSummary: {
      v1LevelsCount:
        ids.length,
      v2LevelsCount:
        ids.length,
      matchedLevelsCount:
        ids.length,
      v1OnlyLevelsCount:
        0,
      v2OnlyLevelsCount:
        0,
      setupEligibleV2LevelsCount:
        ids.length,
      matchRatePct:
        100,
      meanMatchedDistancePct:
        0,
      lifecycleStatuses: {
        forming:
          0,
        active:
          ids.length,
        testing:
          0,
        broken:
          0,
        retestPending:
          0,
        flipped:
          0,
        expired:
          0,
      },
    },
    lifecycleStatusCounts: {
      forming:
        0,
      active:
        ids.length,
      testing:
        0,
      broken:
        0,
      retest_pending:
        0,
      flipped:
        0,
      expired:
        0,
    },
    levels:
      ids.map(
        (id) => ({
          id,
          kind:
            'resistance',
          status:
            'active',
          eligibleForSetups:
            true,
          referencePrice:
            100,
          score:
            80,
          touchesCount:
            3,
          qualifiedTouchesCount:
            3,
        }),
      ),
    changes: {
      previousEntryId:
        null,
      addedLevelIds: [
        ...ids,
      ],
      removedLevelIds: [],
      lifecycleTransitions: [],
      matchRateDeltaPct:
        null,
      eligibleLevelsDelta:
        null,
    },
  };
}

function reader(
  snapshots:
    readonly LevelV2ShadowSnapshot[],
  history:
    readonly LevelV2ShadowHistoryEntry[] = [],
):
LevelV2ShadowRuntimeReader {
  return {
    getStatus: () => ({
      state:
        'running',
      snapshotsCount:
        snapshots.length,
      levelsCount:
        snapshots.reduce(
          (
            total,
            item,
          ) =>
            total
            + item.levels.length,
          0,
        ),
      eligibleLevelsCount:
        snapshots.reduce(
          (
            total,
            item,
          ) =>
            total
            + item.levels.filter(
                (state) =>
                  state.eligibleForSetups,
              ).length,
          0,
        ),
      scansCount:
        1,
      failedScans:
        0,
      lastScanAt:
        snapshots[0]
          ?.generatedAt
        ?? null,
      lastTriggerSource:
        'history',
      lastError:
        null,
    }),
    getSnapshots: () =>
      structuredClone(
        snapshots,
      ),
    getSnapshot: (
      symbol,
    ) =>
      structuredClone(
        snapshots.find(
          (item) =>
            item.symbol
            === symbol,
        )
        ?? null,
      ),
    getEvaluationHistory: (
      symbol,
      limit = 100,
    ) =>
      structuredClone(
        history
          .filter(
            (entry) =>
              symbol === undefined
              || entry.symbol
                === symbol,
          )
          .slice(
            0,
            limit,
          ),
      ),
    getEvaluationHistoryStatus: () => ({
      entriesCount:
        history.length,
      symbolsCount:
        new Set(
          history.map(
            (entry) =>
              entry.symbol,
          ),
        ).size,
      maxEntriesPerSymbol:
        60,
      maxTotalEntries:
        30_000,
      droppedEntriesCount:
        0,
      deduplicatedEntriesCount:
        0,
      oldestGeneratedAt:
        history.at(-1)
          ?.generatedAt
        ?? null,
      latestGeneratedAt:
        history[0]
          ?.generatedAt
        ?? null,
    }),
  };
}

function overlappingResistanceLevels():
readonly LevelV2LifecycleState[] {
  return [
    level({
      id:
        'resistance-a',
      referencePrice:
        100,
      coreLow:
        99.9,
      coreHigh:
        100.1,
      outerLow:
        99.8,
      outerHigh:
        100.2,
    }),
    level({
      id:
        'resistance-b',
      referencePrice:
        100.03,
      coreLow:
        99.95,
      coreHigh:
        100.12,
      outerLow:
        99.85,
      outerHigh:
        100.22,
    }),
  ];
}

test(
  'flags a same-kind overlap as a duplicate candidate',
  () => {
    const result =
      buildLevelV2ShadowOverlapDiagnostics(
        reader([
          snapshot(
            'SOLUSDT',
            overlappingResistanceLevels(),
          ),
        ]),
      );

    assert.equal(
      result.summary
        .duplicateCandidatesCount,
      1,
    );

    assert.equal(
      result.items[0]
        ?.relationship,
      'same_kind_core_overlap',
    );

    assert.equal(
      result.items[0]
        ?.duplicateCandidate,
      true,
    );
  },
);

test(
  'retains history persistence evidence for a current pair',
  () => {
    const history = [
      historyEntry(
        3,
        [
          'resistance-a',
          'resistance-b',
        ],
      ),
      historyEntry(
        2,
        [
          'resistance-a',
        ],
      ),
      historyEntry(
        1,
        [
          'resistance-a',
          'resistance-b',
        ],
      ),
    ];

    const result =
      buildLevelV2ShadowOverlapDiagnostics(
        reader(
          [
            snapshot(
              'SOLUSDT',
              overlappingResistanceLevels(),
            ),
          ],
          history,
        ),
      );

    assert.equal(
      result.items[0]
        ?.history.occurrencesCount,
      2,
    );

    assert.equal(
      result.items[0]
        ?.history.entriesChecked,
      3,
    );

    assert.equal(
      result.items[0]
        ?.history.persistencePct,
      66.66666667,
    );
  },
);

test(
  'reports a nearby disjoint same-kind pair without calling it a duplicate',
  () => {
    const result =
      buildLevelV2ShadowOverlapDiagnostics(
        reader([
          snapshot(
            'SOLUSDT',
            [
              level({
                id:
                  'near-a',
                referencePrice:
                  100,
                coreLow:
                  99.95,
                coreHigh:
                  100.02,
                outerLow:
                  99.9,
                outerHigh:
                  100.05,
              }),
              level({
                id:
                  'near-b',
                referencePrice:
                  100.15,
                coreLow:
                  100.12,
                coreHigh:
                  100.18,
                outerLow:
                  100.1,
                outerHigh:
                  100.2,
              }),
            ],
          ),
        ]),
      );

    assert.equal(
      result.items[0]
        ?.relationship,
      'same_kind_nearby',
    );

    assert.equal(
      result.items[0]
        ?.duplicateCandidate,
      false,
    );

    assert.ok(
      (
        result.items[0]
          ?.outerGapPct
        ?? 0
      ) > 0,
    );
  },
);

test(
  'flags an eligible opposite-kind overlap as a conflict candidate',
  () => {
    const result =
      buildLevelV2ShadowOverlapDiagnostics(
        reader([
          snapshot(
            'SOLUSDT',
            [
              level({
                id:
                  'support',
                kind:
                  'support',
                referencePrice:
                  100,
                coreLow:
                  99.9,
                coreHigh:
                  100.1,
                outerLow:
                  99.8,
                outerHigh:
                  100.2,
              }),
              level({
                id:
                  'resistance',
                kind:
                  'resistance',
                referencePrice:
                  100.02,
                coreLow:
                  99.95,
                coreHigh:
                  100.12,
                outerLow:
                  99.85,
                outerHigh:
                  100.22,
              }),
            ],
          ),
        ]),
      );

    assert.equal(
      result.summary
        .conflictCandidatesCount,
      1,
    );

    assert.equal(
      result.items[0]
        ?.conflictCandidate,
      true,
    );
  },
);

test(
  'filters symbols opposite kinds review candidates and result limits',
  () => {
    const result =
      buildLevelV2ShadowOverlapDiagnostics(
        reader([
          snapshot(
            'SOLUSDT',
            overlappingResistanceLevels(),
          ),
          snapshot(
            'ETHUSDT',
            [
              level({
                id:
                  'eth-support',
                kind:
                  'support',
                referencePrice:
                  200,
                coreLow:
                  199.9,
                coreHigh:
                  200.1,
                outerLow:
                  199.8,
                outerHigh:
                  200.2,
              }),
              level({
                id:
                  'eth-resistance',
                kind:
                  'resistance',
                referencePrice:
                  200.01,
                coreLow:
                  199.95,
                coreHigh:
                  200.12,
                outerLow:
                  199.85,
                outerHigh:
                  200.22,
              }),
            ],
          ),
        ]),
        {
          symbol:
            'SOLUSDT',
          includeOppositeKind:
            false,
          onlyReviewCandidates:
            true,
          limit:
            1,
        },
      );

    assert.equal(
      result.summary
        .snapshotsAnalyzed,
      1,
    );

    assert.equal(
      result.summary
        .returnedPairsCount,
      1,
    );

    assert.equal(
      result.items[0]
        ?.symbol,
      'SOLUSDT',
    );
  },
);

test(
  'rejects invalid overlap diagnostics options',
  () => {
    const runtime =
      reader([]);

    assert.throws(
      () =>
        buildLevelV2ShadowOverlapDiagnostics(
          runtime,
          {
            maxReferenceDistancePct:
              -1,
          },
        ),
      /maxReferenceDistancePct/u,
    );

    assert.throws(
      () =>
        buildLevelV2ShadowOverlapDiagnostics(
          runtime,
          {
            minOverlapPct:
              101,
          },
        ),
      /minOverlapPct/u,
    );

    assert.throws(
      () =>
        buildLevelV2ShadowOverlapDiagnostics(
          runtime,
          {
            limit:
              0,
          },
        ),
      /limit/u,
    );
  },
);

async function createApp(
  runtime:
    LevelV2ShadowRuntimeReader
    | null,
) {
  return buildApp({
    env:
      TEST_ENV,
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
      runtime,
  });
}

test(
  'overlap diagnostics route exposes current pairs and history evidence',
  async () => {
    const app =
      await createApp(
        reader(
          [
            snapshot(
              'SOLUSDT',
              overlappingResistanceLevels(),
            ),
          ],
          [
            historyEntry(
              1,
              [
                'resistance-a',
                'resistance-b',
              ],
            ),
          ],
        ),
      );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/overlap-diagnostics?symbol=solusdt&onlyReviewCandidates=true',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const body =
      response.json();

    assert.equal(
      body.summary
        .duplicateCandidatesCount,
      1,
    );

    assert.equal(
      body.items[0]
        .history.occurrencesCount,
      1,
    );

    await app.close();
  },
);

test(
  'overlap diagnostics route validates query parameters',
  async () => {
    const app =
      await createApp(
        reader([]),
      );

    for (
      const query
      of [
        'maxReferenceDistancePct=-1',
        'minOverlapPct=101',
        'includeOppositeKind=maybe',
        'onlyReviewCandidates=maybe',
        'limit=0',
        'symbol=bad!',
      ]
    ) {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            `/api/v1/setups/levels-v2/shadow/overlap-diagnostics?${query}`,
        });

      assert.equal(
        response.statusCode,
        400,
      );
    }

    await app.close();
  },
);

test(
  'overlap diagnostics route returns 503 without a runtime reader',
  async () => {
    const app =
      await createApp(
        null,
      );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/overlap-diagnostics',
      });

    assert.equal(
      response.statusCode,
      503,
    );

    await app.close();
  },
);
