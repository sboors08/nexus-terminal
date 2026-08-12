import assert from 'node:assert/strict';
import test from 'node:test';
import { mapAlertTriggerToView } from '../node_modules/.tmp/alerts-runtime-test/shared/alerts/alertsRuntimeView.js';

test('maps backend market triggers without inventing setup context', () => {
  const trigger = {
    id: 'trigger-market',
    ruleId: 'rule-market',
    ruleRevision: 3,
    sourceEventId: 'volume-spike:SOLUSDT:5m:1',
    source: 'market_scanner',
    eventType: 'volume_spike',
    occurredAt: '2026-08-12T17:59:30.000Z',
    triggeredAt: '2026-08-12T17:59:30.000Z',
    cooldownUntil: '2026-08-12T18:00:30.000Z',
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

  const view = mapAlertTriggerToView(
    trigger,
    new Set(['trigger-market']),
    new Date('2026-08-12T18:00:00.000Z'),
  );

  assert.equal(view.eventLabel, 'Всплеск объёма');
  assert.equal(view.sourceLabel, 'Market Scanner');
  assert.equal(view.direction, null);
  assert.equal(view.stage, null);
  assert.equal(view.setupId, null);
  assert.equal(view.readStatus, 'viewed');
  assert.equal(view.relativeTime, '30 сек назад');
  assert.equal(view.metrics[0].value, '2,4×');
});
