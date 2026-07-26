import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import type {
  SetupDetectionRuntimeLifecycle,
  SetupDetectionRuntimeReader,
  SetupDetectionRuntimeStatus,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';
import {
  setupReadRoutes,
} from '../src/modules/setup-engine/setup-read.routes.js';
import type {
  SetupDirection,
  SetupEngineLevelKind,
  SetupEngineSetupType,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';

const testEnv:
AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

function createCandidate(
  input: {
    id: string;
    symbol: string;
    setupType:
      SetupEngineSetupType;
    direction:
      SetupDirection;
    levelKind:
      SetupEngineLevelKind;
    updatedAt: string;
  },
): SetupEngineState {
  return {
    id:
      input.id,
    symbol:
      input.symbol,
    timeframe: '1m',
    setupType:
      input.setupType,
    direction:
      input.direction,
    stage:
      'LEVEL_CONFIRMED',
    outcome: null,
    level: {
      kind:
        input.levelKind,
      centerPrice: 100,
      zoneLow: 99.8,
      zoneHigh: 100.2,
      touches: 2,
      confirmedAt:
        '2026-07-26T12:05:00.000Z',
    },
    currentPrice: 99,
    distanceToLevelPct: 1,
    createdAt:
      '2026-07-26T12:05:00.000Z',
    updatedAt:
      input.updatedAt,
    expiresAt:
      '2026-07-26T13:05:00.000Z',
  };
}

function buildCandidates():
SetupEngineState[] {
  return [
    createCandidate({
      id:
        'setup-sol-resistance-level_breakout',
      symbol:
        'SOLUSDT',
      setupType:
        'level_breakout',
      direction:
        'long',
      levelKind:
        'resistance',
      updatedAt:
        '2026-07-26T12:09:00.000Z',
    }),
    createCandidate({
      id:
        'setup-sol-resistance-level_bounce',
      symbol:
        'SOLUSDT',
      setupType:
        'level_bounce',
      direction:
        'short',
      levelKind:
        'resistance',
      updatedAt:
        '2026-07-26T12:08:00.000Z',
    }),
    createCandidate({
      id:
        'setup-eth-support-level_breakout',
      symbol:
        'ETHUSDT',
      setupType:
        'level_breakout',
      direction:
        'short',
      levelKind:
        'support',
      updatedAt:
        '2026-07-26T12:07:00.000Z',
    }),
    createCandidate({
      id:
        'setup-eth-support-level_bounce',
      symbol:
        'ETHUSDT',
      setupType:
        'level_bounce',
      direction:
        'long',
      levelKind:
        'support',
      updatedAt:
        '2026-07-26T12:06:00.000Z',
    }),
  ];
}

function cloneCandidate(
  candidate:
    SetupEngineState,
): SetupEngineState {
  return {
    ...candidate,
    level: {
      ...candidate.level,
    },
  };
}

class TestSetupRuntimeReader
implements SetupDetectionRuntimeReader {
  private readonly candidates =
    buildCandidates();

  getStatus():
  SetupDetectionRuntimeStatus {
    return {
      state: 'running',
      candidatesCount:
        this.candidates.length,
      scansCount: 25,
      failedScans: 1,
      evaluationsCount: 40,
      failedEvaluations: 2,
      stageTransitionsCount: 9,
      lastScanAt:
        '2026-07-26T12:10:00.000Z',
      lastEvaluationAt:
        '2026-07-26T12:10:00.000Z',
      lastTransitionAt:
        '2026-07-26T12:09:59.999Z',
      lastTriggerSource:
        'history',
      lastError:
        'BADUSDT: test failure',
    };
  }

  getCandidates(
    symbol?: string,
  ): SetupEngineState[] {
    return this.candidates
      .filter(
        (candidate) =>
          symbol === undefined
          || candidate.symbol
            === symbol,
      )
      .map(
        cloneCandidate,
      );
  }

  getCandidate(
    candidateId: string,
  ): SetupEngineState | null {
    const candidate =
      this.candidates.find(
        (item) =>
          item.id
          === candidateId,
      );

    return candidate
      ? cloneCandidate(
          candidate,
        )
      : null;
  }
}

class TestFullSetupRuntime
extends TestSetupRuntimeReader
implements SetupDetectionRuntimeLifecycle {
  starts = 0;
  stops = 0;

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.stops += 1;
  }
}

async function createRouteApp(
  reader?:
    SetupDetectionRuntimeReader,
) {
  const app =
    Fastify({
      logger: false,
    });

  await app.register(
    setupReadRoutes,
    {
      prefix:
        '/api/v1',
      ...(
        reader
          ? {
              setupDetectionRuntimeReader:
                reader,
            }
          : {}
      ),
    },
  );

  return app;
}

test(
  'setup runtime status route returns runtime state',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/runtime/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.state,
      'running',
    );

    assert.equal(
      payload.candidatesCount,
      4,
    );

    assert.equal(
      payload.scansCount,
      25,
    );

    assert.equal(
      payload.evaluationsCount,
      40,
    );

    assert.equal(
      payload.stageTransitionsCount,
      9,
    );

    await app.close();
  },
);

