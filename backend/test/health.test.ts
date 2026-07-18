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

test('GET /api/v1/health returns backend status', async (t) => {
  const app = await buildApp({ env: testEnv });
  t.after(async () => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/health',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().status, 'ok');
  assert.deepEqual(response.json().service, 'nexus-backend');
});
