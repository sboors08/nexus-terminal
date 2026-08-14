import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import {
  join,
} from 'node:path';
import test from 'node:test';
import Fastify from 'fastify';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  createCandles,
  marketSymbols,
} from '../src/modules/api-contract/fixtures.js';
import type {
  MarketDataProvider,
} from '../src/modules/market-data/market-data.provider.js';
import {
  unifiedDecisionCoverageGapObservationRoutes,
} from '../src/modules/decision-engine/unified-decision-coverage-gap-observation.routes.js';
import {
  JsonFileUnifiedDecisionCoverageGapPersistence,
  UnifiedDecisionCoverageGapObservationService,
} from '../src/modules/decision-engine/unified-decision-coverage-gap-observation.js';
import type {
  UnifiedDecisionCoverageGapPersistence,
} from '../src/modules/decision-engine/unified-decision-coverage-gap-observation.types.js';
import type {
  UnifiedDecisionLiveObservation,
  UnifiedDecisionLiveObservationListener,
  UnifiedDecisionLiveObservationRecorder,
} from '../src/modules/decision-engine/unified-decision-live-observation.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
  unifiedDecisionCoverageGapObservationEnabled: true,
};

function observation(options: {
  sequence: number;
  state?: 'observe' | 'wait_confirmation' | 'skip' | 'setup_confirmed';
  direction?: 'long' | 'short' | null;
  btcAlignment?: 'aligned' | 'opposed' | 'neutral' | 'unavailable';
  impulseAlignment?: 'aligned' | 'opposed' | 'neutral' | 'unavailable';
  terminal?: boolean;
  symbol?: string;
}): UnifiedDecisionLiveObservation {
  const symbol = options.symbol ?? 'BTCUSDT';
  const direction = options.direction ?? null;
  const terminal = options.terminal ?? false;
  const generatedAt = `2026-08-14T06:${String(options.sequence).padStart(2, '0')}:00.000Z`;
  const setup = terminal
    ? {
        id: `setup:${options.sequence}`,
        symbol,
        timeframe: '1m',
        setupType: 'level_breakout',
        direction: 'long',
        stage: 'BREAKOUT_CONFIRMED',
        outcome: 'breakout',
        level: {
          kind: 'resistance',
          centerPrice: 100,
          zoneLow: 99.9,
          zoneHigh: 100.1,
          touches: 3,
          confirmedAt: '2026-08-14T05:50:00.000Z',
        },
        currentPrice: 101,
        distanceToLevelPct: 1,
        createdAt: '2026-08-14T05:50:00.000Z',
        updatedAt: generatedAt,
        expiresAt: '2026-08-14T07:00:00.000Z',
        causal: {
          lineId: 'line:1',
        },
      }
    : null;

  return {
    id: `udlo:${options.sequence}:fixture`,
    sequence: options.sequence,
    recordedAt: generatedAt,
    symbol,
    timeframe: '1m',
    decision: {
      version: 'unified-decision-v0.1',
      symbol,
      timeframe: '1m',
      generatedAt,
      state: options.state ?? 'observe',
      direction,
      scenario: direction ? 'breakout' : null,
      causalStage: terminal ? 'OUTCOME' : direction ? 'CONFIRMATION' : 'LEVEL',
      level: {
        lineId: 'line:1',
        kind: 'resistance',
        status: 'confirmed',
        levelPrice: 100,
        currentPrice: 101,
        distanceToLevelPercent: 1,
        observationProgress: 1,
        causalStage: 'CONFIRMATION',
        realtimeStatus: 'confirmed',
        tapeState: 'supports',
        orderBookState: 'supports',
      },
      setup: setup
        ? {
            candidateId: setup.id,
            setupType: setup.setupType,
            direction: setup.direction,
            stage: setup.stage,
            outcome: setup.outcome,
            updatedAt: setup.updatedAt,
            expiresAt: setup.expiresAt,
          }
        : null,
      marketContext: {
        btc: {
          availability: 'ready',
          mode: 'risk_on',
          observedAt: generatedAt,
          alignment: options.btcAlignment ?? 'neutral',
        },
        impulse: {
          availability: 'ready',
          direction: 'long',
          observedAt: generatedAt,
          alignment: options.impulseAlignment ?? 'neutral',
        },
      },
      reasons: terminal
        ? ['setup_breakout_confirmed']
        : options.btcAlignment === 'opposed'
          && options.impulseAlignment === 'opposed'
          ? ['market_context_double_conflict']
          : options.btcAlignment === 'opposed'
            || options.impulseAlignment === 'opposed'
            ? ['market_context_conflict']
            : [],
      missingConfirmations: [],
      invalidations:
        options.btcAlignment === 'opposed'
        || options.impulseAlignment === 'opposed'
          ? ['market_context_reversal']
          : [],
      decisionSupportOnly: true,
      createsTradeOrder: false,
      createsSetup: false,
      createsSignal: false,
      createsScore: false,
      estimatesProfitability: false,
      changesExistingLifecycle: false,
      usesFutureData: false,
    },
    realtime: {
      capturedAt: generatedAt,
      tape: null,
      orderBook: null,
      sourceErrors: [],
      evaluatedEvidence: {},
      evaluations: [],
    },
    setups: {
      readState: 'available',
      observedAt: generatedAt,
      candidates: setup ? [setup] : [],
      originalCandidatesCount: setup ? 1 : 0,
      truncated: false,
    },
    marketContext: {
      readState: 'available',
      value: {},
    },
    diagnosticOnly: true,
    createsTradeOrder: false,
    createsSetup: false,
    createsSignal: false,
    changesDecisionRules: false,
  } as unknown as UnifiedDecisionLiveObservation;
}

