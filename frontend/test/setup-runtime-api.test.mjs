import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSetupRuntimeCandidateUrl,
  buildSetupRuntimeCandidatesUrl,
  fetchSetupRuntimeCandidate,
  fetchSetupRuntimeCandidates,
  mapSetupRuntimeCandidate,
  parseSetupRuntimeCandidate,
  selectPreferredSetupRuntimeCandidate,
} from '../node_modules/.tmp/realtime-test/api/runtime/setupRuntimeApi.js';

function createCandidate() {
  return {
    id:
      'setup-SOLUSDT-1m-support-1785082379999-level_bounce',

    symbol:
      'SOLUSDT',

    timeframe:
      '1m',

    setupType:
      'level_bounce',

    direction:
      'long',

    stage:
      'THIRD_TOUCH_CONFIRMED',

    outcome:
      null,

    level: {
      kind:
        'support',

      centerPrice:
        75.5,

      zoneLow:
        75.42,

      zoneHigh:
        75.58,

      touches:
        3,

      confirmedAt:
        '2026-07-26T16:39:59.999Z',
    },

    currentPrice:
      75.61,

    distanceToLevelPct:
      0.1457,

    createdAt:
      '2026-07-26T16:40:00.000Z',

    updatedAt:
      '2026-07-26T16:42:00.000Z',

    expiresAt:
      '2026-07-26T17:40:00.000Z',
  };
}

test(
  'maps a backend setup candidate to the frontend contract',
  () => {
    const candidate =
      parseSetupRuntimeCandidate(
        createCandidate(),
      );

    const setup =
      mapSetupRuntimeCandidate(
        candidate,
      );

    assert.equal(
      setup.id,
      candidate.id,
    );

    assert.equal(
      setup.stage,
      'confirmation',
    );

    assert.equal(
      setup.type,
      'level_bounce',
    );

    assert.equal(
      setup.level.type,
      'support',
    );

    assert.equal(
      setup.level.zoneLow,
      75.42,
    );

    assert.equal(
      setup.level.centerPrice,
      75.5,
    );

    assert.equal(
      setup.level.zoneHigh,
      75.58,
    );

    assert.equal(
      setup.level.touchesCount,
      3,
    );

    assert.equal(
      setup.volumeAnomaly,
      null,
    );

    assert.equal(
      setup.btcCorrelation,
      null,
    );
  },
);

test(
  'fetches and validates runtime setup candidates',
  async () => {
    let requestedUrl = '';

    const setups =
      await fetchSetupRuntimeCandidates({
        baseUrl:
          'http://localhost:4100/',

        limit:
          25,

        fetcher:
          async (
            input,
            init,
          ) => {
            requestedUrl =
              String(input);

            assert.equal(
              init?.method,
              'GET',
            );

            assert.equal(
              new Headers(
                init?.headers,
              ).get('accept'),
              'application/json',
            );

            return new Response(
              JSON.stringify([
                createCandidate(),
              ]),
              {
                status:
                  200,

                headers: {
                  'content-type':
                    'application/json',
                },
              },
            );
          },
      });

    assert.equal(
      requestedUrl,
      'http://localhost:4100/api/v1/setups/candidates?limit=25',
    );

    assert.equal(
      setups.length,
      1,
    );

    assert.equal(
      setups[0].symbol,
      'SOLUSDT',
    );
  },
);

test(
  'returns null for an unknown runtime candidate',
  async () => {
    const candidate =
      await fetchSetupRuntimeCandidate({
        candidateId:
          createCandidate().id,

        fetcher:
          async () =>
            new Response(
              JSON.stringify({
                error:
                  'setup_candidate_not_found',
              }),
              {
                status:
                  404,

                headers: {
                  'content-type':
                    'application/json',
                },
              },
            ),
      });

    assert.equal(
      candidate,
      null,
    );

    assert.equal(
      buildSetupRuntimeCandidatesUrl(),
      '/api/v1/setups/candidates?limit=100',
    );

    assert.equal(
      buildSetupRuntimeCandidateUrl({
        candidateId:
          createCandidate().id,
      }),
      '/api/v1/setups/candidates/'
        + createCandidate().id,
    );
  },
);


test(
  'builds a symbol-filtered runtime candidates URL',
  () => {
    assert.equal(
      buildSetupRuntimeCandidatesUrl({
        baseUrl:
          'http://localhost:4100/',

        limit:
          100,

        symbol:
          'bank/usdt',
      }),
      'http://localhost:4100/api/v1/setups/candidates?limit=100&symbol=BANKUSDT',
    );
  },
);

