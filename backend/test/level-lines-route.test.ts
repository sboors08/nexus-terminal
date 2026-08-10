import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  createCandles,
  marketSymbols,
} from '../src/modules/api-contract/fixtures.js';
import type {
  MarketDataProvider,
} from '../src/modules/market-data/market-data.provider.js';

const testEnv:
AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

test(
  'serves a causal Level Lines snapshot from the market data provider',
  async (t) => {
    let received:
      readonly [
        string,
        string,
        number | undefined,
      ] | null = null;

    const provider:
    MarketDataProvider = {
      getMarketSymbols:
        async () =>
          marketSymbols,
      getCandles:
        async (
          symbol,
          timeframe,
          options,
        ) => {
          received = [
            symbol,
            timeframe,
            options?.limit,
          ];

          return createCandles(
            symbol,
            timeframe,
          );
        },
    };
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider:
          provider,
      });

    t.after(
      async () =>
        app.close(),
    );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/level-engine/lines'
          + '?symbol=solusdt'
          + '&timeframe=5m'
          + '&limit=500',
      });
    const payload =
      response.json();

    assert.equal(
      response.statusCode,
      200,
    );
    assert.deepEqual(
      received,
      [
        'SOLUSDT',
        '5m',
        500,
      ],
    );
    assert.equal(
      payload.version,
      'level-lines-v0.1',
    );
    assert.equal(
      payload.symbol,
      'SOLUSDT',
    );
    assert.equal(
      payload.timeframe,
      '5m',
    );
    assert.equal(
      payload.mergesNearbyExtrema,
      false,
    );
    assert.equal(
      payload.usesFutureCandles,
      false,
    );
    assert.equal(
      payload
        .departureExtremumTracking
        .version,
      'departure-extremum-tracker-v0.1',
    );
    assert.equal(
      payload
        .departureExtremumTracking
        .computesObservationProgress,
      false,
    );
    assert.equal(
      payload
        .departureExtremumTracking
        .createsSignal,
      false,
    );
    assert.equal(
      payload
        .observationTracking
        .version,
      'observation-tracker-v0.1',
    );
    assert.equal(
      payload
        .observationTracking
        .appliedOptions
        .observationPathProgressThreshold,
      0.5,
    );
    assert.equal(
      payload
        .observationTracking
        .computesObservationProgress,
      true,
    );
    assert.equal(
      payload
        .observationTracking
        .createsApproachEvaluation,
      false,
    );
    assert.equal(
      payload
        .observationTracking
        .createsSetup,
      false,
    );
    assert.equal(
      payload
        .observationTracking
        .createsSignal,
      false,
    );
    assert.equal(
      payload
        .approachEvaluation
        .version,
      'approach-engine-v0.1',
    );
    assert.equal(
      payload
        .approachEvaluation
        .appliedOptions
        .maxDistanceToLevelPercent,
      0.5,
    );
    assert.equal(
      payload
        .approachEvaluation
        .evaluatesApproach,
      true,
    );
    assert.equal(
      payload
        .approachEvaluation
        .createsRealtimeConfirmation,
      false,
    );
    assert.equal(
      payload
        .approachEvaluation
        .createsSetup,
      false,
    );
    assert.equal(
      payload
        .approachEvaluation
        .createsSignal,
      false,
    );
    assert.equal(
      payload.candles.every(
        (candle: {
          isClosed?: unknown;
        }) =>
          typeof candle.isClosed
          === 'boolean',
      ),
      true,
    );
  },
);

test(
  'rejects unsupported Level Lines query values',
  async (t) => {
    const provider:
    MarketDataProvider = {
      getMarketSymbols:
        async () =>
          marketSymbols,
      getCandles:
        async (
          symbol,
          timeframe,
        ) =>
          createCandles(
            symbol,
            timeframe,
          ),
    };
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider:
          provider,
      });

    t.after(
      async () =>
        app.close(),
    );

    const timeframeResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/level-engine/lines'
          + '?symbol=BTCUSDT'
          + '&timeframe=30m',
      });
    const limitResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/level-engine/lines'
          + '?symbol=BTCUSDT'
          + '&timeframe=5m'
          + '&limit=10',
      });

    assert.equal(
      timeframeResponse.statusCode,
      400,
    );
    assert.equal(
      timeframeResponse.json().error,
      'invalid_timeframe',
    );
    assert.equal(
      limitResponse.statusCode,
      400,
    );
    assert.equal(
      limitResponse.json().error,
      'invalid_limit',
    );
  },
);
