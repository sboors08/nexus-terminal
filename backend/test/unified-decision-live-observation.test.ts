import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import {
  join,
} from 'node:path';
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
import {
  JsonFileUnifiedDecisionLiveObservationPersistence,
  UnifiedDecisionLiveObservationService,
} from '../src/modules/decision-engine/unified-decision-live-observation.js';
import type {
  UnifiedDecisionLiveObservationInput,
  UnifiedDecisionLiveObservationPersistence,
  UnifiedDecisionLiveObservationRecorder,
} from '../src/modules/decision-engine/unified-decision-live-observation.types.js';
import type {
  UnifiedDecisionState,
} from '../src/modules/decision-engine/unified-decision.types.js';

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

function makeInput(
  state: UnifiedDecisionState =
    'possible_long',
): UnifiedDecisionLiveObservationInput {
  const direction =
    state === 'possible_short'
      ? 'short' as const
      : state === 'possible_long'
        ? 'long' as const
        : null;

  return {
    symbol: 'BTCUSDT',
    timeframe: '1m',
    decision: {
      version: 'unified-decision-v0.1',
      symbol: 'BTCUSDT',
      timeframe: '1m',
      generatedAt:
        '2026-08-13T18:00:03.000Z',
      state,
      direction,
      scenario:
        direction ? 'bounce' : null,
      causalStage:
        direction ? 'CONFIRMATION' : 'LEVEL',
      level: {
        lineId: 'level:btc:1',
        kind: 'support',
        status: 'confirmed',
        levelPrice: 100,
        currentPrice: 100.1,
        distanceToLevelPercent: 0.1,
        observationProgress: 1,
        causalStage: 'CONFIRMATION',
        realtimeStatus: 'confirmed',
        tapeState: 'supports',
        orderBookState: 'supports',
      },
      setup: null,
      marketContext: {
        btc: {
          availability: 'ready',
          mode: 'risk_on',
          observedAt:
            '2026-08-13T18:00:01.000Z',
          alignment:
            direction ? 'aligned' : 'neutral',
        },
        impulse: {
          availability: 'ready',
          direction: 'long',
          observedAt:
            '2026-08-13T18:00:02.000Z',
          alignment:
            direction ? 'aligned' : 'neutral',
        },
      },
      reasons: [
        'level_confirmed',
      ],
      missingConfirmations: [],
      invalidations: [
        'source_freshness_lost',
      ],
      decisionSupportOnly: true,
      createsTradeOrder: false,
      createsSetup: false,
      createsSignal: false,
      createsScore: false,
      estimatesProfitability: false,
      changesExistingLifecycle: false,
      usesFutureData: false,
    },
    realtime: {
      capturedAt:
        '2026-08-13T18:00:03.000Z',
      tape: {
        snapshotUpdatedAt:
          '2026-08-13T18:00:03.000Z',
        trades: [
          makeTrade('1', '18:00:01'),
          makeTrade('2', '18:00:02'),
          makeTrade('3', '18:00:03'),
        ],
      },
      orderBook: {
        state: 'live',
        synchronized: true,
        updatedAt:
          '2026-08-13T18:00:03.000Z',
        ageMs: 0,
        staleAfterMs: 5_000,
        bestBid: 100,
        bestAsk: 100.1,
        spreadPct: 0.1,
        bidDepthQuote: 80_000,
        askDepthQuote: 20_000,
        totalDepthQuote: 100_000,
        imbalancePct: 60,
      },
      sourceErrors: [
        'tape: secret upstream text',
        'order_book: another secret',
      ],
      evaluatedEvidence: {
        symbol: 'BTCUSDT',
        capturedAt:
          '2026-08-13T18:00:03.000Z',
        availability: 'complete',
        tape: {
          state: 'live',
          snapshotUpdatedAt:
            '2026-08-13T18:00:03.000Z',
          lastTradeAt:
            '2026-08-13T18:00:03.000Z',
          ageMs: 0,
          windowMs: 60_000,
          tradesCount: 3,
          ignoredFutureTradesCount: 0,
          ignoredOutsideWindowTradesCount: 0,
          executionsCount: 3,
          buyQuoteValue: 2_000,
          sellQuoteValue: 1_000,
          totalQuoteValue: 3_000,
          quoteDelta: 1_000,
          pressurePct: 33.333333,
        },
        orderBook: {
          state: 'live',
          synchronized: true,
          updatedAt:
            '2026-08-13T18:00:03.000Z',
          updatedAfterCapture: false,
          ageMs: 0,
          staleAfterMs: 5_000,
          bestBid: 100,
          bestAsk: 100.1,
          spreadPct: 0.1,
          bidDepthQuote: 80_000,
          askDepthQuote: 20_000,
          totalDepthQuote: 100_000,
          imbalancePct: 60,
        },
        sourceErrors: [
          'tape: secret evaluated text',
        ],
      },
      evaluations: [],
    },
    setups: {
      readState: 'available',
      candidates: [
        makeSetup('setup:1', '18:00:01'),
        makeSetup('setup:2', '18:00:02'),
      ],
    },
    marketContext: {
      readState: 'available',
      value: {
        btc: {
          availability: 'ready',
          mode: 'risk_on',
          observedAt:
            '2026-08-13T18:00:01.000Z',
        },
        impulse: {
          availability: 'ready',
          direction: 'long',
          observedAt:
            '2026-08-13T18:00:02.000Z',
        },
      },
    },
  };
}