test(
  'selects the most advanced eligible runtime candidate',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const now =
      Date.parse(
        '2026-07-26T16:00:00.000Z',
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-invalidated',
            stage:
              'invalidated',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.01,
          },
          {
            ...base,
            id:
              'setup-approaching',
            stage:
              'approaching',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.1,
          },
          {
            ...base,
            id:
              'setup-confirmation',
            stage:
              'confirmation',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.3,
          },
          {
            ...base,
            id:
              'setup-completed-rejection',
            stage:
              'bounce',
            runtimeOutcome:
              'rejection',
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.001,
          },
        ],
        now,
      );

    assert.equal(
      selected?.id,
      'setup-confirmation',
    );
  },
);

test(
  'uses distance to choose between equal runtime stages',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const now =
      Date.parse(
        '2026-07-26T16:00:00.000Z',
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-far',
            stage:
              'confirmation',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.8,
          },
          {
            ...base,
            id:
              'setup-near',
            stage:
              'confirmation',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.2,
          },
        ],
        now,
      );

    assert.equal(
      selected?.id,
      'setup-near',
    );
  },
);

test(
  'ignores completed and expired candidates when selecting a live setup',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const now =
      Date.parse(
        '2026-07-26T16:00:00.000Z',
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-completed-rejection',
            stage:
              'bounce',
            runtimeOutcome:
              'rejection',
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.01,
          },
          {
            ...base,
            id:
              'setup-expired-confirmation',
            stage:
              'confirmation',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T15:59:59.999Z',
            distanceToLevelPct:
              0.02,
          },
          {
            ...base,
            id:
              'setup-active-watching',
            stage:
              'watching',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            distanceToLevelPct:
              0.4,
          },
        ],
        now,
      );

    assert.equal(
      selected?.id,
      'setup-active-watching',
    );
  },
);

test(
  'returns the newest unexpired terminal candidate when no active setup exists',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const now =
      Date.parse(
        '2026-07-26T16:00:00.000Z',
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-old-breakout',
            stage:
              'breakout',
            runtimeOutcome:
              'breakout',
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            updatedAt:
              '2026-07-26T15:45:00.000Z',
            distanceToLevelPct:
              0.1,
          },
          {
            ...base,
            id:
              'setup-new-breakout',
            stage:
              'breakout',
            runtimeOutcome:
              'breakout',
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            updatedAt:
              '2026-07-26T15:55:00.000Z',
            distanceToLevelPct:
              0.4,
          },
          {
            ...base,
            id:
              'setup-expired-rejection',
            stage:
              'bounce',
            runtimeOutcome:
              'rejection',
            runtimeExpiresAt:
              '2026-07-26T15:59:59.999Z',
            updatedAt:
              '2026-07-26T15:59:00.000Z',
            distanceToLevelPct:
              0.01,
          },
        ],
        now,
      );

    assert.equal(
      selected?.id,
      'setup-new-breakout',
    );
  },
);



test(
  'prefers an active setup over an unexpired terminal result',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const now =
      Date.parse(
        '2026-07-26T16:00:00.000Z',
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-recent-breakout',
            stage:
              'breakout',
            runtimeOutcome:
              'breakout',
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            updatedAt:
              '2026-07-26T15:59:00.000Z',
            distanceToLevelPct:
              0.01,
          },
          {
            ...base,
            id:
              'setup-active-approach',
            stage:
              'approaching',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
            updatedAt:
              '2026-07-26T15:50:00.000Z',
            distanceToLevelPct:
              0.5,
          },
        ],
        now,
      );

    assert.equal(
      selected?.id,
      'setup-active-approach',
    );
  },
);

test(
  'returns null when all runtime candidates are expired',
  () => {
    const base =
      mapSetupRuntimeCandidate(
        parseSetupRuntimeCandidate(
          createCandidate(),
        ),
      );

    const selected =
      selectPreferredSetupRuntimeCandidate(
        [
          {
            ...base,
            id:
              'setup-expired-breakout',
            stage:
              'breakout',
            runtimeOutcome:
              'breakout',
            runtimeExpiresAt:
              '2026-07-26T15:59:59.999Z',
          },
          {
            ...base,
            id:
              'setup-invalidated',
            stage:
              'invalidated',
            runtimeOutcome:
              null,
            runtimeExpiresAt:
              '2026-07-26T18:00:00.000Z',
          },
        ],
        Date.parse(
          '2026-07-26T16:00:00.000Z',
        ),
      );

    assert.equal(
      selected,
      null,
    );
  },
);
