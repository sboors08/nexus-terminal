import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  AlertDeliveryError,
  AlertsDeliveryService,
  type AlertDeliveryAdapter,
  type AlertDeliveryOutboxItem,
  type AlertDeliveryRequest,
} from '../src/modules/alerts/alerts-delivery.js';
import {
  ALERTS_PERSISTENCE_LEGACY_VERSION,
  ALERTS_PERSISTENCE_SCHEMA,
  normalizeAlertsPersistenceSnapshot,
  type AlertsPersistenceContract,
  type AlertsPersistenceSnapshot,
  type AlertsPersistenceSnapshotV1,
} from '../src/modules/alerts/alerts-persistence.js';
import {
  AlertsRuntimeService,
} from '../src/modules/alerts/alerts-runtime.service.js';
import type {
  AlertTrigger,
  AlertTriggerEvent,
} from '../src/modules/alerts/alerts.types.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

function trigger(
  id = 'trigger-1',
): AlertTrigger {
  return {
    id,
    ruleId: 'rule-1',
    ruleRevision: 1,
    sourceEventId: 'event-1',
    source: 'setup_lifecycle',
    eventType: 'setup_confirmation',
    occurredAt: '2026-08-13T10:00:00.000Z',
    triggeredAt: '2026-08-13T10:00:01.000Z',
    cooldownUntil: '2026-08-13T10:01:01.000Z',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    entityId: 'setup-sol',
    payload: {
      stage: 'confirmation',
    },
    workspaceContext: {
      symbol: 'SOLUSDT',
      timeframe: '5m',
      setupId: 'setup-sol',
      replayId: null,
    },
  };
}

function sourceEvent(
  sourceEventId: string,
): AlertTriggerEvent {
  return {
    sourceEventId,
    source: 'setup_lifecycle',
    eventType: 'setup_confirmation',
    occurredAt: '2026-08-13T10:00:00.000Z',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    entityId: 'setup-sol',
    payload: {
      stage: 'confirmation',
    },
  };
}

function createIds() {
  let value = 0;

  return (kind: 'rule' | 'trigger') =>
    `${kind}-${++value}`;
}

class MemoryPersistence
implements AlertsPersistenceContract {
  readonly adapter = 'memory';

  snapshot:
    AlertsPersistenceSnapshot | null = null;

  async load(): Promise<unknown | null> {
    return this.snapshot === null
      ? null
      : structuredClone(this.snapshot);
  }

  async save(
    snapshot: AlertsPersistenceSnapshot,
  ): Promise<void> {
    this.snapshot =
      structuredClone(snapshot);
  }
}

function adapter(
  deliver:
    (request: AlertDeliveryRequest) => Promise<void>,
): AlertDeliveryAdapter {
  return {
    channel: 'test_channel',
    adapter: 'test_adapter',
    deliver,
  };
}

test('delivers one immutable trigger with a stable provider-neutral idempotency key', async () => {
  const requests:
    AlertDeliveryRequest[] = [];
  let outboxId = 0;
  const delivery = new AlertsDeliveryService([
    adapter(async (request) => {
      requests.push(request);
      request.trigger.payload.stage = 'mutated';
    }),
  ], {
    now: () =>
      new Date('2026-08-13T10:00:02.000Z'),
    createId: () =>
      `outbox-${++outboxId}`,
  });

  const created =
    delivery.enqueue(trigger());
  delivery.start();
  await delivery.flushDue();

  assert.equal(created.length, 1);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.idempotencyKey,
    'nexus.alerts:test_channel:trigger-1',
  );
  assert.equal(requests[0]?.attempt, 1);
  assert.equal(
    delivery.exportOutbox()[0]
      ?.trigger.payload.stage,
    'confirmation',
  );
  assert.equal(
    delivery.getStatus().deliveredCount,
    1,
  );

  delivery.enqueue(trigger());
  await delivery.flushDue();
  assert.equal(requests.length, 1);
  assert.equal(
    delivery.getStatus()
      .duplicateEnqueuesCount,
    1,
  );
  await delivery.stop();
});

