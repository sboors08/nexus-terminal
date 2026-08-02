import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RUNTIME_FEEDBACK_PATH,
  RUNTIME_SETUP_FEEDBACK_PATH,
  fetchRuntimeFeedback,
  fetchRuntimeSetupFeedback,
  parseRuntimeFeedbackResult,
} from '../node_modules/.tmp/realtime-test/api/runtime/feedbackApi.js';

const generalPayload = {
  type: 'data_issue',
  message: 'Scanner price is stale',
  rating: 2,
  contact: null,
  context: {
    route: '/app/scanner?symbol=SOLUSDT',
    screen: 'Scanner',
    symbol: 'SOLUSDT',
    timeframe: '5m',
    setupId: 'setup-sol-001',
    replayId: null,
    appVersion: 'test-v0.1',
    userAgent: 'node-test',
    createdAt: '2026-08-02T09:00:00.000Z',
  },
};

const setupPayload = {
  setupId: 'setup-sol-001',
  useful: false,
  reasons: [
    'detected_too_late',
  ],
  comment: 'The impulse had already started.',
  createdAt: '2026-08-02T09:01:00.000Z',
};

function createMutationResponse(id) {
  return new Response(
    JSON.stringify({
      id,
      acceptedAt: '2026-08-02T09:02:00.000Z',
    }),
    {
      status: 202,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

test('posts general feedback to the runtime backend', async () => {
  let requestedUrl = '';
  let requestedBody = null;

  const result =
    await fetchRuntimeFeedback(
      generalPayload,
      {
        baseUrl: 'http://localhost:4100/',
        fetcher: async (input, init) => {
          requestedUrl = String(input);
          requestedBody = JSON.parse(String(init?.body));

          assert.equal(init?.method, 'POST');

          const headers =
            new Headers(init?.headers);

          assert.equal(
            headers.get('accept'),
            'application/json',
          );

          assert.equal(
            headers.get('content-type'),
            'application/json',
          );

          return createMutationResponse(
            'general-feedback-test',
          );
        },
      },
    );

  assert.equal(
    requestedUrl,
    'http://localhost:4100'
      + RUNTIME_FEEDBACK_PATH,
  );

  assert.deepEqual(
    requestedBody,
    generalPayload,
  );

  assert.deepEqual(
    result,
    {
      id: 'general-feedback-test',
      acceptedAt: '2026-08-02T09:02:00.000Z',
    },
  );
});

test('posts setup feedback to the runtime backend', async () => {
  let requestedUrl = '';
  let requestedBody = null;

  const result =
    await fetchRuntimeSetupFeedback(
      setupPayload,
      {
        fetcher: async (input, init) => {
          requestedUrl = String(input);
          requestedBody = JSON.parse(String(init?.body));

          return createMutationResponse(
            'setup-feedback-test',
          );
        },
      },
    );

  assert.equal(
    requestedUrl,
    RUNTIME_SETUP_FEEDBACK_PATH,
  );

  assert.deepEqual(
    requestedBody,
    setupPayload,
  );

  assert.equal(
    result.id,
    'setup-feedback-test',
  );
});

test('rejects an invalid feedback mutation response', () => {
  assert.throws(
    () =>
      parseRuntimeFeedbackResult({
        id: '',
        acceptedAt: 'not-a-date',
      }),
    /mutation id/u,
  );
});

test('rejects a failed feedback request', async () => {
  await assert.rejects(
    () =>
      fetchRuntimeFeedback(
        generalPayload,
        {
          fetcher: async () =>
            new Response(
              JSON.stringify({
                error: 'feedback_unavailable',
              }),
              {
                status: 503,
                headers: {
                  'content-type': 'application/json',
                },
              },
            ),
        },
      ),
    /status 503/u,
  );
});
