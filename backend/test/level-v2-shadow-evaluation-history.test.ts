import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  LevelV2ShadowHistoryStore,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-history.js';
import {
  DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  LevelV2ShadowRuntimeService,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.js';
import type {
  LevelV2ShadowHistoryEntry,
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from '../src/modules/setup-engine/level-v2/index.js';
import type {
  LevelV2LifecycleState,
  LevelV2LifecycleStatus,
} from '../src/modules/setup-engine/level-v2/level-v2-lifecycle.types.js';
import type {
  SetupDetectionKlineChange,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';

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
  id: string,
  status:
    LevelV2LifecycleStatus,
  eligibleForSetups: boolean,
  score = 80,
): LevelV2LifecycleState {
  return {
    id:
      `${id}:lifecycle`,
    currentKind:
      'resistance',
    status,
    eligibleForSetups,
    qualifiedTouchesCount:
      eligibleForSetups
        ? 3
        : 2,
    level: {
      id,
      kind:
        'resistance',
      touchesCount:
        2,
      zone: {
        referencePrice:
          100,
      },
      score: {
        total:
          score,
      },
    },
  } as
    unknown as
      LevelV2LifecycleState;
}

function snapshot(
  symbol: string,
  generatedAt: string,
  closedCandlesCount: number,
  levels:
    readonly LevelV2LifecycleState[] = [],
  matchRatePct = 75,
): LevelV2ShadowSnapshot {
  const eligible =
    levels.filter(
      (item) =>
        item.eligibleForSetups,
    ).length;

  return {
    symbol,
    timeframe:
      '1m',
    generatedAt,
    triggerSource:
      'history',
    sourceCandlesCount:
      closedCandlesCount,
    closedCandlesCount,
    detectedZonesCount:
      levels.length,
    rejectedZonesCount:
      2,
    rejectionCounts: {
      insufficientTouches:
        1,
      acceptanceZone:
        0,
      structureMidrange:
        1,
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
          eligible,
        matchRatePct,
        meanMatchedDistancePct:
          levels.length > 0
            ? 0.05
            : null,
        lifecycleStatuses: {
          forming:
            levels.filter(
              (item) =>
                item.status
                  === 'forming',
            ).length,
          active:
            levels.filter(
              (item) =>
                item.status
                  === 'active',
            ).length,
          testing:
            levels.filter(
              (item) =>
                item.status
                  === 'testing',
            ).length,
          broken:
            levels.filter(
              (item) =>
                item.status
                  === 'broken',
            ).length,
          retestPending:
            levels.filter(
              (item) =>
                item.status
                  === 'retest_pending',
            ).length,
          flipped:
            levels.filter(
              (item) =>
                item.status
                  === 'flipped',
            ).length,
          expired:
            levels.filter(
              (item) =>
                item.status
                  === 'expired',
            ).length,
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

test(
  'records a compact initial history entry',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    const entry =
      store.record(
        snapshot(
          'SOLUSDT',
          '2026-07-29T18:00:00.000Z',
          60,
          [
            level(
              'resistance-one',
              'active',
              true,
            ),
          ],
        ),
      );

    assert.ok(
      entry,
    );

    assert.equal(
      entry.levelsCount,
      1,
    );

    assert.deepEqual(
      entry.changes
        .addedLevelIds,
      [
        'resistance-one',
      ],
    );
  },
);

test(
  'deduplicates repeated scans with unchanged closed-candle results',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    const first =
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
      );

    const second = {
      ...first,
      generatedAt:
        '2026-07-29T18:00:10.000Z',
      triggerSource:
        'live' as const,
      sourceCandlesCount:
        61,
    };

    assert.ok(
      store.record(
        first,
      ),
    );

    assert.equal(
      store.record(
        second,
      ),
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
  'records a new history point after another closed candle',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
      ),
    );

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:01:00.000Z',
        61,
      ),
    );

    assert.equal(
      store.getHistory(
        'SOLUSDT',
      ).length,
      2,
    );
  },
);

test(
  'captures added removed and lifecycle-changed levels',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
        [
          level(
            'one',
            'forming',
            false,
          ),
          level(
            'removed',
            'active',
            true,
          ),
        ],
        50,
      ),
    );

    const next =
      store.record(
        snapshot(
          'SOLUSDT',
          '2026-07-29T18:01:00.000Z',
          61,
          [
            level(
              'one',
              'active',
              true,
            ),
            level(
              'added',
              'forming',
              false,
            ),
          ],
          75,
        ),
      );

    assert.ok(
      next,
    );

    assert.deepEqual(
      next.changes
        .addedLevelIds,
      [
        'added',
      ],
    );

    assert.deepEqual(
      next.changes
        .removedLevelIds,
      [
        'removed',
      ],
    );

    assert.equal(
      next.changes
        .lifecycleTransitions[0]
        ?.fromStatus,
      'forming',
    );

    assert.equal(
      next.changes
        .matchRateDeltaPct,
      25,
    );
  },
);

