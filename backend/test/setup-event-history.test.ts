import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import type {
  SetupDetectionRuntimeEventSource,
  SetupDetectionRuntimeLifecycle,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';
import type {
  SetupDirection,
  SetupEngineOutcome,
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import {
  setupEventHistoryRoutes,
} from '../src/modules/setup-engine/setup-event-history.routes.js';
import {
  SetupEventHistoryService,
} from '../src/modules/setup-engine/setup-event-history.service.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventListener,
  SetupLifecycleEventType,
} from '../src/modules/setup-engine/setup-lifecycle-events.types.js';

const testEnv:
AppEnv = {
  nodeEnv:
    'test',

  host:
    '127.0.0.1',

  port:
    4100,

  apiPrefix:
    '/api/v1',

  corsOrigins: [
    'http://localhost:5173',
  ],

  logLevel:
    'silent',
};

function createCandidate(
  input: {
    id: string;
    symbol?: string;
    direction?: SetupDirection;
    stage?: SetupEngineStage;
    outcome?: SetupEngineOutcome;
  },
): SetupEngineState {
  const stage =
    input.stage
    ?? 'LEVEL_CONFIRMED';

  const outcome =
    input.outcome
    ?? null;

  return {
    id:
      input.id,

    symbol:
      input.symbol
      ?? 'SOLUSDT',

    timeframe:
      '1m',

    setupType:
      'level_breakout',

    direction:
      input.direction
      ?? 'long',

    stage,
    outcome,

    level: {
      kind:
        'resistance',

      centerPrice:
        100,

      zoneLow:
        99.8,

      zoneHigh:
        100.2,

      touches:
        2,

      confirmedAt:
        '2026-07-26T12:05:00.000Z',
    },

    currentPrice:
      99,

    distanceToLevelPct:
      1,

    createdAt:
      '2026-07-26T12:05:00.000Z',

    updatedAt:
      '2026-07-26T12:06:00.000Z',

    expiresAt:
      '2026-07-26T13:05:00.000Z',
  };
}

function createEvent(
  input: {
    eventId: number;
    candidateId?: string;
    symbol?: string;
    type?: SetupLifecycleEventType;
    direction?: SetupDirection;
    previousStage?: SetupEngineStage | null;
    currentStage?: SetupEngineStage;
    outcome?: SetupEngineOutcome;
  },
): SetupLifecycleEvent {
  const candidateId =
    input.candidateId
    ?? `setup-${input.eventId}`;

  const currentStage =
    input.currentStage
    ?? 'LEVEL_CONFIRMED';

  const outcome =
    input.outcome
    ?? null;

  const candidate =
    createCandidate({
      id:
        candidateId,

      symbol:
        input.symbol,

      direction:
        input.direction,

      stage:
        currentStage,

      outcome,
    });

  return {
    eventId:
      input.eventId,

    type:
      input.type
      ?? 'candidate_created',

    occurredAt:
      `2026-07-26T12:0${input.eventId}:00.000Z`,

    candidateId,

    symbol:
      candidate.symbol,

    setupType:
      candidate.setupType,

    direction:
      candidate.direction,

    previousStage:
      input.previousStage
      ?? null,

    currentStage,

    outcome,

    candidate,
  };
}

class TestEventSource
implements SetupDetectionRuntimeEventSource {
  private readonly listeners =
    new Set<
      SetupLifecycleEventListener
    >();

  get listenerCount():
  number {
    return this.listeners.size;
  }

  subscribeLifecycleEvents(
    listener:
      SetupLifecycleEventListener,
  ): () => void {
    this.listeners.add(
      listener,
    );

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;

      this.listeners.delete(
        listener,
      );
    };
  }

  emit(
    event:
      SetupLifecycleEvent,
  ): void {
    for (
      const listener
      of this.listeners
    ) {
      listener(
        event,
      );
    }
  }
}

class TestRuntime
implements
  SetupDetectionRuntimeLifecycle,
  SetupDetectionRuntimeEventSource {
  starts = 0;
  stops = 0;

  private readonly source =
    new TestEventSource();

  start(): void {
    this.starts += 1;

    this.source.emit(
      createEvent({
        eventId:
          1,

        candidateId:
          'setup-startup',
      }),
    );
  }

  stop(): void {
    this.stops += 1;
  }

  subscribeLifecycleEvents(
    listener:
      SetupLifecycleEventListener,
  ): () => void {
    return this.source
      .subscribeLifecycleEvents(
        listener,
      );
  }
}

