import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  JsonFileAlertsPersistence,
  type AlertsPersistenceContract,
  type AlertsPersistenceSnapshotV1,
} from '../src/modules/alerts/alerts-persistence.js';
import {
  AlertsRuntimeService,
} from '../src/modules/alerts/alerts-runtime.service.js';
import {
  AlertsDomainError,
  type AlertEventListener,
  type AlertEventSourceContract,
  type AlertTriggerEvent,
} from '../src/modules/alerts/alerts.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

function createIds() {
  let value = 0;

  return (kind: 'rule' | 'trigger') =>
    `${kind}-${++value}`;
}

function sourceEvent(
  sourceEventId: string,
): AlertTriggerEvent {
  return {
    sourceEventId,
    source: 'setup_lifecycle',
    eventType: 'setup_confirmation',
    occurredAt: '2026-08-12T12:00:00.000Z',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    entityId: 'setup-sol',
    payload: {
      stage: 'confirmation',
    },
  };
}

class MemoryAlertsPersistence
implements AlertsPersistenceContract {
  readonly adapter = 'memory';

  snapshot:
    AlertsPersistenceSnapshotV1 | unknown | null = null;

  loadError: Error | null = null;
  saveFailuresRemaining = 0;
  loadCalls = 0;
  saveCalls = 0;

  async load(): Promise<unknown | null> {
    this.loadCalls += 1;

    if (this.loadError) {
      throw this.loadError;
    }

    return this.snapshot === null
      ? null
      : structuredClone(this.snapshot);
  }

  async save(
    snapshot: AlertsPersistenceSnapshotV1,
  ): Promise<void> {
    this.saveCalls += 1;

    if (this.saveFailuresRemaining > 0) {
      this.saveFailuresRemaining -= 1;
      throw new Error('temporary persistence failure');
    }

    this.snapshot = structuredClone(snapshot);
  }
}

class TestAlertSource
implements AlertEventSourceContract {
  private readonly listeners =
    new Set<AlertEventListener>();

  get listenersCount(): number {
    return this.listeners.size;
  }

  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function withTempDirectory(
  run: (directory: string) => Promise<void>,
): Promise<void> {
  const directory = await mkdtemp(
    join(tmpdir(), 'nexus-alerts-persistence-'),
  );

  try {
    await run(directory);
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
    });
  }
}

test('writes and loads an atomic versioned JSON snapshot', async () => {
  await withTempDirectory(async (directory) => {
    const filePath = join(directory, 'alerts.json');
    const persistence = new JsonFileAlertsPersistence({
      filePath,
    });
    const runtime = new AlertsRuntimeService([], {
      createId: createIds(),
      defaultCooldownMs: 0,
    }, persistence);

    await runtime.start();
    runtime.createRule({
      name: 'SOL confirmation',
      eventType: 'setup_confirmation',
      symbol: 'SOLUSDT',
      timeframe: '5m',
    });
    runtime.ingestEvent(sourceEvent('event-1'));
    await runtime.stop();

    const persisted = JSON.parse(
      await readFile(filePath, 'utf8'),
    ) as Record<string, unknown>;

    assert.equal(persisted.schema, 'nexus.alerts.runtime');
    assert.equal(persisted.version, 1);
    assert.equal((persisted.rules as unknown[]).length, 1);
    assert.equal((persisted.triggers as unknown[]).length, 1);
    assert.deepEqual(
      await readdir(directory),
      ['alerts.json'],
    );

    const loaded = await persistence.load();
    assert.equal(loaded?.rules.length, 1);
    assert.equal(loaded?.triggers.length, 1);
  });
});