function makeTrade(
  id: string,
  time: string,
) {
  return {
    id,
    symbol: 'BTCUSDT',
    timestamp:
      `2026-08-13T${time}.000Z`,
    price: 100,
    quantity: 1,
    quoteValue: 100,
    side: 'buy' as const,
    isBuyerMaker: false,
  };
}

function makeSetup(
  id: string,
  time: string,
) {
  return {
    id,
    symbol: 'BTCUSDT',
    timeframe: '1m',
    setupType: 'level_bounce' as const,
    direction: 'long' as const,
    stage: 'THIRD_TOUCH_CONFIRMED' as const,
    outcome: null,
    level: {
      kind: 'support' as const,
      centerPrice: 100,
      zoneLow: 99.9,
      zoneHigh: 100.1,
      touches: 3,
      confirmedAt:
        '2026-08-13T17:59:00.000Z',
    },
    currentPrice: 100.1,
    distanceToLevelPct: 0.1,
    createdAt:
      '2026-08-13T17:59:00.000Z',
    updatedAt:
      `2026-08-13T${time}.000Z`,
    expiresAt:
      '2026-08-13T18:10:00.000Z',
  };
}

test(
  'isolates diagnostic subscribers from the live recorder response',
  async () => {
    const service =
      new UnifiedDecisionLiveObservationService();
    await service.start();
    let received = 0;
    service.subscribe(() => {
      throw new Error('diagnostic consumer failed');
    });
    const unsubscribe = service.subscribe(() => {
      received += 1;
    });
    const recorded = service.record(makeInput());
    assert.equal(recorded.sequence, 1);
    assert.equal(received, 1);
    unsubscribe();
    service.record(makeInput());
    assert.equal(received, 1);
  },
);

test(
  'captures bounded live source evidence and removes raw source errors',
  async () => {
    const service =
      new UnifiedDecisionLiveObservationService({
        maxTradesPerObservation: 2,
        maxSetupsPerObservation: 1,
        now: () =>
          new Date(
            '2026-08-13T18:00:04.000Z',
          ),
      });
    await service.start();

    const observation =
      service.record(makeInput());

    assert.equal(
      observation.realtime.tape
        ?.originalTradesCount,
      3,
    );
    assert.deepEqual(
      observation.realtime.tape
        ?.trades.map((trade) => trade.id),
      ['2', '3'],
    );
    assert.equal(
      observation.realtime.tape
        ?.truncated,
      true,
    );
    assert.deepEqual(
      observation.realtime.sourceErrors,
      [
        'tape_read_failed',
        'order_book_read_failed',
      ],
    );
    assert.equal(
      JSON.stringify(observation)
        .includes('secret'),
      false,
    );
    assert.equal(
      observation.setups.observedAt,
      '2026-08-13T18:00:02.000Z',
    );
    assert.equal(
      observation.setups.candidates.length,
      1,
    );
    assert.equal(
      observation.setups.truncated,
      true,
    );
    assert.equal(
      observation.marketContext.value
        .btc.observedAt,
      '2026-08-13T18:00:01.000Z',
    );
    assert.equal(
      observation.createsTradeOrder,
      false,
    );

    const returnedReasons = (
      observation.decision.reasons
    ) as unknown as string[];
    returnedReasons.push('mutated');

    assert.deepEqual(
      service.getObservations()[0]
        ?.decision.reasons,
      ['level_confirmed'],
    );
  },
);