async function createRouteApp(
  history?:
    SetupEventHistoryService,
) {
  const app =
    Fastify({
      logger:
        false,
    });

  await app.register(
    setupEventHistoryRoutes,
    {
      prefix:
        '/api/v1',

      ...(
        history
          ? {
              setupEventHistoryReader:
                history,
            }
          : {}
      ),
    },
  );

  return app;
}

test(
  'stores lifecycle events and exposes newest events first',
  () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();

    source.emit(
      createEvent({
        eventId:
          1,
      }),
    );

    source.emit(
      createEvent({
        eventId:
          2,
      }),
    );

    assert.deepEqual(
      history
        .getEvents()
        .map(
          (event) =>
            event.eventId,
        ),
      [
        2,
        1,
      ],
    );

    assert.deepEqual(
      history.getStatus(),
      {
        state:
          'running',

        eventsCount:
          2,

        maxEvents:
          10,

        firstEventId:
          1,

        lastEventId:
          2,

        droppedEventsCount:
          0,
      },
    );

    history.stop();
  },
);

test(
  'applies all supported history filters',
  () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();

    source.emit(
      createEvent({
        eventId:
          1,

        candidateId:
          'setup-sol',

        symbol:
          'SOLUSDT',
      }),
    );

    source.emit(
      createEvent({
        eventId:
          2,

        candidateId:
          'setup-sol',

        symbol:
          'SOLUSDT',

        type:
          'breakout_confirmed',

        direction:
          'long',

        previousStage:
          'THIRD_TOUCH_CONFIRMED',

        currentStage:
          'BREAKOUT_CONFIRMED',

        outcome:
          'breakout',
      }),
    );

    source.emit(
      createEvent({
        eventId:
          3,

        candidateId:
          'setup-eth',

        symbol:
          'ETHUSDT',

        type:
          'rejection_confirmed',

        direction:
          'short',

        currentStage:
          'REJECTION_CONFIRMED',

        outcome:
          'rejection',
      }),
    );

    const events =
      history.getEvents({
        candidateId:
          'setup-sol',

        symbol:
          'SOLUSDT',

        type:
          'breakout_confirmed',

        direction:
          'long',

        currentStage:
          'BREAKOUT_CONFIRMED',

        outcome:
          'breakout',
      });

    assert.equal(
      events.length,
      1,
    );

    assert.equal(
      events[0]?.eventId,
      2,
    );

    assert.equal(
      history.getEvents({
        outcome:
          'pending',
      }).length,
      1,
    );

    history.stop();
  },
);

test(
  'enforces the bounded event buffer',
  () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            2,
        },
      );

    history.start();

    source.emit(
      createEvent({
        eventId:
          1,
      }),
    );

    source.emit(
      createEvent({
        eventId:
          2,
      }),
    );

    source.emit(
      createEvent({
        eventId:
          3,
      }),
    );

    assert.deepEqual(
      history
        .getEvents()
        .map(
          (event) =>
            event.eventId,
        ),
      [
        3,
        2,
      ],
    );

    assert.equal(
      history.getEvent(
        1,
      ),
      null,
    );

    assert.equal(
      history
        .getStatus()
        .droppedEventsCount,
      1,
    );

    history.stop();
  },
);

test(
  'returns defensive lifecycle event copies',
  () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();

    const sourceEvent =
      createEvent({
        eventId:
          1,
      });

    source.emit(
      sourceEvent,
    );

    sourceEvent
      .candidate
      .level
      .centerPrice =
        999;

    const firstRead =
      history.getEvent(
        1,
      );

    assert.ok(
      firstRead,
    );

    assert.equal(
      firstRead
        .candidate
        .level
        .centerPrice,
      100,
    );

    firstRead
      .candidate
      .level
      .centerPrice =
        888;

    const secondRead =
      history.getEvent(
        1,
      );

    assert.ok(
      secondRead,
    );

    assert.equal(
      secondRead
        .candidate
        .level
        .centerPrice,
      100,
    );

    history.stop();
  },
);

test(
  'starts and stops the event-source subscription safely',
  () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();
    history.start();

    assert.equal(
      source.listenerCount,
      1,
    );

    history.stop();
    history.stop();

    assert.equal(
      source.listenerCount,
      0,
    );

    assert.equal(
      history
        .getStatus()
        .state,
      'stopped',
    );
  },
);

