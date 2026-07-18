import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import type { AppEnv } from '../src/config/env.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: ['http://localhost:5173'],
  logLevel: 'silent',
};

test('NEXUS API Contract exposes canonical routes', async (t) => {
  const app = await buildApp({ env: testEnv });
  t.after(async () => app.close());

  const symbols = await app.inject({ method: 'GET', url: '/api/v1/market/symbols' });
  assert.equal(symbols.statusCode, 200);
  assert.equal(symbols.json()[0].exchange, 'binance');

  const candles = await app.inject({ method: 'GET', url: '/api/v1/market/candles?symbol=SOLUSDT&timeframe=5m' });
  assert.equal(candles.statusCode, 200);
  assert.equal(candles.json().length, 12);

  const workspace = await app.inject({ method: 'GET', url: '/api/v1/workspace/snapshot?setupId=setup-sol-breakout-001' });
  assert.equal(workspace.statusCode, 200);
  assert.equal(workspace.json().setup.id, 'setup-sol-breakout-001');
});

test('NEXUS API Contract returns typed errors', async (t) => {
  const app = await buildApp({ env: testEnv });
  t.after(async () => app.close());

  const response = await app.inject({ method: 'GET', url: '/api/v1/market/candles?symbol=SOLUSDT&timeframe=7m' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'invalid_timeframe');
  assert.equal(typeof response.json().requestId, 'string');
});

test('NEXUS API Contract accepts setup feedback', async (t) => {
  const app = await buildApp({ env: testEnv });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/setup-feedback',
    payload: {
      setupId: 'setup-sol-breakout-001',
      useful: true,
      reasons: [],
      comment: null,
      createdAt: '2026-07-18T14:10:00.000Z',
    },
  });
  assert.equal(response.statusCode, 202);
  assert.match(response.json().id, /^feedback-/);
});
