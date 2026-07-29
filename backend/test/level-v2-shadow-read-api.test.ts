import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  LevelV2ShadowRuntimeService,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.js';
import type {
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  SetupDetectionKlineChange,
  SetupDetectionRuntimeSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';

const testEnv:
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
  kind:
    'support'
    | 'resistance',
  status:
    'forming'
    | 'active'
    | 'testing'
    | 'broken'
    | 'retest_pending'
    | 'flipped'
    | 'expired',
  eligibleForSetups: boolean,
  score: number,
) {
  return {
    currentKind:
      kind,
    status,
    eligibleForSetups,
    level: {
      id,
      score: {
        total:
          score,
      },
    },
  };
}

const snapshots = [
  {
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    generatedAt:
      '2026-07-29T12:00:00.000Z',
    triggerSource:
      'live',
    sourceCandlesCount:
      100,
    closedCandlesCount:
      99,
    detectedZonesCount:
      2,
    rejectedZonesCount:
      3,
    rejectionCounts: {
      insufficientTouches:
        1,
      acceptanceZone:
        1,
      structureMidrange:
        1,
      scoreBelowThreshold:
        0,
    },
    levels: [
      level(
        'sol-resistance',
        'resistance',
        'active',
        true,
        82,
      ),
      level(
        'sol-support',
        'support',
        'expired',
        false,
        51,
      ),
    ],
    lifecycleEvents: [
      {
        levelId:
          'sol-resistance',
      },
      {
        levelId:
          'sol-support',
      },
    ],
  },
  {
    symbol:
      'ETHUSDT',
    timeframe:
      '1m',
    generatedAt:
      '2026-07-29T12:01:00.000Z',
    triggerSource:
      'history',
    sourceCandlesCount:
      120,
    closedCandlesCount:
      120,
    detectedZonesCount:
      1,
    rejectedZonesCount:
      1,
    rejectionCounts: {
      insufficientTouches:
        0,
      acceptanceZone:
        0,
      structureMidrange:
        0,
      scoreBelowThreshold:
        1,
    },
    levels: [
      level(
        'eth-support',
        'support',
        'forming',
        false,
        43,
      ),
    ],
    lifecycleEvents: [
      {
        levelId:
          'eth-support',
      },
    ],
  },
] as unknown as
  LevelV2ShadowSnapshot[];

function cloneSnapshots():
LevelV2ShadowSnapshot[] {
  return structuredClone(
    snapshots,
  );
}

function createReader():
LevelV2ShadowRuntimeReader {
  return {
    getStatus: () => ({
      state:
        'running',
      snapshotsCount:
        2,
      levelsCount:
        3,
      eligibleLevelsCount:
        1,
      scansCount:
        7,
      failedScans:
        1,
      lastScanAt:
        '2026-07-29T12:01:00.000Z',
      lastTriggerSource:
        'history',
      lastError:
        null,
    }),
    getSnapshots:
      cloneSnapshots,
    getSnapshot: (
      symbol,
    ) =>
      cloneSnapshots()
        .find(
          (snapshot) =>
            snapshot.symbol
              === symbol,
        )
      ?? null,
  };
}

async function createApp(
  reader:
    LevelV2ShadowRuntimeReader
    | null = createReader(),
) {
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
        reader,
    });

  return app;
}

test(
  'shadow status route returns runtime diagnostics',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/runtime/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json()
        .scansCount,
      7,
    );

    await app.close();
  },
);

test(
  'shadow diagnostics aggregate statuses kinds and rejection reasons',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/diagnostics',
      });

    const body =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      body.trackedLevelsCount,
      3,
    );

    assert.equal(
      body.eligibleLevelsCount,
      1,
    );

    assert.equal(
      body.lifecycleStatusCounts
        .active,
      1,
    );

    assert.equal(
      body.kindCounts.support,
      2,
    );

    assert.equal(
      body.rejectionCounts
        .scoreBelowThreshold,
      1,
    );

    assert.equal(
      body.latestGeneratedAt,
      '2026-07-29T12:01:00.000Z',
    );

    await app.close();
  },
);