test('retries transient failures with bounded exponential backoff', async () => {
  let now =
    new Date('2026-08-13T10:00:02.000Z');
  let calls = 0;
  const delivery = new AlertsDeliveryService([
    adapter(async () => {
      calls += 1;

      if (calls < 3) {
        throw new AlertDeliveryError(
          'provider_busy',
          true,
        );
      }
    }),
  ], {
    now: () => now,
    createId: () => 'outbox-1',
    maxAttempts: 3,
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 2_000,
  });

  delivery.enqueue(trigger());
  delivery.start();
  await delivery.flushDue();

  let item = delivery.exportOutbox()[0];
  assert.equal(item?.state, 'failed');
  assert.equal(item?.attempts, 1);
  assert.equal(
    item?.nextAttemptAt,
    '2026-08-13T10:00:03.000Z',
  );

  now = new Date('2026-08-13T10:00:03.000Z');
  await delivery.flushDue();
  item = delivery.exportOutbox()[0];
  assert.equal(item?.attempts, 2);
  assert.equal(
    item?.nextAttemptAt,
    '2026-08-13T10:00:05.000Z',
  );

  now = new Date('2026-08-13T10:00:05.000Z');
  await delivery.flushDue();
  item = delivery.exportOutbox()[0];
  assert.equal(item?.state, 'delivered');
  assert.equal(item?.attempts, 3);
  assert.equal(calls, 3);
  assert.equal(
    delivery.getStatus().failuresCount,
    2,
  );
  await delivery.stop();
});

test('does not retry permanent failures or expose adapter error messages', async () => {
  let calls = 0;
  const delivery = new AlertsDeliveryService([
    adapter(async () => {
      calls += 1;
      throw new AlertDeliveryError(
        'destination_rejected',
        false,
        'secret-token=must-not-be-exposed',
      );
    }),
  ], {
    now: () =>
      new Date('2026-08-13T10:00:02.000Z'),
    createId: () => 'outbox-1',
  });

  delivery.enqueue(trigger());
  delivery.start();
  await delivery.flushDue();
  await delivery.flushDue();

  const item = delivery.exportOutbox()[0];
  const status = delivery.getStatus();
  assert.equal(calls, 1);
  assert.equal(item?.state, 'failed');
  assert.equal(item?.nextAttemptAt, null);
  assert.equal(
    item?.lastErrorCode,
    'destination_rejected',
  );
  assert.equal(
    status.lastErrorCode,
    'destination_rejected',
  );
  assert.doesNotMatch(
    JSON.stringify({ item, status }),
    /secret-token/,
  );
  await delivery.stop();
});

test('recovers an interrupted sending item and reuses its idempotency key after restart', async () => {
  const source = trigger();
  const persisted:
    AlertDeliveryOutboxItem = {
      id: 'outbox-1',
      triggerId: source.id,
      channel: 'test_channel',
      idempotencyKey:
        'nexus.alerts:test_channel:trigger-1',
      trigger: source,
      state: 'sending',
      attempts: 1,
      maxAttempts: 3,
      createdAt: '2026-08-13T10:00:02.000Z',
      updatedAt: '2026-08-13T10:00:03.000Z',
      nextAttemptAt: null,
      lastAttemptAt: '2026-08-13T10:00:03.000Z',
      deliveredAt: null,
      lastErrorCode: null,
    };
  const requests:
    AlertDeliveryRequest[] = [];
  const delivery = new AlertsDeliveryService([
    adapter(async (request) => {
      requests.push(request);
    }),
  ], {
    now: () =>
      new Date('2026-08-13T10:00:04.000Z'),
  });

  delivery.hydrate([persisted]);
  delivery.start();
  await delivery.flushDue();

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.attempt, 2);
  assert.equal(
    requests[0]?.idempotencyKey,
    persisted.idempotencyKey,
  );
  assert.equal(
    delivery.getStatus()
      .recoveredSendingCount,
    1,
  );
  assert.equal(
    delivery.exportOutbox()[0]?.state,
    'delivered',
  );
  await delivery.stop();
});

test('retains outbox items for an unavailable channel without attempting delivery', async () => {
  const source = trigger();
  const persisted:
    AlertDeliveryOutboxItem = {
      id: 'outbox-1',
      triggerId: source.id,
      channel: 'future_channel',
      idempotencyKey:
        'nexus.alerts:future_channel:trigger-1',
      trigger: source,
      state: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: '2026-08-13T10:00:02.000Z',
      updatedAt: '2026-08-13T10:00:02.000Z',
      nextAttemptAt: '2026-08-13T10:00:02.000Z',
      lastAttemptAt: null,
      deliveredAt: null,
      lastErrorCode: null,
    };
  const delivery =
    new AlertsDeliveryService();

  delivery.hydrate([persisted]);
  delivery.start();
  await delivery.flushDue();

  assert.equal(
    delivery.getStatus().state,
    'disabled',
  );
  assert.equal(
    delivery.getStatus()
      .unavailableChannelCount,
    1,
  );
  assert.equal(
    delivery.exportOutbox()[0]?.state,
    'pending',
  );
});

