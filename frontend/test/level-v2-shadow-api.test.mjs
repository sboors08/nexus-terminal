import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLevelV2ShadowSnapshotsUrl,
  fetchLevelV2ShadowSnapshots,
  parseLevelV2ShadowSnapshotListResponse,
} from '../node_modules/.tmp/realtime-test/api/runtime/levelV2ShadowApi.js';

function createLevel() {
  return {
    id:
      'level-v2-sol-support-1',
    level: {
      id:
        'level-v2-sol-support-1',
      version:
        2,
      symbol:
        'SOLUSDT',
      timeframe:
        '1m',
      kind:
        'support',
      zone: {
        referencePrice:
          185.5,
        coreLow:
          185.42,
        coreHigh:
          185.58,
        outerLow:
          185.35,
        outerHigh:
          185.65,
        liquidityLow:
          185.25,
        liquidityHigh:
          185.75,
        widthPct:
          0.1617,
        widthAtr:
          0.82,
      },
      touchesCount:
        3,
      firstTouchAt:
        '2026-07-30T16:00:00.000Z',
      lastTouchAt:
        '2026-07-30T16:20:00.000Z',
      firstTouchCandleIndex:
        100,
      lastTouchCandleIndex:
        120,
      score: {
        total:
          78.4,
        touches:
          82,
        reactions:
          75,
        cleanliness:
          80,
        spacing:
          76,
        freshness:
          84,
        precision:
          79,
        structureEdge:
          73,
      },
    },
    originalKind:
      'support',
    currentKind:
      'support',
    status:
      'active',
    qualifiedTouchesCount:
      3,
    eligibleForSetups:
      true,
    registeredAt:
      '2026-07-30T16:00:00.000Z',
    testingStartedAt:
      null,
    brokenAt:
      null,
    breakConfirmedAt:
      null,
    retestStartedAt:
      null,
    flippedAt:
      null,
    expiredAt:
      null,
    lastProcessedCloseTime:
      '2026-07-30T16:25:00.000Z',
  };
}

function createResponse() {
  return {
    items: [
      {
        symbol:
          'SOLUSDT',
        timeframe:
          '1m',
        generatedAt:
          '2026-07-30T16:25:01.000Z',
        sourceCandlesCount:
          500,
        closedCandlesCount:
          499,
        detectedZonesCount:
          4,
        rejectedZonesCount:
          2,
        levels: [
          createLevel(),
        ],
      },
    ],
    count:
      1,
    totalSnapshots:
      513,
    filters: {
      symbol:
        null,
      kind:
        null,
      status:
        null,
      eligibleForSetups:
        true,
      minScore:
        65,
      limit:
        250,
    },
  };
}

test(
  'builds the Level v2 shadow snapshots URL',
  () => {
    assert.equal(
      buildLevelV2ShadowSnapshotsUrl({
        baseUrl:
          'http://localhost:4100/',
        symbol:
          'sol/usdt',
        kind:
          'support',
        status:
          'active',
        eligibleForSetups:
          true,
        minScore:
          65,
        limit:
          250,
      }),
      'http://localhost:4100/api/v1/setups/levels-v2/shadow/snapshots'
        + '?limit=250'
        + '&symbol=SOLUSDT'
        + '&kind=support'
        + '&status=active'
        + '&eligibleForSetups=true'
        + '&minScore=65',
    );
  },
);

test(
  'fetches and validates Level v2 shadow snapshots',
  async () => {
    let requestedUrl =
      '';

    const response =
      await fetchLevelV2ShadowSnapshots({
        baseUrl:
          'http://localhost:4100/',
        eligibleForSetups:
          true,
        minScore:
          65,
        limit:
          250,
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
              JSON.stringify(
                createResponse(),
              ),
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
      'http://localhost:4100/api/v1/setups/levels-v2/shadow/snapshots'
        + '?limit=250'
        + '&eligibleForSetups=true'
        + '&minScore=65',
    );

    assert.equal(
      response.items.length,
      1,
    );

    assert.equal(
      response.items[0].levels[0]
        .level.score.total,
      78.4,
    );

    assert.equal(
      response.items[0].levels[0]
        .eligibleForSetups,
      true,
    );
  },
);

test(
  'rejects an invalid Level v2 contract',
  () => {
    const payload =
      createResponse();

    payload.items[0]
      .levels[0]
      .level.version = 1;

    assert.throws(
      () =>
        parseLevelV2ShadowSnapshotListResponse(
          payload,
        ),
      /level version/u,
    );
  },
);