test(
  'shadow snapshot list returns newest snapshots first',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots',
      });

    const body =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      body.count,
      2,
    );

    assert.equal(
      body.items[0]
        .symbol,
      'ETHUSDT',
    );

    await app.close();
  },
);

test(
  'shadow snapshot list filters symbol case-insensitively',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots?symbol=solusdt',
      });

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

    await app.close();
  },
);

test(
  'shadow snapshot list filters level state kind eligibility and score',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots?kind=resistance&status=active&eligibleForSetups=true&minScore=80',
      });

    const body =
      response.json();

    assert.equal(
      body.count,
      1,
    );

    assert.equal(
      body.items[0]
        .levels.length,
      1,
    );

    assert.equal(
      body.items[0]
        .levels[0]
        .level.id,
      'sol-resistance',
    );

    assert.equal(
      body.items[0]
        .lifecycleEvents.length,
      1,
    );

    await app.close();
  },
);

test(
  'shadow snapshot list applies limit after filters',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots?limit=1',
      });

    const body =
      response.json();

    assert.equal(
      body.count,
      1,
    );

    assert.equal(
      body.totalSnapshots,
      2,
    );

    await app.close();
  },
);

test(
  'shadow snapshot detail returns one symbol snapshot',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots/solusdt',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json()
        .symbol,
      'SOLUSDT',
    );

    await app.close();
  },
);

test(
  'shadow snapshot detail returns 404 for an unknown symbol',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots/BTCUSDT',
      });

    assert.equal(
      response.statusCode,
      404,
    );

    assert.equal(
      response.json()
        .error,
      'level_v2_shadow_snapshot_not_found',
    );

    await app.close();
  },
);

test(
  'shadow read routes validate every query filter',
  async () => {
    const app =
      await createApp();

    const cases = [
      [
        'symbol=bad!',
        'invalid_level_v2_shadow_symbol',
      ],
      [
        'kind=middle',
        'invalid_level_v2_shadow_kind',
      ],
      [
        'status=unknown',
        'invalid_level_v2_shadow_status',
      ],
      [
        'eligibleForSetups=yes',
        'invalid_level_v2_shadow_eligibility',
      ],
      [
        'minScore=101',
        'invalid_level_v2_shadow_min_score',
      ],
      [
        'limit=0',
        'invalid_level_v2_shadow_limit',
      ],
    ];

    for (
      const [
        query,
        error,
      ]
      of cases
    ) {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            `/api/v1/setups/levels-v2/shadow/snapshots?${query}`,
        });

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        response.json()
          .error,
        error,
      );
    }

    await app.close();
  },
);

test(
  'shadow snapshot detail rejects a malformed symbol',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/snapshots/bad!',
      });

    assert.equal(
      response.statusCode,
      400,
    );

    await app.close();
  },
);

test(
  'shadow read routes return 503 when the reader is unavailable',
  async () => {
    const app =
      await createApp(
        null,
      );

    const paths = [
      '/api/v1/setups/levels-v2/shadow/runtime/status',
      '/api/v1/setups/levels-v2/shadow/diagnostics',
      '/api/v1/setups/levels-v2/shadow/snapshots',
      '/api/v1/setups/levels-v2/shadow/snapshots/SOLUSDT',
    ];

    for (
      const path
      of paths
    ) {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            path,
        });

      assert.equal(
        response.statusCode,
        503,
      );

      assert.equal(
        response.json()
          .error,
        'level_v2_shadow_runtime_unavailable',
      );
    }

    await app.close();
  },
);

test(
  'buildApp derives the reader from a real shadow runtime service',
  async () => {
    const listeners =
      new Set<
        (
          event:
            SetupDetectionKlineChange,
        ) => void
      >();

    const source:
    SetupDetectionRuntimeSource = {
      getSymbols: () => [],
      getKlines: () => [],
      getState: () => null,
      subscribeKlineChanges: (
        listener,
      ) => {
        listeners.add(
          listener,
        );

        return () => {
          listeners.delete(
            listener,
          );
        };
      },
    };

    const runtime =
      new LevelV2ShadowRuntimeService(
        source,
      );

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
          runtime,
      });

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/runtime/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json()
        .state,
      'running',
    );

    await app.close();

    assert.equal(
      listeners.size,
      0,
    );
  },
);