test('restores rules, trigger history, dedupe and cooldown across restart', async () => {
  const persistence = new MemoryAlertsPersistence();
  let now = new Date('2026-08-12T12:00:00.000Z');
  const ids = createIds();
  const options = {
    now: () => now,
    createId: ids,
    defaultCooldownMs: 60_000,
  };
  const first = new AlertsRuntimeService([], options, persistence);

  await first.start();
  first.createRule({
    name: 'Confirmation',
    eventType: 'setup_confirmation',
  });
  assert.equal(first.ingestEvent(sourceEvent('event-1')).length, 1);
  await first.stop();

  now = new Date('2026-08-12T12:00:10.000Z');
  const second = new AlertsRuntimeService([], options, persistence);
  await second.start();

  const hydrated = second.getStatus();
  assert.equal(hydrated.persistenceMode, 'persistent');
  assert.equal(hydrated.persistenceState, 'ready');
  assert.equal(hydrated.persistenceVersion, 1);
  assert.equal(hydrated.hydratedRulesCount, 1);
  assert.equal(hydrated.hydratedTriggersCount, 1);
  assert.equal(second.ingestEvent(sourceEvent('event-1')).length, 0);
  assert.equal(second.ingestEvent(sourceEvent('event-2')).length, 0);

  now = new Date('2026-08-12T12:01:00.000Z');
  assert.equal(second.ingestEvent(sourceEvent('event-3')).length, 1);
  assert.equal(second.getTriggers().length, 2);
  await second.stop();
});

test('hydrates before source subscription and blocks early mutations', async () => {
  const source = new TestAlertSource();
  let resolveLoad!: (value: null) => void;
  const loadGate = new Promise<null>((resolve) => {
    resolveLoad = resolve;
  });
  const persistence: AlertsPersistenceContract = {
    adapter: 'controlled',
    load: () => loadGate,
    save: async () => undefined,
  };
  const runtime = new AlertsRuntimeService(
    [source],
    { createId: createIds() },
    persistence,
  );

  assert.throws(
    () => runtime.createRule({
      name: 'Too early',
      eventType: 'setup_confirmation',
    }),
    (error: unknown) =>
      error instanceof AlertsDomainError
      && error.code === 'alerts_persistence_not_ready',
  );

  const starting = runtime.start();
  assert.equal(runtime.getStatus().persistenceState, 'loading');
  assert.equal(source.listenersCount, 0);
  resolveLoad(null);
  await starting;
  assert.equal(source.listenersCount, 1);
  assert.equal(runtime.getStatus().state, 'running');
  await runtime.stop();
  assert.equal(source.listenersCount, 0);
});

test('does not subscribe after stop wins a pending hydration race', async () => {
  const source = new TestAlertSource();
  let resolveLoad!: (value: null) => void;
  const loadGate = new Promise<null>((resolve) => {
    resolveLoad = resolve;
  });
  const persistence: AlertsPersistenceContract = {
    adapter: 'controlled',
    load: () => loadGate,
    save: async () => undefined,
  };
  const runtime = new AlertsRuntimeService(
    [source],
    {},
    persistence,
  );

  const starting = runtime.start();
  const stopping = runtime.stop();
  resolveLoad(null);
  await Promise.all([starting, stopping]);

  assert.equal(source.listenersCount, 0);
  assert.equal(runtime.getStatus().state, 'stopped');
  assert.equal(runtime.getStatus().persistenceState, 'ready');
});

test('keeps corrupt and unsupported storage intact in degraded memory mode', async (context) => {
  const cases = [
    {
      name: 'corrupt JSON',
      source: '{broken',
      message: 'invalid JSON',
    },
    {
      name: 'unsupported version',
      source: JSON.stringify({
        schema: 'nexus.alerts.runtime',
        version: 2,
      }),
      message: 'Unsupported Alerts persistence version',
    },
  ];

  for (const item of cases) {
    await context.test(item.name, async () => {
      await withTempDirectory(async (directory) => {
        const filePath = join(directory, 'alerts.json');
        await writeFile(filePath, item.source, 'utf8');
        const runtime = new AlertsRuntimeService([], {
          createId: createIds(),
        }, new JsonFileAlertsPersistence({ filePath }));

        await runtime.start();
        const status = runtime.getStatus();
        assert.equal(status.state, 'running');
        assert.equal(status.persistenceState, 'degraded');
        assert.equal(status.persistenceErrorsCount, 1);
        assert.match(status.lastPersistenceError ?? '', new RegExp(item.message));

        runtime.createRule({
          name: 'Memory-only recovery rule',
          eventType: 'setup_confirmation',
        });
        await runtime.stop();
        assert.equal(await readFile(filePath, 'utf8'), item.source);
      });
    });
  }
});