test(
  'bounds retention and filters newest observations',
  async () => {
    let tick = 0;
    const service =
      new UnifiedDecisionLiveObservationService({
        capacity: 2,
        now: () =>
          new Date(
            1_723_572_000_000
            + tick++ * 1_000,
          ),
      });
    await service.start();

    service.record(makeInput('observe'));
    service.record(makeInput('possible_short'));
    service.record(makeInput('possible_long'));

    assert.equal(
      service.getStatus().observationCount,
      2,
    );
    assert.deepEqual(
      service.getObservations()
        .map((item) => item.sequence),
      [3, 2],
    );
    assert.deepEqual(
      service.getObservations({
        direction: 'short',
      }).map(
        (item) => item.decision.state,
      ),
      ['possible_short'],
    );
  },
);

test(
  'persists atomically and continues sequence after restart',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-udlo-',
        ),
      );
    const filePath =
      join(directory, 'dataset.json');
    t.after(
      async () => {
        await rm(
          directory,
          { recursive: true },
        );
      },
    );
    const persistence =
      new JsonFileUnifiedDecisionLiveObservationPersistence({
        filePath,
      });
    const first =
      new UnifiedDecisionLiveObservationService({
        persistence,
      });
    await first.start();
    first.record(makeInput());
    await first.stop();

    const persisted =
      JSON.parse(
        await readFile(filePath, 'utf8'),
      );
    assert.equal(
      persisted.schema,
      'nexus.unified-decision.live-observations',
    );
    assert.equal(persisted.version, 1);
    assert.equal(
      persisted.observations.length,
      1,
    );

    const restarted =
      new UnifiedDecisionLiveObservationService({
        persistence,
      });
    await restarted.start();
    const observation =
      restarted.record(makeInput());
    assert.equal(observation.sequence, 2);
    assert.equal(
      restarted.getStatus().observationCount,
      2,
    );
    await restarted.stop();
  },
);

test(
  'enters degraded memory mode without overwriting corrupt or unsupported storage',
  async (t) => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-udlo-corrupt-',
        ),
      );
    const filePath =
      join(directory, 'dataset.json');
    t.after(
      async () => {
        await rm(
          directory,
          { recursive: true },
        );
      },
    );
    await writeFile(
      filePath,
      '{broken',
      'utf8',
    );
    const service =
      new UnifiedDecisionLiveObservationService({
        persistence:
          new JsonFileUnifiedDecisionLiveObservationPersistence({
            filePath,
          }),
      });

    await service.start();
    service.record(makeInput());
    await service.flush();

    assert.equal(
      service.getStatus().state,
      'degraded',
    );
    assert.equal(
      service.getStatus()
        .lastPersistenceErrorCode,
      'live_observation_persistence_corrupt',
    );
    assert.equal(
      await readFile(filePath, 'utf8'),
      '{broken',
    );
    assert.equal(
      service.getStatus().observationCount,
      1,
    );

    const unsupportedContents =
      JSON.stringify({
        schema:
          'nexus.unified-decision.live-observations',
        version: 99,
        datasetVersion:
          'unified-decision-live-observation-dataset-v0.1',
        savedAt:
          '2026-08-13T18:00:00.000Z',
        nextSequence: 1,
        observations: [],
      });
    await writeFile(
      filePath,
      unsupportedContents,
      'utf8',
    );
    const unsupportedService =
      new UnifiedDecisionLiveObservationService({
        persistence:
          new JsonFileUnifiedDecisionLiveObservationPersistence({
            filePath,
          }),
      });
    await unsupportedService.start();
    unsupportedService.record(makeInput());
    await unsupportedService.flush();

    assert.equal(
      unsupportedService.getStatus()
        .lastPersistenceErrorCode,
      'live_observation_persistence_unsupported_version',
    );
    assert.equal(
      await readFile(filePath, 'utf8'),
      unsupportedContents,
    );
  },
);

test(
  'degrades after a write failure while retaining the observation',
  async () => {
    const persistence:
    UnifiedDecisionLiveObservationPersistence = {
      adapter: 'failing',
      load: async () => null,
      save: async () => {
        throw new Error('disk unavailable');
      },
    };
    const service =
      new UnifiedDecisionLiveObservationService({
        persistence,
      });

    await service.start();
    service.record(makeInput());
    await service.flush();

    assert.equal(
      service.getStatus().state,
      'degraded',
    );
    assert.equal(
      service.getStatus().observationCount,
      1,
    );
    assert.equal(
      service.getStatus()
        .lastPersistenceErrorCode,
      'live_observation_persistence_failed',
    );
  },
);

