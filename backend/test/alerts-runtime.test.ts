import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import { AlertsRuntimeService } from '../src/modules/alerts/alerts-runtime.service.js';
import { alertsRoutes } from '../src/modules/alerts/alerts.routes.js';
import {
  mapSetupLifecycleEventToAlerts,
  SetupLifecycleAlertEventSource,
} from '../src/modules/alerts/setup-lifecycle-alert-event-source.js';
import type {
  SetupDetectionRuntimeEventSource,
  SetupDetectionRuntimeLifecycle,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventListener,
} from '../src/modules/setup-engine/setup-lifecycle-events.types.js';
import type {
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

function createIds() {
  let value = 0;
  return (kind: 'rule' | 'trigger') =>
    `${kind}-${++value}`;
}

function setupEvent(
  eventId: number,
  type: SetupLifecycleEvent['type'],
  currentStage: SetupLifecycleEvent['currentStage'],
): SetupLifecycleEvent {
  return {
    eventId,
    type,
    occurredAt: '2026-08-12T12:00:00.000Z',
    candidateId: 'setup-sol',
    symbol: 'SOLUSDT',
    setupType: 'level_breakout',
    direction: 'long',
    previousStage: 'LEVEL_CONFIRMED',
    currentStage,
    outcome:
      type === 'breakout_confirmed'
        ? 'breakout'
        : null,
    candidate: {
      id: 'setup-sol',
      symbol: 'SOLUSDT',
      timeframe: '5m',
      setupType: 'level_breakout',
      direction: 'long',
      stage: currentStage,
      outcome:
        type === 'breakout_confirmed'
          ? 'breakout'
          : null,
      level: {
        kind: 'resistance',
        centerPrice: 101,
        zoneLow: 100.8,
        zoneHigh: 101.2,
        touches: 2,
        confirmedAt: '2026-08-12T11:30:00.000Z',
      },
      currentPrice: 100.5,
      distanceToLevelPct: 0.2,
      createdAt: '2026-08-12T11:30:00.000Z',
      updatedAt: '2026-08-12T12:00:00.000Z',
      expiresAt: '2026-08-12T13:00:00.000Z',
    },
  };
}

class TestSetupSource
implements SetupDetectionRuntimeEventSource {
  private readonly listeners =
    new Set<SetupLifecycleEventListener>();

  get listenersCount() {
    return this.listeners.size;
  }

  subscribeLifecycleEvents(
    listener: SetupLifecycleEventListener,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: SetupLifecycleEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

class StartupSetupRuntime
extends TestSetupSource
implements SetupDetectionRuntimeLifecycle {
  starts = 0;
  stops = 0;

  start(): void {
    this.starts += 1;
    this.emit(
      setupEvent(
        1,
        'breakout_confirmed',
        'BREAKOUT_CONFIRMED',
      ),
    );
  }

  stop(): void {
    this.stops += 1;
  }
}

function sourceEvent(
  sourceEventId: string,
  symbol = 'SOLUSDT',
): AlertTriggerEvent {
  return {
    sourceEventId,
    source: 'setup_lifecycle',
    eventType: 'setup_confirmation',
    occurredAt: '2026-08-12T12:00:00.000Z',
    symbol,
    timeframe: '5m',
    entityId: 'setup-sol',
    payload: { stage: 'confirmation' },
  };
}

test('creates, updates, filters and toggles runtime-only rules', () => {
  let now = new Date('2026-08-12T12:00:00.000Z');
  const runtime = new AlertsRuntimeService([], {
    now: () => now,
    createId: createIds(),
  });

  const rule = runtime.createRule({
    name: ' SOL confirmation ',
    eventType: 'setup_confirmation',
    symbol: 'solusdt',
    timeframe: '5m',
    parameters: { origin: 'test' },
  });

  assert.equal(rule.source, 'setup_lifecycle');
  assert.equal(rule.symbol, 'SOLUSDT');
  assert.equal(rule.revision, 1);
  assert.equal(runtime.getStatus().persistenceMode, 'runtime_only');

  now = new Date('2026-08-12T12:01:00.000Z');
  const updated = runtime.updateRule(rule.id, {
    name: 'Updated',
    cooldownMs: 5_000,
  });

  assert.equal(updated?.revision, 2);
  assert.equal(updated?.name, 'Updated');
  assert.equal(runtime.getRules({ enabled: true }).length, 1);

  const disabled = runtime.setRuleEnabled(rule.id, false);
  assert.equal(disabled?.enabled, false);
  assert.equal(disabled?.revision, 3);
});

test('matches symbol and timeframe bindings without duplicating source calculations', () => {
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
  });

  runtime.createRule({
    name: 'SOL 5m',
    eventType: 'setup_confirmation',
    symbol: 'SOLUSDT',
    timeframe: '5m',
  });
  runtime.createRule({
    name: 'All confirmations',
    eventType: 'setup_confirmation',
  });

  assert.equal(runtime.ingestEvent(sourceEvent('event-1')).length, 2);
  assert.equal(runtime.ingestEvent(sourceEvent('event-2', 'ETHUSDT')).length, 1);
});

test('deduplicates replayed source events and enforces cooldown per rule scope', () => {
  let now = new Date('2026-08-12T12:00:00.000Z');
  const runtime = new AlertsRuntimeService([], {
    now: () => now,
    createId: createIds(),
    defaultCooldownMs: 60_000,
  });

  runtime.createRule({
    name: 'Confirmation',
    eventType: 'setup_confirmation',
  });

  assert.equal(runtime.ingestEvent(sourceEvent('event-1')).length, 1);
  assert.equal(runtime.ingestEvent(sourceEvent('event-1')).length, 0);
  assert.equal(runtime.ingestEvent(sourceEvent('event-2')).length, 0);

  now = new Date('2026-08-12T12:01:00.000Z');
  assert.equal(runtime.ingestEvent(sourceEvent('event-3')).length, 1);

  const status = runtime.getStatus();
  assert.equal(status.duplicateEventsCount, 1);
  assert.equal(status.cooldownSuppressedCount, 1);
});

test('bounds trigger history and returns defensive copies', () => {
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
    maxTriggers: 2,
    maxDedupeKeys: 2,
  });

  runtime.createRule({
    name: 'Confirmation',
    eventType: 'setup_confirmation',
  });

  runtime.ingestEvent(sourceEvent('event-1'));
  runtime.ingestEvent(sourceEvent('event-2'));
  runtime.ingestEvent(sourceEvent('event-3'));

  const triggers = runtime.getTriggers();
  assert.equal(triggers.length, 2);
  assert.equal(runtime.getStatus().droppedTriggersCount, 1);

  triggers[0]!.payload.changed = true;
  assert.equal(runtime.getTriggers()[0]!.payload.changed, undefined);
});