class ObservableSource
implements UnifiedDecisionLiveObservationRecorder {
  private readonly listeners = new Set<UnifiedDecisionLiveObservationListener>();
  async start() {}
  async stop() {}
  record(): UnifiedDecisionLiveObservation { throw new Error('not used'); }
  async flush() {}
  getStatus(): never { throw new Error('not used'); }
  getObservations(): readonly UnifiedDecisionLiveObservation[] { return []; }
  exportDataset(): never { throw new Error('not used'); }
  subscribe(listener: UnifiedDecisionLiveObservationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(value: UnifiedDecisionLiveObservation): void {
    for (const listener of this.listeners) listener(value);
  }
  listenerCount(): number { return this.listeners.size; }
}

test('retains only the three real coverage-gap kinds', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService();
  await service.start();
  assert.deepEqual(service.observe(observation({ sequence: 1 })), []);
  const single = service.observe(observation({
    sequence: 2,
    state: 'wait_confirmation',
    direction: 'long',
    btcAlignment: 'opposed',
    impulseAlignment: 'aligned',
  }));
  const double = service.observe(observation({
    sequence: 3,
    state: 'skip',
    direction: 'short',
    btcAlignment: 'opposed',
    impulseAlignment: 'opposed',
  }));
  const terminal = service.observe(observation({
    sequence: 4,
    state: 'setup_confirmed',
    direction: 'long',
    terminal: true,
  }));
  assert.equal(single[0]?.kind, 'market_context_single_conflict');
  assert.equal(single[0]?.transition?.fromState, 'observe');
  assert.equal(double[0]?.kind, 'market_context_double_conflict');
  assert.equal(terminal[0]?.kind, 'terminal_setup_outcome');
  assert.deepEqual(terminal[0]?.terminalCandidateIds, ['setup:4']);
  assert.equal(service.getStatus().caseCount, 3);
  assert.equal(service.getStatus().transitionCount, 3);
  assert.equal(service.getStatus().violationCount, 0);
  assert.deepEqual(
    service.getStatus().coverage.map((entry) => entry.state),
    ['observed', 'observed', 'observed'],
  );
});

test('records multiple independent gaps from one source observation', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService();
  await service.start();
  const cases = service.observe(observation({
    sequence: 1,
    state: 'setup_confirmed',
    direction: 'long',
    terminal: true,
    btcAlignment: 'opposed',
    impulseAlignment: 'aligned',
  }));
  assert.deepEqual(cases.map((item) => item.kind), [
    'market_context_single_conflict',
    'terminal_setup_outcome',
  ]);
  assert.equal(service.getStatus().sourceObservationCount, 1);
});