test(
  'records the existing Level Lines runtime snapshots and exposes diagnostics',
  async (t) => {
    const provider:
    MarketDataProvider = {
      getMarketSymbols:
        async () => marketSymbols,
      getCandles:
        async (symbol, timeframe) =>
          createCandles(symbol, timeframe),
    };
    const recorder =
      new UnifiedDecisionLiveObservationService();
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider: provider,
        unifiedDecisionLiveObservationRecorder:
          recorder,
        unifiedDecisionMarketContextReader: {
          getMarketContext:
            () => ({
              btc: {
                availability: 'ready',
                mode: 'risk_on',
                observedAt:
                  '2026-08-13T18:00:00.000Z',
              },
              impulse: {
                availability: 'ready',
                direction: 'long',
                observedAt:
                  '2026-08-13T18:00:01.000Z',
              },
            }),
        },
      });
    t.after(async () => app.close());

    const levelResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/level-engine/lines'
          + '?symbol=BTCUSDT'
          + '&timeframe=1m'
          + '&limit=500',
      });
    assert.equal(levelResponse.statusCode, 200);

    const statusResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/decision-engine'
          + '/live-observations/status',
      });
    assert.equal(statusResponse.statusCode, 200);
    assert.equal(
      statusResponse.json().observationCount,
      1,
    );

    const exportResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/decision-engine'
          + '/live-observations/export'
          + '?symbol=btcusdt&timeframe=1m',
      });
    const payload =
      exportResponse.json();
    assert.equal(exportResponse.statusCode, 200);
    assert.equal(
      payload.version,
      'unified-decision-live-observation-dataset-v0.1',
    );
    assert.equal(payload.observations.length, 1);
    assert.equal(
      payload.observations[0]
        .marketContext.readState,
      'available',
    );
    assert.equal(
      payload.observations[0]
        .setups.readState,
      'unavailable',
    );
  },
);

test(
  'does not fail Level Lines when observation recording fails',
  async (t) => {
    const provider:
    MarketDataProvider = {
      getMarketSymbols:
        async () => marketSymbols,
      getCandles:
        async (symbol, timeframe) =>
          createCandles(symbol, timeframe),
    };
    const failingRecorder:
    UnifiedDecisionLiveObservationRecorder = {
      start: async () => {},
      stop: async () => {},
      flush: async () => {},
      record: () => {
        throw new Error('recorder failed');
      },
      getStatus: () => ({
        version:
          'unified-decision-live-observation-dataset-v0.1',
        state: 'degraded',
        persistenceMode: 'runtime_only',
        persistenceAdapter: null,
        capacity: 1,
        observationCount: 0,
        firstRecordedAt: null,
        lastRecordedAt: null,
        nextSequence: 1,
        lastPersistenceErrorCode:
          'test_failure',
        diagnosticOnly: true,
        createsTradeOrder: false,
        changesDecisionRules: false,
      }),
      getObservations: () => [],
      exportDataset: () => ({
        version:
          'unified-decision-live-observation-dataset-v0.1',
        exportedAt:
          '2026-08-13T18:00:00.000Z',
        status:
          failingRecorder.getStatus(),
        observations: [],
      }),
    };
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider: provider,
        unifiedDecisionLiveObservationRecorder:
          failingRecorder,
      });
    t.after(async () => app.close());

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/level-engine/lines'
          + '?symbol=BTCUSDT'
          + '&timeframe=1m'
          + '&limit=500',
      });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.json().unifiedDecision
        .createsTradeOrder,
      false,
    );
  },
);

test(
  'validates diagnostic filters and reports an unavailable recorder',
  async (t) => {
    const provider:
    MarketDataProvider = {
      getMarketSymbols:
        async () => marketSymbols,
      getCandles:
        async (symbol, timeframe) =>
          createCandles(symbol, timeframe),
    };
    const app =
      await buildApp({
        env: testEnv,
        marketDataProvider: provider,
        unifiedDecisionLiveObservationRecorder:
          null,
      });
    t.after(async () => app.close());

    const invalid =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/decision-engine'
          + '/live-observations?limit=501',
      });
    assert.equal(invalid.statusCode, 400);
    assert.equal(
      invalid.json().error,
      'invalid_limit',
    );

    const unavailable =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/decision-engine'
          + '/live-observations/status',
      });
    assert.equal(unavailable.statusCode, 503);
    assert.equal(
      unavailable.json().error,
      'unified_decision_live_observation_unavailable',
    );
  },
);
