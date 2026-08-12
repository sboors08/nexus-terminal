import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AlertsRuntimeApiError,
  createAlertRule,
  fetchAlertsRuntimeView,
  parseAlertTrigger,
  setAlertRuleEnabled,
  updateAlertRule,
} from '../node_modules/.tmp/alerts-runtime-test/shared/api/runtime/alertsRuntimeApi.js';

const now = '2026-08-12T18:00:00.000Z';

function createRule(overrides = {}) {
  return {
    id: 'rule-1',
    name: 'Volume spike',
    description: null,
    eventType: 'volume_spike',
    source: 'market_scanner',
    enabled: true,
    symbol: 'SOLUSDT',
    timeframe: '5m',
    cooldownMs: 60000,
    parameters: {},
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ...overrides,
  };
}

function createTrigger() {
  return {
    id: 'trigger-1',
    ruleId: 'rule-1',
    ruleRevision: 1,
    sourceEventId: 'volume-spike:SOLUSDT:5m:1',
    source: 'market_scanner',
    eventType: 'volume_spike',
    occurredAt: now,
    triggeredAt: now,
    cooldownUntil: '2026-08-12T18:01:00.000Z',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    entityId: 'market-activity:SOLUSDT:5m:1',
    payload: {
      anomalyRatio: 2.4,
      volumeRatio: 2.4,
      tradesRatio: 1.8,
      priceChangePct: 1.25,
    },
    workspaceContext: {
      symbol: 'SOLUSDT',
      timeframe: '5m',
      setupId: null,
      replayId: null,
    },
  };
}

function createStatus() {
  return {
    state: 'running',
    persistenceMode: 'persistent',
    persistenceState: 'ready',
    persistenceAdapter: 'json_file',
    persistenceVersion: 1,
    persistenceLoadAttempts: 1,
    persistenceSaveAttempts: 2,
    persistenceSavesCount: 2,
    persistenceErrorsCount: 0,
    hydratedRulesCount: 1,
    hydratedTriggersCount: 1,
    pendingPersistenceWrites: 0,
    lastPersistedAt: now,
    lastPersistenceError: null,
    rulesCount: 1,
    enabledRulesCount: 1,
    triggersCount: 1,
    maxRules: 1000,
    maxTriggers: 10000,
    maxDedupeKeys: 50000,
    sourceEventsCount: 2,
    duplicateEventsCount: 0,
    cooldownSuppressedCount: 0,
    droppedTriggersCount: 0,
    lastSourceEventAt: now,
    lastTriggeredAt: now,
  };
}

test('fetches and validates the complete Alerts runtime view', async () => {
  const requested = [];
  const fetcher = async (input, init) => {
    const url = String(input);
    requested.push(url);
    assert.equal(init?.method, undefined);
    assert.equal(new Headers(init?.headers).get('accept'), 'application/json');
    if (url.endsWith('/alerts/meta')) {
      return Response.json({
        persistenceMode: 'persistent',
        eventTypes: ['volume_spike', 'setup_confirmation'],
        eventSources: ['market_scanner', 'setup_lifecycle'],
        deliveryChannels: [],
      });
    }
    if (url.endsWith('/alerts/status')) return Response.json(createStatus());
    if (url.endsWith('/alerts/rules?limit=25')) return Response.json([createRule()]);
    if (url.endsWith('/alerts/triggers?limit=25')) return Response.json([createTrigger()]);
    return new Response(null, { status: 404 });
  };

  const result = await fetchAlertsRuntimeView({
    baseUrl: 'http://localhost:4100/',
    limit: 25,
    fetcher,
  });

  assert.equal(result.metadata.persistenceMode, 'persistent');
  assert.equal(result.status.persistenceState, 'ready');
  assert.equal(result.status.persistenceVersion, 1);
  assert.equal(result.status.state, 'running');
  assert.equal(result.rules[0].source, 'market_scanner');
  assert.equal(result.triggers[0].payload.volumeRatio, 2.4);
  assert.deepEqual(requested.sort(), [
    'http://localhost:4100/api/v1/alerts/meta',
    'http://localhost:4100/api/v1/alerts/rules?limit=25',
    'http://localhost:4100/api/v1/alerts/status',
    'http://localhost:4100/api/v1/alerts/triggers?limit=25',
  ]);
});

test('uses real create, update and enabled rule contracts', async () => {
  const calls = [];
  const fetcher = async (input, init) => {
    calls.push({ url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) });
    const body = JSON.parse(String(init?.body));
    return Response.json(createRule({
      name: body.name ?? 'Volume spike',
      enabled: body.enabled ?? true,
      revision: init?.method === 'PATCH' ? 2 : 1,
    }), { status: init?.method === 'POST' ? 201 : 200 });
  };

  await createAlertRule({ name: 'SOL volume', eventType: 'volume_spike' }, { fetcher });
  await updateAlertRule('rule-1', { name: 'SOL volume 2' }, { fetcher });
  await setAlertRuleEnabled('rule-1', false, { fetcher });

  assert.deepEqual(calls, [
    { url: '/api/v1/alerts/rules', method: 'POST', body: { name: 'SOL volume', eventType: 'volume_spike' } },
    { url: '/api/v1/alerts/rules/rule-1', method: 'PATCH', body: { name: 'SOL volume 2' } },
    { url: '/api/v1/alerts/rules/rule-1/enabled', method: 'PATCH', body: { enabled: false } },
  ]);
});

test('surfaces runtime unavailable responses without a mock fallback', async () => {
  await assert.rejects(
    () => fetchAlertsRuntimeView({
      fetcher: async () => Response.json({
        error: 'alerts_runtime_unavailable',
        message: 'Alerts runtime is unavailable',
      }, { status: 503 }),
    }),
    (error) => error instanceof AlertsRuntimeApiError
      && error.status === 503
      && error.code === 'alerts_runtime_unavailable',
  );
});

test('rejects malformed trigger payloads at the frontend boundary', () => {
  const malformed = createTrigger();
  malformed.payload.volumeRatio = Number.POSITIVE_INFINITY;
  assert.throws(() => parseAlertTrigger(malformed), /payload/u);
});