test(
  'event history routes return filtered events, detail and candidate history',
  async () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();

    source.emit(
      createEvent({
        eventId:
          1,

        candidateId:
          'setup-sol',

        symbol:
          'SOLUSDT',
      }),
    );

    source.emit(
      createEvent({
        eventId:
          2,

        candidateId:
          'setup-sol',

        symbol:
          'SOLUSDT',

        type:
          'breakout_confirmed',

        direction:
          'long',

        currentStage:
          'BREAKOUT_CONFIRMED',

        outcome:
          'breakout',
      }),
    );

    source.emit(
      createEvent({
        eventId:
          3,

        candidateId:
          'setup-eth',

        symbol:
          'ETHUSDT',

        direction:
          'short',
      }),
    );

    const app =
      await createRouteApp(
        history,
      );

    const listResponse =
      await app.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/events'
          + '?candidateId=setup-sol'
          + '&symbol=solusdt'
          + '&type=breakout_confirmed'
          + '&direction=long'
          + '&stage=BREAKOUT_CONFIRMED'
          + '&outcome=breakout'
          + '&limit=1',
      });

    assert.equal(
      listResponse.statusCode,
      200,
    );

    assert.deepEqual(
      listResponse
        .json()
        .map(
          (
            event:
              SetupLifecycleEvent,
          ) =>
            event.eventId,
        ),
      [
        2,
      ],
    );

    const detailResponse =
      await app.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/events/2',
      });

    assert.equal(
      detailResponse.statusCode,
      200,
    );

    assert.equal(
      detailResponse
        .json()
        .type,
      'breakout_confirmed',
    );

    const candidateResponse =
      await app.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/candidates/setup-sol/events',
      });

    assert.equal(
      candidateResponse.statusCode,
      200,
    );

    assert.deepEqual(
      candidateResponse
        .json()
        .map(
          (
            event:
              SetupLifecycleEvent,
          ) =>
            event.eventId,
        ),
      [
        2,
        1,
      ],
    );

    const statusResponse =
      await app.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/events/status',
      });

    assert.equal(
      statusResponse.statusCode,
      200,
    );

    assert.equal(
      statusResponse
        .json()
        .eventsCount,
      3,
    );

    await app.close();
    history.stop();
  },
);

test(
  'event history routes validate input and return expected errors',
  async () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
      );

    history.start();

    const app =
      await createRouteApp(
        history,
      );

    const cases = [
      {
        url:
          '/api/v1/setups/events?candidateId=bad%20candidate',

        error:
          'invalid_setup_event_candidate_id',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?symbol=bad!',

        error:
          'invalid_setup_event_symbol',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?type=unknown',

        error:
          'invalid_setup_event_type',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?direction=up',

        error:
          'invalid_setup_event_direction',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?stage=UNKNOWN',

        error:
          'invalid_setup_event_stage',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?outcome=unknown',

        error:
          'invalid_setup_event_outcome',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events?limit=0',

        error:
          'invalid_setup_event_limit',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events/0',

        error:
          'invalid_setup_event_id',

        statusCode:
          400,
      },
      {
        url:
          '/api/v1/setups/events/999',

        error:
          'setup_event_not_found',

        statusCode:
          404,
      },
      {
        url:
          '/api/v1/setups/candidates/bad%20candidate/events',

        error:
          'invalid_setup_event_candidate_id',

        statusCode:
          400,
      },
    ] as const;

    for (
      const item
      of cases
    ) {
      const response =
        await app.inject({
          method:
            'GET',

          url:
            item.url,
        });

      assert.equal(
        response.statusCode,
        item.statusCode,
      );

      assert.equal(
        response
          .json()
          .error,
        item.error,
      );
    }

    await app.close();
    history.stop();
  },
);

test(
  'event history routes return 503 when history is unavailable',
  async () => {
    const app =
      await createRouteApp();

    const urls = [
      '/api/v1/setups/events/status',
      '/api/v1/setups/events',
      '/api/v1/setups/events/1',
      '/api/v1/setups/candidates/setup-test/events',
    ];

    for (
      const url
      of urls
    ) {
      const response =
        await app.inject({
          method:
            'GET',

          url,
        });

      assert.equal(
        response.statusCode,
        503,
      );

      assert.equal(
        response
          .json()
          .error,
        'setup_event_history_unavailable',
      );
    }

    await app.close();
  },
);

test(
  'buildApp subscribes history before runtime startup events',
  async () => {
    const runtime =
      new TestRuntime();

    const app =
      await buildApp({
        env:
          testEnv,

        realtimeMarketDataService:
          null,

        binanceSymbolUniverseService:
          null,

        marketWideRealtimeService:
          null,

        marketWideHistoryWarmupService:
          null,

        setupDetectionRuntimeService:
          runtime,
      });

    await app.ready();

    assert.equal(
      runtime.starts,
      1,
    );

    const response =
      await app.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/events',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response
        .json()
        .length,
      1,
    );

    assert.equal(
      response
        .json()[0]
        .candidateId,
      'setup-startup',
    );

    await app.close();

    assert.equal(
      runtime.stops,
      1,
    );
  },
);