test('maps setup lifecycle events into generic and semantic alert events', () => {
  const approach = mapSetupLifecycleEventToAlerts(
    setupEvent(1, 'stage_transition', 'APPROACHING_THIRD_TOUCH'),
  );
  const breakout = mapSetupLifecycleEventToAlerts(
    setupEvent(2, 'breakout_confirmed', 'BREAKOUT_CONFIRMED'),
  );

  assert.deepEqual(
    approach.map((event) => event.eventType),
    ['setup_stage_changed', 'price_near_level'],
  );
  assert.deepEqual(
    breakout.map((event) => event.eventType),
    ['setup_stage_changed', 'setup_breakout'],
  );
  assert.equal(breakout[1]!.entityId, 'setup-sol');
});

test('subscribes before setup startup events and stops cleanly', () => {
  const setupSource = new TestSetupSource();
  const runtime = new AlertsRuntimeService([
    new SetupLifecycleAlertEventSource(setupSource),
  ], {
    createId: createIds(),
    defaultCooldownMs: 0,
  });

  runtime.createRule({
    name: 'Breakout',
    eventType: 'setup_breakout',
  });

  runtime.start();
  assert.equal(setupSource.listenersCount, 1);

  setupSource.emit(
    setupEvent(1, 'breakout_confirmed', 'BREAKOUT_CONFIRMED'),
  );
  assert.equal(runtime.getTriggers().length, 1);

  runtime.stop();
  assert.equal(setupSource.listenersCount, 0);
});

test('buildApp subscribes Alerts before setup runtime startup events', async () => {
  const setupRuntime = new StartupSetupRuntime();
  const alertsRuntime = new AlertsRuntimeService([
    new SetupLifecycleAlertEventSource(setupRuntime),
  ], {
    createId: createIds(),
    defaultCooldownMs: 0,
  });

  alertsRuntime.createRule({
    name: 'Breakout',
    eventType: 'setup_breakout',
  });

  const app = await buildApp({
    env: testEnv,
    realtimeMarketDataService: null,
    orderBookDepthService: null,
    binanceSymbolUniverseService: null,
    marketWideRealtimeService: null,
    marketWideHistoryWarmupService: null,
    setupDetectionRuntimeService: setupRuntime,
    setupDetectionRuntimeReader: null,
    setupDetectionRuntimeEventSource: setupRuntime,
    levelV2ShadowRuntimeService: null,
    levelV2ShadowRuntimeReader: null,
    alertsRuntimeService: alertsRuntime,
  });

  await app.ready();

  assert.equal(setupRuntime.starts, 1);
  assert.equal(alertsRuntime.getTriggers().length, 1);

  await app.close();

  assert.equal(setupRuntime.stops, 1);
  assert.equal(alertsRuntime.getStatus().state, 'stopped');
});

test('exposes rule and trigger HTTP contracts', async () => {
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
    defaultCooldownMs: 0,
  });
  runtime.start();

  const app = Fastify({ logger: false });
  await app.register(alertsRoutes, {
    prefix: '/api/v1',
    alertsRuntime: runtime,
  });

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/alerts/rules',
    payload: {
      name: 'Confirmation',
      eventType: 'setup_confirmation',
      symbol: 'SOLUSDT',
      timeframe: '5m',
    },
  });
  assert.equal(created.statusCode, 201);

  runtime.ingestEvent(sourceEvent('event-1'));

  const rules = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts/rules?enabled=true&symbol=SOLUSDT',
  });
  const triggers = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts/triggers?eventType=setup_confirmation',
  });
  const status = await app.inject({
    method: 'GET',
    url: '/api/v1/alerts/status',
  });

  assert.equal(rules.statusCode, 200);
  assert.equal(rules.json().length, 1);
  assert.equal(triggers.json().length, 1);
  assert.equal(status.json().persistenceMode, 'runtime_only');

  await app.close();
});

test('validates HTTP input and reports unavailable runtime', async () => {
  const runtime = new AlertsRuntimeService([], {
    createId: createIds(),
  });
  const app = Fastify({ logger: false });
  await app.register(alertsRoutes, {
    prefix: '/api/v1',
    alertsRuntime: runtime,
  });

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/alerts/rules',
    payload: {
      name: '',
      eventType: 'setup_confirmation',
    },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, 'invalid_alert_rule_name');
  await app.close();

  const unavailable = Fastify({ logger: false });
  await unavailable.register(alertsRoutes, {
    prefix: '/api/v1',
  });
  const response = await unavailable.inject({
    method: 'GET',
    url: '/api/v1/alerts/status',
  });
  assert.equal(response.statusCode, 503);
  await unavailable.close();
});