test('bounds outbox capacity without blocking trigger creation', async () => {
  const delivery = new AlertsDeliveryService([
    adapter(async () => undefined),
  ], {
    maxOutboxItems: 1,
    createId: () => 'outbox-1',
  });

  assert.equal(
    delivery.enqueue(trigger('trigger-1')).length,
    1,
  );
  assert.equal(
    delivery.enqueue(trigger('trigger-2')).length,
    0,
  );
  assert.equal(
    delivery.getStatus()
      .rejectedEnqueuesCount,
    1,
  );
  assert.equal(
    delivery.getStatus().lastErrorCode,
    'delivery_outbox_full',
  );
});

test('cleans terminal items for capacity but never discards active delivery work', async () => {
  let outboxId = 0;
  const delivery = new AlertsDeliveryService([
    adapter(async () => undefined),
  ], {
    maxOutboxItems: 1,
    createId: () =>
      `outbox-${++outboxId}`,
  });

  delivery.enqueue(trigger('trigger-1'));
  delivery.start();
  await delivery.flushDue();
  assert.equal(
    delivery.exportOutbox()[0]?.state,
    'delivered',
  );

  assert.equal(
    delivery.enqueue(trigger('trigger-2')).length,
    1,
  );
  assert.equal(
    delivery.exportOutbox()[0]?.triggerId,
    'trigger-2',
  );
  assert.equal(
    delivery.getStatus().cleanedItemsCount,
    1,
  );
  await delivery.stop();
});

test('stops retrying after the configured maximum attempts', async () => {
  let now =
    new Date('2026-08-13T10:00:02.000Z');
  let calls = 0;
  const delivery = new AlertsDeliveryService([
    adapter(async () => {
      calls += 1;
      throw new AlertDeliveryError(
        'provider_busy',
        true,
      );
    }),
  ], {
    now: () => now,
    createId: () => 'outbox-1',
    maxAttempts: 2,
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 1_000,
  });

  delivery.enqueue(trigger());
  delivery.start();
  await delivery.flushDue();
  now = new Date('2026-08-13T10:00:03.000Z');
  await delivery.flushDue();
  now = new Date('2026-08-13T10:01:00.000Z');
  await delivery.flushDue();

  const item = delivery.exportOutbox()[0];
  assert.equal(calls, 2);
  assert.equal(item?.attempts, 2);
  assert.equal(item?.state, 'failed');
  assert.equal(item?.nextAttemptAt, null);
  assert.equal(
    delivery.getStatus()
      .terminalFailuresCount,
    1,
  );
  await delivery.stop();
});

test('keeps Alerts runtime operational when delivery enqueue fails', async () => {
  let calls = 0;
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
  }, null, [
    adapter(async () => {
      calls += 1;
      throw new AlertDeliveryError(
        'provider_down',
        false,
      );
    }),
  ], {
    createId: () => '',
  });

  await runtime.start();
  runtime.createRule({
    name: 'Isolated delivery',
    eventType: 'setup_confirmation',
  });

  assert.equal(
    runtime.ingestEvent(
      sourceEvent('event-1'),
    ).length,
    1,
  );
  assert.equal(
    runtime.ingestEvent(
      sourceEvent('event-2'),
    ).length,
    1,
  );
  await runtime.flushDelivery();

  assert.equal(calls, 0);
  assert.equal(
    runtime.getStatus().state,
    'running',
  );
  assert.equal(
    runtime.getStatus().triggersCount,
    2,
  );
  assert.equal(
    runtime.getStatus()
      .deliveryRejectedEnqueuesCount,
    2,
  );
  assert.equal(
    runtime.getStatus()
      .lastDeliveryErrorCode,
    'delivery_enqueue_failed',
  );
  await runtime.stop();
});

test('keeps accepting source events after a delivery adapter failure', async () => {
  let calls = 0;
  let outboxId = 0;
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
  }, null, [
    adapter(async () => {
      calls += 1;
      throw new AlertDeliveryError(
        'provider_down',
        false,
      );
    }),
  ], {
    createId: () =>
      `outbox-${++outboxId}`,
  });

  await runtime.start();
  runtime.createRule({
    name: 'Isolated adapter',
    eventType: 'setup_confirmation',
  });
  runtime.ingestEvent(
    sourceEvent('event-1'),
  );
  await runtime.flushDelivery();
  runtime.ingestEvent(
    sourceEvent('event-2'),
  );
  await runtime.flushDelivery();

  assert.equal(calls, 2);
  assert.equal(
    runtime.getStatus().state,
    'running',
  );
  assert.equal(
    runtime.getStatus().triggersCount,
    2,
  );
  assert.equal(
    runtime.getStatus()
      .deliveryTerminalFailuresCount,
    2,
  );
  await runtime.stop();
});