test('keeps rare cases independently in a bounded store', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService({ capacity: 2 });
  await service.start();
  for (let sequence = 1; sequence <= 3; sequence += 1) {
    service.observe(observation({
      sequence,
      state: 'wait_confirmation',
      direction: 'long',
      btcAlignment: 'opposed',
    }));
  }
  assert.deepEqual(
    service.getCases().map((item) => item.sourceObservationSequence),
    [3, 2],
  );
  assert.equal(service.getStatus().capacityPerKind, 2);
  assert.equal(service.getStatus().maxCaseCount, 6);
});

test('a frequent conflict cannot evict the only terminal outcome', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService({ capacity: 2 });
  await service.start();
  service.observe(observation({
    sequence: 1,
    state: 'setup_confirmed',
    direction: 'long',
    terminal: true,
  }));
  for (let sequence = 2; sequence <= 6; sequence += 1) {
    service.observe(observation({
      sequence,
      state: 'wait_confirmation',
      direction: 'long',
      btcAlignment: 'opposed',
    }));
  }
  assert.equal(
    service.getCases({ kind: 'terminal_setup_outcome' }).length,
    1,
  );
  assert.equal(
    service.getCases({ kind: 'market_context_single_conflict' }).length,
    2,
  );
});

test('subscribes to the existing live stream and detaches cleanly', async () => {
  const source = new ObservableSource();
  const service = new UnifiedDecisionCoverageGapObservationService({ source });
  await service.start();
  assert.equal(source.listenerCount(), 1);
  source.emit(observation({
    sequence: 1,
    state: 'skip',
    direction: 'short',
    btcAlignment: 'opposed',
    impulseAlignment: 'opposed',
  }));
  assert.equal(service.getStatus().caseCount, 1);
  await service.stop();
  assert.equal(source.listenerCount(), 0);
});

