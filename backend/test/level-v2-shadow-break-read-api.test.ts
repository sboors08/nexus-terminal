import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import type {
  LevelV2BreakClassificationEvent,
  LevelV2BreakClassificationState,
  LevelV2BreakClassificationStatus,
  LevelV2Kind,
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
  id: string,
  kind: LevelV2Kind,
  score: number,
) {
  return {
    currentKind:
      kind,
    status:
      'active',
    eligibleForSetups:
      true,
    level: {
      id,
      score: {
        total:
          score,
      },
    },
  };
}

function classification(
  levelId: string,
  kind: LevelV2Kind,
  status:
    LevelV2BreakClassificationStatus,
  maxPenetrationDepthPct: number,
): LevelV2BreakClassificationState {
  return {
    id:
      `${levelId}:break-classification:${kind}`,
    currentKind:
      kind,
    status,
    maxPenetrationDepthPct,
    level: {
      id:
        levelId,
    },
  } as unknown as
    LevelV2BreakClassificationState;
}

function classificationEvent(
  state:
    LevelV2BreakClassificationState,
  sequence: number,
): LevelV2BreakClassificationEvent {
  return {
    id:
      `${state.id}:event:${sequence}`,
    classifierId:
      state.id,
    levelId:
      state.level.id,
    sequence,
  } as unknown as
    LevelV2BreakClassificationEvent;
}

const confirmed =
  classification(
    'sol-resistance',
    'resistance',
    'breakout_confirmed',
    0.42,
  );

const falseBreakout =
  classification(
    'sol-support',
    'support',
    'false_breakout',
    0.81,
  );

const pierce =
  classification(
    'eth-resistance',
    'resistance',
    'pierce',
    0.19,
  );

const SNAPSHOTS = [
  {
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    generatedAt:
      '2026-08-02T18:00:00.000Z',
    levels: [
      level(
        'sol-resistance',
        'resistance',
        84,
      ),
      level(
        'sol-support',
        'support',
        79,
      ),
    ],
    lifecycleEvents: [],
    breakClassifications: [
      confirmed,
      falseBreakout,
    ],
    breakClassificationEvents: [
      classificationEvent(
        confirmed,
        1,
      ),
      classificationEvent(
        confirmed,
        2,
      ),
      classificationEvent(
        falseBreakout,
        1,
      ),
    ],
  },
  {
    symbol:
      'ETHUSDT',
    timeframe:
      '1m',
    generatedAt:
      '2026-08-02T18:01:00.000Z',
    levels: [
      level(
        'eth-resistance',
        'resistance',
        71,
      ),
    ],
    lifecycleEvents: [],
    breakClassifications: [
      pierce,
    ],
    breakClassificationEvents: [
      classificationEvent(
        pierce,
        1,
      ),
    ],
  },
] as unknown as
  LevelV2ShadowSnapshot[];

function cloneSnapshots():
LevelV2ShadowSnapshot[] {
  return structuredClone(
    SNAPSHOTS,
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
        3,
      scansCount:
        9,
      failedScans:
        0,
      lastScanAt:
        '2026-08-02T18:01:00.000Z',
      lastTriggerSource:
        'live',
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
      reader,
  });
}

test(
  'lists break classifications with their isolated events',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications?symbol=solusdt&status=false_breakout',
      });

    const body =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      body.count,
      1,
    );

    assert.equal(
      body.matchedCount,
      1,
    );

    assert.equal(
      body.totalClassifications,
      3,
    );

    assert.equal(
      body.items[0]
        .state.level.id,
      'sol-support',
    );

    assert.equal(
      body.items[0]
        .events.length,
      1,
    );

    assert.equal(
      body.items[0]
        .events[0]
        .classifierId,
      falseBreakout.id,
    );

    await app.close();
  },
);

test(
  'filters break classifications by kind and level id before limit',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications?kind=resistance&levelId=sol-resistance&limit=1',
      });

    const body =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      body.count,
      1,
    );

    assert.equal(
      body.items[0]
        .state.status,
      'breakout_confirmed',
    );

    assert.equal(
      body.items[0]
        .events.length,
      2,
    );

    await app.close();
  },
);

test(
  'aggregates break-classification diagnostics',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications/diagnostics',
      });

    const body =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      body.symbolsCount,
      2,
    );

    assert.equal(
      body.classificationsCount,
      3,
    );

    assert.equal(
      body.eventsCount,
      4,
    );

    assert.equal(
      body.statusCounts
        .false_breakout,
      1,
    );

    assert.equal(
      body.kindCounts
        .resistance,
      2,
    );

    assert.equal(
      body.maxPenetrationDepthPct,
      0.81,
    );

    assert.equal(
      body.latestGeneratedAt,
      '2026-08-02T18:01:00.000Z',
    );

    await app.close();
  },
);

test(
  'validates break-classification filters',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/api/v1/setups/levels-v2/shadow/break-classifications?status=broken',
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json()
        .error,
      'invalid_level_v2_shadow_break_status',
    );

    await app.close();
  },
);

test(
  'returns 503 when the shadow runtime reader is unavailable',
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
          '/api/v1/setups/levels-v2/shadow/break-classifications',
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

    await app.close();
  },
);