test(
  'enforces the per-symbol history limit',
  () => {
    const store =
      new LevelV2ShadowHistoryStore({
        maxEntriesPerSymbol:
          2,
        maxTotalEntries:
          10,
      });

    for (
      let index = 0;
      index < 3;
      index += 1
    ) {
      store.record(
        snapshot(
          'SOLUSDT',
          new Date(
            Date.parse(
              '2026-07-29T18:00:00.000Z',
            )
            + index * 60_000,
          ).toISOString(),
          60 + index,
        ),
      );
    }

    assert.equal(
      store.getHistory(
        'SOLUSDT',
      ).length,
      2,
    );

    assert.equal(
      store.getStatus()
        .droppedEntriesCount,
      1,
    );
  },
);

test(
  'enforces the global history limit',
  () => {
    const store =
      new LevelV2ShadowHistoryStore({
        maxEntriesPerSymbol:
          3,
        maxTotalEntries:
          3,
      });

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
      ),
    );

    store.record(
      snapshot(
        'ETHUSDT',
        '2026-07-29T18:01:00.000Z',
        60,
      ),
    );

    store.record(
      snapshot(
        'BTCUSDT',
        '2026-07-29T18:02:00.000Z',
        60,
      ),
    );

    store.record(
      snapshot(
        'XRPUSDT',
        '2026-07-29T18:03:00.000Z',
        60,
      ),
    );

    assert.equal(
      store.getStatus()
        .entriesCount,
      3,
    );

    assert.equal(
      store.getHistory(
        'SOLUSDT',
      ).length,
      0,
    );
  },
);

test(
  'returns newest history entries first',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
      ),
    );

    store.record(
      snapshot(
        'ETHUSDT',
        '2026-07-29T18:01:00.000Z',
        60,
      ),
    );

    assert.equal(
      store.getHistory()[0]
        ?.symbol,
      'ETHUSDT',
    );
  },
);

test(
  'returns defensive history copies',
  () => {
    const store =
      new LevelV2ShadowHistoryStore();

    store.record(
      snapshot(
        'SOLUSDT',
        '2026-07-29T18:00:00.000Z',
        60,
        [
          level(
            'one',
            'active',
            true,
          ),
        ],
      ),
    );

    const first =
      store.getHistory(
        'SOLUSDT',
      );

    const item =
      first[0];

    assert.ok(
      item,
    );

    const firstLevel =
      item.levels[0];

    assert.ok(
      firstLevel,
    );

    firstLevel.score =
      1;

    assert.notEqual(
      store.getHistory(
        'SOLUSDT',
      )[0]?.levels[0]
        ?.score,
      1,
    );
  },
);

test(
  'rejects invalid history options and query limits',
  () => {
    assert.throws(
      () =>
        new LevelV2ShadowHistoryStore({
          maxEntriesPerSymbol:
            10,
          maxTotalEntries:
            5,
        }),
      /maxTotalEntries/u,
    );

    const store =
      new LevelV2ShadowHistoryStore();

    assert.throws(
      () =>
        store.getHistory(
          undefined,
          0,
        ),
      /limit/u,
    );
  },
);

function historyEntry(
  symbol: string,
  sequence: number,
): LevelV2ShadowHistoryEntry {
  const store =
    new LevelV2ShadowHistoryStore();

  const entry =
    store.record(
      snapshot(
        symbol,
        new Date(
          Date.parse(
            '2026-07-29T18:00:00.000Z',
          )
          + sequence * 60_000,
        ).toISOString(),
        60 + sequence,
      ),
    );

  assert.ok(
    entry,
  );

  return {
    ...entry,
    sequence,
    id:
      `${symbol}:history:${sequence}`,
  };
}