test('reports a save failure and retries on the next mutation', async () => {
  const persistence = new MemoryAlertsPersistence();
  persistence.saveFailuresRemaining = 1;
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
  }, persistence);

  await runtime.start();
  const rule = runtime.createRule({
    name: 'Retry persistence',
    eventType: 'setup_confirmation',
  });
  await runtime.flushPersistence();

  assert.equal(runtime.getStatus().persistenceState, 'degraded');
  assert.equal(runtime.getStatus().persistenceErrorsCount, 1);
  assert.equal(runtime.getStatus().persistenceSavesCount, 0);

  runtime.setRuleEnabled(rule.id, false);
  await runtime.flushPersistence();

  const recovered = runtime.getStatus();
  assert.equal(recovered.persistenceState, 'ready');
  assert.equal(recovered.persistenceSaveAttempts, 2);
  assert.equal(recovered.persistenceSavesCount, 1);
  assert.equal(recovered.lastPersistenceError, null);
  assert.equal(
    (persistence.snapshot as AlertsPersistenceSnapshotV1)
      .rules[0]?.enabled,
    false,
  );
  await runtime.stop();
});

test('bounds hydrated history and keeps dedupe independent from triggers', async () => {
  const persistence = new MemoryAlertsPersistence();
  const first = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
  }, persistence);

  await first.start();
  first.createRule({
    name: 'Bounded history',
    eventType: 'setup_confirmation',
  });
  first.ingestEvent(sourceEvent('event-1'));
  first.ingestEvent(sourceEvent('event-2'));
  first.ingestEvent(sourceEvent('event-3'));
  await first.stop();

  const snapshot = persistence.snapshot as AlertsPersistenceSnapshotV1;
  snapshot.sourceEventDedupeKeys = [
    'setup_lifecycle:event-3',
    'setup_lifecycle:event-4',
    'setup_lifecycle:event-5',
  ];

  const second = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
    maxTriggers: 2,
    maxDedupeKeys: 2,
  }, persistence);

  await second.start();
  assert.equal(second.getStatus().hydratedTriggersCount, 2);
  assert.equal(second.getStatus().droppedTriggersCount, 1);
  assert.equal(second.getTriggers().length, 2);

  assert.equal(second.ingestEvent(sourceEvent('event-3')).length, 1);
  assert.equal(second.getTriggers().length, 2);
  assert.equal(second.ingestEvent(sourceEvent('event-5')).length, 0);
  await second.stop();
});

test('buildApp persists HTTP-created rules and reports persistent metadata after restart', async () => {
  await withTempDirectory(async (directory) => {
    const filePath = join(directory, 'alerts.json');
    const env: AppEnv = {
      ...testEnv,
      alertsPersistenceEnabled: true,
      alertsPersistencePath: filePath,
    };
    const createApp = () => buildApp({
      env,
      realtimeMarketDataService: null,
      orderBookDepthService: null,
      binanceSymbolUniverseService: null,
      marketWideRealtimeService: null,
      marketWideHistoryWarmupService: null,
      setupDetectionRuntimeService: null,
      setupDetectionRuntimeReader: null,
      setupDetectionRuntimeEventSource: null,
      levelV2ShadowRuntimeService: null,
      levelV2ShadowRuntimeReader: null,
    });

    const first = await createApp();
    await first.ready();
    const created = await first.inject({
      method: 'POST',
      url: '/api/v1/alerts/rules',
      payload: {
        name: 'Persisted via HTTP',
        eventType: 'setup_confirmation',
        enabled: false,
      },
    });
    assert.equal(created.statusCode, 201);
    await first.close();

    const second = await createApp();
    await second.ready();
    const metadata = await second.inject({
      method: 'GET',
      url: '/api/v1/alerts/meta',
    });
    const status = await second.inject({
      method: 'GET',
      url: '/api/v1/alerts/status',
    });
    const rules = await second.inject({
      method: 'GET',
      url: '/api/v1/alerts/rules',
    });

    assert.equal(metadata.json().persistenceMode, 'persistent');
    assert.equal(status.json().persistenceState, 'ready');
    assert.equal(status.json().hydratedRulesCount, 1);
    assert.equal(rules.json()[0].name, 'Persisted via HTTP');
    assert.equal(rules.json()[0].enabled, false);
    await second.close();
  });
});