test('persists cases atomically and restores sequence continuity', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-gap-'));
  const filePath = join(directory, 'gaps.json');
  try {
    const persistence = new JsonFileUnifiedDecisionCoverageGapPersistence({ filePath });
    const first = new UnifiedDecisionCoverageGapObservationService({ persistence });
    await first.start();
    first.observe(observation({
      sequence: 1,
      state: 'wait_confirmation',
      direction: 'long',
      btcAlignment: 'opposed',
    }));
    await first.stop();
    const stored = JSON.parse(await readFile(filePath, 'utf8')) as { schema: string };
    assert.equal(stored.schema, 'nexus.unified-decision.coverage-gap-observations');

    const second = new UnifiedDecisionCoverageGapObservationService({ persistence });
    await second.start();
    assert.equal(second.getStatus().caseCount, 1);
    const added = second.observe(observation({
      sequence: 2,
      state: 'skip',
      direction: 'long',
      btcAlignment: 'opposed',
      impulseAlignment: 'opposed',
    }));
    assert.equal(added[0]?.sequence, 2);
    await second.stop();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('degrades safely for corrupt persistence and still observes in memory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nexus-gap-corrupt-'));
  const filePath = join(directory, 'gaps.json');
  try {
    await writeFile(filePath, '{broken', 'utf8');
    const service = new UnifiedDecisionCoverageGapObservationService({
      persistence: new JsonFileUnifiedDecisionCoverageGapPersistence({ filePath }),
    });
    await service.start();
    assert.equal(service.getStatus().state, 'degraded');
    assert.equal(
      service.getStatus().lastPersistenceErrorCode,
      'coverage_gap_persistence_corrupt',
    );
    service.observe(observation({
      sequence: 1,
      state: 'wait_confirmation',
      direction: 'long',
      btcAlignment: 'opposed',
    }));
    assert.equal(service.getStatus().caseCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('degrades on asynchronous writes without affecting observation', async () => {
  const persistence: UnifiedDecisionCoverageGapPersistence = {
    adapter: 'failing',
    async load() { return null; },
    async save() { throw new Error('disk unavailable'); },
  };
  const service = new UnifiedDecisionCoverageGapObservationService({ persistence });
  await service.start();
  service.observe(observation({
    sequence: 1,
    state: 'wait_confirmation',
    direction: 'long',
    btcAlignment: 'opposed',
  }));
  await service.flush();
  assert.equal(service.getStatus().state, 'degraded');
  assert.equal(
    service.getStatus().lastPersistenceErrorCode,
    'coverage_gap_persistence_failed',
  );
  assert.equal(service.getStatus().caseCount, 1);
});

test('filters cases and exports versioned observed/not_observed coverage', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService();
  await service.start();
  service.observe(observation({
    sequence: 1,
    state: 'wait_confirmation',
    direction: 'long',
    btcAlignment: 'opposed',
  }));
  service.observe(observation({
    sequence: 2,
    state: 'skip',
    direction: 'short',
    btcAlignment: 'opposed',
    impulseAlignment: 'opposed',
    symbol: 'ETHUSDT',
  }));
  assert.equal(service.getCases({ symbol: 'ETHUSDT' }).length, 1);
  const report = service.exportReport({
    kind: 'market_context_single_conflict',
  });
  assert.equal(report.version, 'unified-decision-coverage-gap-observation-v0.1');
  assert.equal(report.cases.length, 1);
  assert.equal(
    report.status.coverage.find((entry) => entry.kind === 'terminal_setup_outcome')?.state,
    'not_observed',
  );
});

test('reports contract violations without changing the source decision', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService();
  await service.start();
  const source = observation({
    sequence: 1,
    state: 'observe',
    direction: 'long',
    btcAlignment: 'opposed',
  });
  const mutable = structuredClone(source) as unknown as {
    decision: { reasons: string[]; invalidations: string[] };
  };
  mutable.decision.reasons = [];
  mutable.decision.invalidations = [];
  const cases = service.observe(mutable as unknown as UnifiedDecisionLiveObservation);
  assert.deepEqual(cases[0]?.violations.map((item) => item.code), [
    'single_conflict_not_downgraded',
    'single_conflict_missing_contract',
  ]);
  assert.equal(service.getStatus().violationCount, 2);
  assert.equal(source.decision.state, 'observe');
});

test('exposes status, filtered cases and export HTTP contracts', async () => {
  const service = new UnifiedDecisionCoverageGapObservationService();
  await service.start();
  service.observe(observation({
    sequence: 1,
    state: 'wait_confirmation',
    direction: 'long',
    btcAlignment: 'opposed',
  }));
  const app = Fastify();
  await app.register(unifiedDecisionCoverageGapObservationRoutes, {
    prefix: '/api/v1',
    observer: service,
  });
  const status = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps/status',
  });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().caseCount, 1);
  const list = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps?kind=market_context_single_conflict&limit=1',
  });
  assert.equal(list.statusCode, 200);
  assert.equal(list.json().cases.length, 1);
  const exported = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps/export',
  });
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.json().version, 'unified-decision-coverage-gap-observation-v0.1');
  const invalid = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps?kind=unknown',
  });
  assert.equal(invalid.statusCode, 400);
  await app.close();
});

test('reports unavailable observer through the HTTP contract', async () => {
  const app = Fastify();
  await app.register(unifiedDecisionCoverageGapObservationRoutes, {
    prefix: '/api/v1',
  });
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps/status',
  });
  assert.equal(response.statusCode, 503);
  assert.equal(
    response.json().error,
    'unified_decision_coverage_gap_observer_unavailable',
  );
  await app.close();
});

test('buildApp wires the gap observer to the existing recorder lifecycle', async (t) => {
  const source = new ObservableSource();
  const provider: MarketDataProvider = {
    getMarketSymbols: async () => marketSymbols,
    getCandles: async (symbol, timeframe) => createCandles(symbol, timeframe),
  };
  const app = await buildApp({
    env: testEnv,
    marketDataProvider: provider,
    unifiedDecisionLiveObservationRecorder: source,
    unifiedDecisionCoverageGapPersistence: null,
  });
  t.after(async () => app.close());
  await app.ready();
  assert.equal(source.listenerCount(), 1);
  source.emit(observation({
    sequence: 1,
    state: 'skip',
    direction: 'short',
    btcAlignment: 'opposed',
    impulseAlignment: 'opposed',
  }));
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/decision-engine/coverage-gaps/status',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().caseCount, 1);
  assert.equal(response.json().persistenceMode, 'runtime_only');
});