test(
  'setup candidates route returns candidates',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      4,
    );

    assert.equal(
      payload[0].id,
      'setup-sol-resistance-level_breakout',
    );

    await app.close();
  },
);

test(
  'setup candidates route applies all supported filters',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates'
          + '?symbol=solusdt'
          + '&setupType=level_breakout'
          + '&direction=long'
          + '&levelKind=resistance'
          + '&limit=1',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      1,
    );

    assert.equal(
      payload[0].symbol,
      'SOLUSDT',
    );

    assert.equal(
      payload[0].setupType,
      'level_breakout',
    );

    assert.equal(
      payload[0].direction,
      'long',
    );

    assert.equal(
      payload[0].level.kind,
      'resistance',
    );

    await app.close();
  },
);

test(
  'setup candidates route applies limit after filters',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates'
          + '?setupType=level_breakout'
          + '&limit=1',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json().length,
      1,
    );

    await app.close();
  },
);

test(
  'setup candidate detail route returns one candidate',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates/'
          + 'setup-sol-resistance-level_breakout',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json().direction,
      'long',
    );

    await app.close();
  },
);

test(
  'setup candidate detail route returns 404 for an unknown candidate',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates/'
          + 'setup-unknown',
      });

    assert.equal(
      response.statusCode,
      404,
    );

    assert.equal(
      response.json().error,
      'setup_candidate_not_found',
    );

    await app.close();
  },
);

test(
  'setup candidates route validates query filters',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const cases = [
      {
        query:
          'symbol=bad!',
        error:
          'invalid_setup_symbol',
      },
      {
        query:
          'setupType=wrong',
        error:
          'invalid_setup_type',
      },
      {
        query:
          'direction=up',
        error:
          'invalid_setup_direction',
      },
      {
        query:
          'levelKind=middle',
        error:
          'invalid_setup_level_kind',
      },
      {
        query:
          'limit=0',
        error:
          'invalid_setup_limit',
      },
      {
        query:
          'limit=101',
        error:
          'invalid_setup_limit',
      },
      {
        query:
          'limit=1.5',
        error:
          'invalid_setup_limit',
      },
    ];

    for (const item of cases) {
      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/v1/setups/candidates'
            + `?${item.query}`,
        });

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        response.json().error,
        item.error,
      );
    }

    await app.close();
  },
);

test(
  'setup candidate detail route validates candidate id',
  async () => {
    const app =
      await createRouteApp(
        new TestSetupRuntimeReader(),
      );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/candidates/'
          + 'bad%20candidate',
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json().error,
      'invalid_setup_candidate_id',
    );

    await app.close();
  },
);

test(
  'setup read routes return 503 when runtime is unavailable',
  async () => {
    const app =
      await createRouteApp();

    const urls = [
      '/api/v1/setups/runtime/status',
      '/api/v1/setups/candidates',
      '/api/v1/setups/candidates/setup-test',
    ];

    for (const url of urls) {
      const response =
        await app.inject({
          method: 'GET',
          url,
        });

      assert.equal(
        response.statusCode,
        503,
      );

      assert.equal(
        response.json().error,
        'setup_runtime_unavailable',
      );
    }

    await app.close();
  },
);

test(
  'buildApp starts runtime and exposes setup read routes',
  async () => {
    const runtime =
      new TestFullSetupRuntime();

    const app =
      await buildApp({
        env:
          testEnv,
        realtimeMarketDataService:
          null,
        binanceSymbolUniverseService:
          null,
        marketWideRealtimeService:
          null,
        marketWideHistoryWarmupService:
          null,
        setupDetectionRuntimeService:
          runtime,
        setupDetectionRuntimeReader:
          runtime,
      });

    await app.ready();

    assert.equal(
      runtime.starts,
      1,
    );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/setups/runtime/status',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json().state,
      'running',
    );

    await app.close();

    assert.equal(
      runtime.stops,
      1,
    );
  },
);