test('migrates persistence v1 to v2 with an empty delivery outbox', () => {
  const source = trigger();
  const legacy:
    AlertsPersistenceSnapshotV1 = {
      schema: ALERTS_PERSISTENCE_SCHEMA,
      version:
        ALERTS_PERSISTENCE_LEGACY_VERSION,
      savedAt: '2026-08-13T10:00:02.000Z',
      rules: [{
        id: 'rule-1',
        name: 'Legacy rule',
        description: null,
        eventType: 'setup_confirmation',
        source: 'setup_lifecycle',
        enabled: true,
        symbol: null,
        timeframe: null,
        cooldownMs: 60_000,
        parameters: {},
        createdAt: '2026-08-13T09:00:00.000Z',
        updatedAt: '2026-08-13T09:00:00.000Z',
        revision: 1,
      }],
      triggers: [source],
      sourceEventDedupeKeys: [
        'setup_lifecycle:event-1',
      ],
      cooldowns: [],
    };

  const migrated =
    normalizeAlertsPersistenceSnapshot(
      legacy,
    );

  assert.equal(migrated.version, 2);
  assert.deepEqual(
    migrated.deliveryOutbox,
    [],
  );
  assert.equal(
    migrated.triggers[0]?.id,
    source.id,
  );
});

test('persists retryable delivery state and completes it after runtime restart', async () => {
  const persistence =
    new MemoryPersistence();
  let now =
    new Date('2026-08-13T10:00:02.000Z');
  let firstCalls = 0;
  const first = new AlertsRuntimeService([], {
    now: () => now,
    createId: createIds(),
    defaultCooldownMs: 0,
  }, persistence, [
    adapter(async () => {
      firstCalls += 1;
      throw new AlertDeliveryError(
        'provider_busy',
        true,
      );
    }),
  ], {
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 1_000,
    createId: () => 'outbox-1',
  });

  await first.start();
  first.createRule({
    name: 'External confirmation',
    eventType: 'setup_confirmation',
  });
  assert.equal(
    first.ingestEvent(
      sourceEvent('event-1'),
    ).length,
    1,
  );
  await first.flushDelivery();
  assert.equal(firstCalls, 1);
  assert.equal(
    first.getStatus().triggersCount,
    1,
  );
  assert.equal(
    first.getStatus().deliveryFailedCount,
    1,
  );
  await first.stop();

  assert.equal(
    persistence.snapshot
      ?.deliveryOutbox[0]?.state,
    'failed',
  );

  now =
    new Date('2026-08-13T10:00:03.000Z');
  const requests:
    AlertDeliveryRequest[] = [];
  const second = new AlertsRuntimeService([], {
    now: () => now,
    createId: createIds(),
    defaultCooldownMs: 0,
  }, persistence, [
    adapter(async (request) => {
      requests.push(request);
    }),
  ], {
    retryBaseDelayMs: 1_000,
    retryMaxDelayMs: 1_000,
  });

  await second.start();
  await second.flushDelivery();

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.idempotencyKey,
    'nexus.alerts:test_channel:trigger-2',
  );
  assert.equal(
    second.getStatus()
      .deliveryDeliveredCount,
    1,
  );
  assert.equal(
    second.getStatus().triggersCount,
    1,
  );
  await second.stop();
});

test('reports configured delivery diagnostics through HTTP without credentials', async () => {
  const deliveryAdapter = {
    ...adapter(async () => undefined),
    secretToken: 'must-not-be-exposed',
  };
  const app = await buildApp({
    env: testEnv,
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
    alertsDeliveryAdapters: [
      deliveryAdapter,
    ],
  });

  await app.ready();
  const metadata = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts/meta',
  });
  const status = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts/status',
  });

  assert.deepEqual(
    metadata.json().deliveryChannels,
    ['test_channel'],
  );
  assert.equal(
    status.json().deliveryState,
    'running',
  );
  assert.deepEqual(
    status.json().deliveryAdapters,
    ['test_adapter'],
  );
  assert.doesNotMatch(
    `${metadata.body}${status.body}`,
    /must-not-be-exposed/,
  );
  await app.close();
});