function reader(
  entries:
    readonly LevelV2ShadowHistoryEntry[],
  historyAvailable = true,
): LevelV2ShadowRuntimeReader {
  const base:
  LevelV2ShadowRuntimeReader = {
    getStatus: () => ({
      state:
        'running',
      snapshotsCount:
        0,
      levelsCount:
        0,
      eligibleLevelsCount:
        0,
      scansCount:
        0,
      failedScans:
        0,
      lastScanAt:
        null,
      lastTriggerSource:
        null,
      lastError:
        null,
    }),
    getSnapshots: () => [],
    getSnapshot: () =>
      null,
  };

  if (!historyAvailable) {
    return base;
  }

  return {
    ...base,
    getEvaluationHistory: (
      symbolValue,
      limit = 100,
    ) =>
      entries
        .filter(
          (entry) =>
            symbolValue === undefined
            || entry.symbol
              === symbolValue
                .trim()
                .toUpperCase(),
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.sequence
            - left.sequence,
        )
        .slice(
          0,
          limit,
        )
        .map(
          (entry) => ({
            ...entry,
          }),
        ),
    getEvaluationHistoryStatus:
      () => ({
        entriesCount:
          entries.length,
        symbolsCount:
          new Set(
            entries.map(
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
          entries.at(-1)
            ?.generatedAt
          ?? null,
        latestGeneratedAt:
          entries[0]
            ?.generatedAt
          ?? null,
      }),
  };
}

async function appWithReader(
  runtimeReader:
    LevelV2ShadowRuntimeReader,
) {
  return buildApp({
    env:
      TEST_ENV,
    marketWideRealtimeService:
      null,
    levelV2ShadowRuntimeService:
      null,
    levelV2ShadowRuntimeReader:
      runtimeReader,
  });
}

class EmptyRuntimeSource
implements SetupDetectionRuntimeSource {
  private readonly listeners =
    new Set<
      (
        event:
          SetupDetectionKlineChange,
      ) => void
    >();

  getSymbols():
  string[] {
    return [
      'SOLUSDT',
    ];
  }

  getKlines():
  ReturnType<
    SetupDetectionRuntimeSource['getKlines']
  > {
    return [];
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

    return () => {
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

test(
  'shadow runtime records and deduplicates successful evaluation history',
  () => {
    const source =
      new EmptyRuntimeSource();

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
        {
          ...DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
          historyOptions: {
            maxEntriesPerSymbol:
              5,
            maxTotalEntries:
              10,
          },
          now: () =>
            new Date(
              '2026-07-29T18:00:00.000Z',
            ),
        },
      );

    runtime.start();

    assert.equal(
      runtime
        .getEvaluationHistoryStatus()
        .entriesCount,
      1,
    );

    source.emit({
      source:
        'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      runtime
        .getEvaluationHistoryStatus()
        .entriesCount,
      1,
    );

    assert.equal(
      runtime
        .getEvaluationHistoryStatus()
        .deduplicatedEntriesCount,
      1,
    );

    runtime.stop();
  },
);

test(
  'history status route exposes bounded-store diagnostics',
  async () => {
    const app =
      await appWithReader(
        reader([
          historyEntry(
            'SOLUSDT',
            2,
          ),
          historyEntry(
            'ETHUSDT',
            1,
          ),
        ]),
      );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/history/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json()
        .entriesCount,
      2,
    );

    await app.close();
  },
);

test(
  'history list filters a symbol and applies limit newest first',
  async () => {
    const app =
      await appWithReader(
        reader([
          historyEntry(
            'SOLUSDT',
            3,
          ),
          historyEntry(
            'ETHUSDT',
            2,
          ),
          historyEntry(
            'SOLUSDT',
            1,
          ),
        ]),
      );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/history?symbol=solusdt&limit=1',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const body =
      response.json();

    assert.equal(
      body.count,
      1,
    );

    assert.equal(
      body.items[0]
        .symbol,
      'SOLUSDT',
    );

    assert.equal(
      body.items[0]
        .sequence,
      3,
    );

    await app.close();
  },
);

test(
  'history symbol route returns entries and 404 for an unknown symbol',
  async () => {
    const app =
      await appWithReader(
        reader([
          historyEntry(
            'SOLUSDT',
            1,
          ),
        ]),
      );

    const found =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/history/SOLUSDT',
      });

    assert.equal(
      found.statusCode,
      200,
    );

    assert.equal(
      found.json()
        .items.length,
      1,
    );

    const missing =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/history/ETHUSDT',
      });

    assert.equal(
      missing.statusCode,
      404,
    );

    await app.close();
  },
);

test(
  'history routes validate symbols and limits',
  async () => {
    const app =
      await appWithReader(
        reader([]),
      );

    for (
      const url
      of [
        '/api/v1/setups/levels-v2/shadow/history?symbol=bad!symbol',
        '/api/v1/setups/levels-v2/shadow/history?limit=0',
        '/api/v1/setups/levels-v2/shadow/history/BAD!SYMBOL',
        '/api/v1/setups/levels-v2/shadow/history/SOLUSDT?limit=501',
      ]
    ) {
      const response =
        await app.inject({
          method:
            'GET',
          url,
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
  'history routes return 503 when the reader has no history capability',
  async () => {
    const app =
      await appWithReader(
        reader(
          [],
          false,
        ),
      );

    for (
      const url
      of [
        '/api/v1/setups/levels-v2/shadow/history/status',
        '/api/v1/setups/levels-v2/shadow/history',
        '/api/v1/setups/levels-v2/shadow/history/SOLUSDT',
      ]
    ) {
      const response =
        await app.inject({
          method:
            'GET',
          url,
        });

      assert.equal(
        response.statusCode,
        503,
      );
    }

    await app.close();
  },
);
