import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLevelV2ShadowBreakClassificationUrl,
  buildLevelV2ShadowConfirmationCandidateUrl,
  buildLevelV2ShadowSetupOutcomeUrl,
  fetchLevelV2ShadowInspection,
} from '../node_modules/.tmp/realtime-test/api/runtime/levelV2ShadowInspectionApi.js';

function createBreakResponse() {
  return {
    items: [
      {
        symbol: 'SOLUSDT',
        timeframe: '1m',
        generatedAt: '2026-08-03T18:00:00.000Z',
        state: {
          id: 'classifier-sol-resistance-1',
          level: {
            id: 'level-sol-resistance-1',
          },
          currentKind: 'resistance',
          status: 'breakout_confirmed',
          maxPenetrationDepthPct: 0.42,
          acceptanceClosesCount: 2,
          breakoutConfirmedAt: '2026-08-03T17:59:00.000Z',
          falseBreakoutAt: null,
          lastProcessedCloseTime: '2026-08-03T18:00:00.000Z',
        },
      },
    ],
  };
}

function createCandidateResponse() {
  return {
    items: [
      {
        id: 'candidate-sol-resistance-1',
        classifierId: 'classifier-sol-resistance-1',
        levelId: 'level-sol-resistance-1',
        capturedAt: '2026-08-03T18:00:01.000Z',
        priceAcceptance: true,
        behavior: 'directional_continuation',
        behaviorConfidence: 'high',
        postEventReaction: 'continuation',
        verdict: 'supported',
        confidence: 'high',
        reasons: [
          'Price accepted beyond the level.',
          'Tape and price continued in the expected direction.',
        ],
        evidence: {
          latestAvailability: 'complete',
          marketEvidenceEntriesCount: 8,
          usableTapeEntriesCount: 8,
          completeEntriesCount: 6,
          netPriceChangePct: 0.31,
          latestOrderBookImbalancePct: 12.5,
        },
      },
    ],
  };
}

function createOutcomeResponse() {
  return {
    items: [
      {
        id: 'outcome-sol-resistance-1',
        classifierId: 'classifier-sol-resistance-1',
        levelId: 'level-sol-resistance-1',
        startedAt: '2026-08-03T18:00:01.000Z',
        entryPrice: 185.5,
        latestPrice: 186.4,
        observedPricesCount: 6,
        durationMs: 45_000,
        maxFavorableExcursionPct: 0.62,
        maxAdverseExcursionPct: 0.08,
        continuationReached: true,
        returnedInsideLevel: false,
        failureConditionReached: false,
        status: 'successful_continuation',
        timeToOutcomeMs: 31_000,
        reasons: [
          'Continuation threshold reached.',
        ],
      },
    ],
  };
}

test(
  'builds Level v2 shadow inspection URLs',
  () => {
    assert.equal(
      buildLevelV2ShadowBreakClassificationUrl({
        baseUrl: 'http://localhost:4100/',
        symbol: 'sol/usdt',
        levelId: 'level-sol-resistance-1',
      }),
      'http://localhost:4100/api/v1/setups/levels-v2/shadow/break-classifications'
        + '?symbol=SOLUSDT'
        + '&levelId=level-sol-resistance-1'
        + '&limit=1',
    );

    assert.equal(
      buildLevelV2ShadowConfirmationCandidateUrl({
        symbol: 'SOLUSDT',
        classifierId: 'classifier-sol-resistance-1',
      }),
      '/api/v1/setups/levels-v2/shadow/confirmation-candidates'
        + '?symbol=SOLUSDT'
        + '&classifierId=classifier-sol-resistance-1'
        + '&limit=1',
    );

    assert.equal(
      buildLevelV2ShadowSetupOutcomeUrl({
        symbol: 'SOLUSDT',
        classifierId: 'classifier-sol-resistance-1',
      }),
      '/api/v1/setups/levels-v2/shadow/setup-outcomes'
        + '?symbol=SOLUSDT'
        + '&classifierId=classifier-sol-resistance-1'
        + '&limit=1',
    );
  },
);

test(
  'reads the selected Level v2 shadow pipeline',
  async () => {
    const requestedUrls = [];

    const inspection =
      await fetchLevelV2ShadowInspection({
        symbol: 'SOLUSDT',
        levelId: 'level-sol-resistance-1',
        fetcher: async (input, init) => {
          const url = String(input);
          requestedUrls.push(url);

          assert.equal(init?.method, 'GET');
          assert.equal(
            new Headers(init?.headers).get('accept'),
            'application/json',
          );

          const payload = url.includes('break-classifications')
            ? createBreakResponse()
            : url.includes('confirmation-candidates')
              ? createCandidateResponse()
              : createOutcomeResponse();

          return new Response(
            JSON.stringify(payload),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            },
          );
        },
      });

    assert.equal(requestedUrls.length, 3);
    assert.equal(
      inspection?.breakClassification.status,
      'breakout_confirmed',
    );
    assert.equal(
      inspection?.confirmationCandidate?.verdict,
      'supported',
    );
    assert.equal(
      inspection?.outcome?.status,
      'successful_continuation',
    );
    assert.equal(
      inspection?.outcome?.maxFavorableExcursionPct,
      0.62,
    );
    assert.equal(
      inspection?.observationalOnly,
      true,
    );
  },
);

test(
  'returns null before a break classifier exists',
  async () => {
    let requests = 0;

    const inspection =
      await fetchLevelV2ShadowInspection({
        symbol: 'SOLUSDT',
        levelId: 'level-sol-resistance-1',
        fetcher: async () => {
          requests += 1;

          return new Response(
            JSON.stringify({
              items: [],
            }),
            {
              status: 200,
              headers: {
                'content-type': 'application/json',
              },
            },
          );
        },
      });

    assert.equal(inspection, null);
    assert.equal(requests, 1);
  },
);

test(
  'rejects mismatched downstream context',
  async () => {
    await assert.rejects(
      fetchLevelV2ShadowInspection({
        symbol: 'SOLUSDT',
        levelId: 'level-sol-resistance-1',
        fetcher: async (input) => {
          const url = String(input);

          if (url.includes('break-classifications')) {
            return new Response(
              JSON.stringify(createBreakResponse()),
              { status: 200 },
            );
          }

          if (url.includes('confirmation-candidates')) {
            const payload = createCandidateResponse();
            payload.items[0].classifierId = 'wrong-classifier';

            return new Response(
              JSON.stringify(payload),
              { status: 200 },
            );
          }

          return new Response(
            JSON.stringify(createOutcomeResponse()),
            { status: 200 },
          );
        },
      }),
      /candidate mismatch/u,
    );
  },
);


test(
  'rejects a mismatched downstream level',
  async () => {
    await assert.rejects(
      fetchLevelV2ShadowInspection({
        symbol: 'SOLUSDT',
        levelId: 'level-sol-resistance-1',
        fetcher: async (input) => {
          const url = String(input);

          if (url.includes('break-classifications')) {
            return new Response(
              JSON.stringify(createBreakResponse()),
              { status: 200 },
            );
          }

          if (url.includes('confirmation-candidates')) {
            const payload = createCandidateResponse();
            payload.items[0].levelId = 'wrong-level';

            return new Response(
              JSON.stringify(payload),
              { status: 200 },
            );
          }

          return new Response(
            JSON.stringify(createOutcomeResponse()),
            { status: 200 },
          );
        },
      }),
      /candidate mismatch/u,
    );
  },
);
