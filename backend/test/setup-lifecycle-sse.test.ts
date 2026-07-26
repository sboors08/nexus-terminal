import assert from 'node:assert/strict';
import {
  get,
} from 'node:http';
import type {
  AddressInfo,
} from 'node:net';
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
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import {
  SetupEventHistoryService,
} from '../src/modules/setup-engine/setup-event-history.service.js';
import type {
  SetupEventHistoryReader,
} from '../src/modules/setup-engine/setup-event-history.types.js';
import {
  setupLifecycleSseRoutes,
} from '../src/modules/setup-engine/setup-lifecycle-sse.routes.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventListener,
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
  eventId: number,
  candidateId:
    string = 'setup-sol',
): SetupEngineState {
  return {
    id:
      candidateId,

    symbol:
      'SOLUSDT',

    timeframe:
      '1m',

    setupType:
      'level_breakout',

    direction:
      'long',

    stage:
      eventId >= 3
        ? 'BREAKOUT_CONFIRMED'
        : eventId === 2
          ? 'APPROACHING_THIRD_TOUCH'
          : 'LEVEL_CONFIRMED',

    outcome:
      eventId >= 3
        ? 'breakout'
        : null,

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
        eventId >= 3
          ? 3
          : 2,

      confirmedAt:
        '2026-07-26T12:00:00.000Z',
    },

    currentPrice:
      100 + eventId,

    distanceToLevelPct:
      eventId >= 3
        ? 0
        : 0.5,

    createdAt:
      '2026-07-26T12:00:00.000Z',

    updatedAt:
      `2026-07-26T12:0${eventId}:00.000Z`,

    expiresAt:
      '2026-07-26T13:00:00.000Z',
  };
}

function createEvent(
  eventId: number,
  candidateId:
    string = 'setup-sol',
): SetupLifecycleEvent {
  const candidate =
    createCandidate(
      eventId,
      candidateId,
    );

  return {
    eventId,

    type:
      eventId >= 3
        ? 'breakout_confirmed'
        : eventId === 1
          ? 'candidate_created'
          : 'stage_transition',

    occurredAt:
      candidate.updatedAt,

    candidateId:
      candidate.id,

    symbol:
      candidate.symbol,

    setupType:
      candidate.setupType,

    direction:
      candidate.direction,

    previousStage:
      eventId === 1
        ? null
        : eventId === 2
          ? 'LEVEL_CONFIRMED'
          : 'APPROACHING_THIRD_TOUCH',

    currentStage:
      candidate.stage,

    outcome:
      candidate.outcome,

    candidate,
  };
}

class TestEventSource
implements SetupDetectionRuntimeEventSource {
  private readonly listeners =
    new Set<
      SetupLifecycleEventListener
    >();

  subscribeLifecycleEvents(
    listener:
      SetupLifecycleEventListener,
  ): () => void {
    this.listeners.add(
      listener,
    );

    let subscribed =
      true;

    return () => {
      if (
        !subscribed
      ) {
        return;
      }

      subscribed =
        false;

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
        structuredClone(
          event,
        ),
      );
    }
  }

  get listenerCount():
  number {
    return this.listeners.size;
  }
}

class TestRuntime
extends TestEventSource
implements SetupDetectionRuntimeLifecycle {
  starts =
    0;

  stops =
    0;

  start(): void {
    this.starts +=
      1;

    this.emit(
      createEvent(
        1,
        'setup-startup',
      ),
    );
  }

  stop(): void {
    this.stops +=
      1;
  }
}

async function waitFor(
  predicate:
    () => boolean,

  timeoutMs:
    number = 1_000,
): Promise<void> {
  const deadline =
    Date.now()
    + timeoutMs;

  while (
    !predicate()
  ) {
    if (
      Date.now()
      >= deadline
    ) {
      throw new Error(
        'Timed out waiting for condition',
      );
    }

    await new Promise<void>(
      (resolve) =>
        setTimeout(
          resolve,
          10,
        ),
    );
  }
}

test(
  'streams replayed and live setup lifecycle events in order',
  async (t) => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            20,
        },
      );

    history.start();

    source.emit(
      createEvent(
        1,
      ),
    );

    source.emit(
      createEvent(
        2,
      ),
    );

    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      setupLifecycleSseRoutes,
      {
        prefix:
          '/api/v1',

        setupEventHistoryReader:
          history,

        setupDetectionRuntimeEventSource:
          source,
      },
    );

    await app.listen({
      host:
        '127.0.0.1',

      port:
        0,
    });

    t.after(
      async () => {
        await app.close();
        history.stop();
      },
    );

    const address =
      app.server
        .address() as
          AddressInfo;

    let payload =
      '';

    let responseDestroyed =
      false;

    const request =
      get(
        {
          host:
            '127.0.0.1',

          port:
            address.port,

          path:
            '/api/v1/setups/events/stream'
            + '?symbol=solusdt'
            + '&afterEventId=1',

          headers: {
            accept:
              'text/event-stream',
          },
        },
        (response) => {
          assert.match(
            response.headers[
              'content-type'
            ] ?? '',
            /^text\/event-stream/,
          );

          response.setEncoding(
            'utf8',
          );

          response.on(
            'data',
            (
              chunk:
                string,
            ) => {
              payload +=
                chunk;
            },
          );

          const destroy =
            () => {
              if (
                responseDestroyed
              ) {
                return;
              }

              responseDestroyed =
                true;

              response.destroy();
            };

          void waitFor(
            () =>
              payload.includes(
                'id: 2',
              ),
          )
            .then(
              () => {
                source.emit(
                  createEvent(
                    3,
                  ),
                );

                return waitFor(
                  () =>
                    payload.includes(
                      'id: 3',
                    ),
                );
              },
            )
            .then(
              destroy,
              destroy,
            );
        },
      );

    t.after(
      () => {
        request.destroy();
      },
    );

    await waitFor(
      () =>
        payload.includes(
          'id: 3',
        ),
      2_000,
    );

    assert.match(
      payload,
      /retry: 3000/,
    );

    assert.match(
      payload,
      /event: ready/,
    );

    assert.match(
      payload,
      /id: 2[\s\S]*id: 3/,
    );

    assert.doesNotMatch(
      payload,
      /id: 1\n/,
    );

    assert.match(
      payload,
      /"candidateId":"setup-sol"/,
    );

    await waitFor(
      () =>
        source.listenerCount
        === 1,
    );
  },
);

test(
  'prefers Last-Event-ID over the query resume id',
  async (t) => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            20,
        },
      );

    history.start();

    source.emit(
      createEvent(
        1,
      ),
    );

    source.emit(
      createEvent(
        2,
      ),
    );

    source.emit(
      createEvent(
        3,
      ),
    );

    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      setupLifecycleSseRoutes,
      {
        prefix:
          '/api/v1',

        setupEventHistoryReader:
          history,

        setupDetectionRuntimeEventSource:
          source,
      },
    );

    await app.listen({
      host:
        '127.0.0.1',

      port:
        0,
    });

    t.after(
      async () => {
        await app.close();
        history.stop();
      },
    );

    const address =
      app.server
        .address() as
          AddressInfo;

    const payload =
      await new Promise<string>(
        (
          resolve,
          reject,
        ) => {
          let body =
            '';

          let settled =
            false;

          const timeout =
            setTimeout(
              () => {
                if (
                  settled
                ) {
                  return;
                }

                settled =
                  true;

                reject(
                  new Error(
                    'Timed out waiting for resumed SSE payload',
                  ),
                );
              },
              2_000,
            );

          const request =
            get(
              {
                host:
                  '127.0.0.1',

                port:
                  address.port,

                path:
                  '/api/v1/setups/events/stream'
                  + '?afterEventId=0',

                headers: {
                  accept:
                    'text/event-stream',

                  'last-event-id':
                    '2',
                },
              },
              (response) => {
                response.setEncoding(
                  'utf8',
                );

                response.on(
                  'data',
                  (
                    chunk:
                      string,
                  ) => {
                    body +=
                      chunk;

                    if (
                      !settled
                      && body.includes(
                        'id: 3',
                      )
                    ) {
                      settled =
                        true;

                      clearTimeout(
                        timeout,
                      );

                      resolve(
                        body,
                      );

                      response.destroy();
                    }
                  },
                );
              },
            );

          request.on(
            'error',
            (
              error,
            ) => {
              if (
                settled
              ) {
                return;
              }

              settled =
                true;

              clearTimeout(
                timeout,
              );

              reject(
                error,
              );
            },
          );
        },
      );

    assert.match(
      payload,
      /id: 3/,
    );

    assert.doesNotMatch(
      payload,
      /id: 1\n|id: 2\n/,
    );
  },
);

test(
  'validates setup lifecycle stream filters and availability',
  async () => {
    const source =
      new TestEventSource();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            20,
        },
      );

    history.start();

    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      setupLifecycleSseRoutes,
      {
        prefix:
          '/api/v1',

        setupEventHistoryReader:
          history,

        setupDetectionRuntimeEventSource:
          source,
      },
    );

    const cases = [
      {
        url:
          '/api/v1/setups/events/stream'
          + '?symbol=BAD!',

        error:
          'invalid_setup_event_symbol',
      },
      {
        url:
          '/api/v1/setups/events/stream'
          + '?candidateId=bad%20candidate',

        error:
          'invalid_setup_event_candidate_id',
      },
      {
        url:
          '/api/v1/setups/events/stream'
          + '?afterEventId=-1',

        error:
          'invalid_setup_event_resume_id',
      },
      {
        url:
          '/api/v1/setups/events/stream'
          + '?afterEventId=1.5',

        error:
          'invalid_setup_event_resume_id',
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
        400,
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

    const unavailableApp =
      Fastify({
        logger:
          false,
      });

    await unavailableApp.register(
      setupLifecycleSseRoutes,
      {
        prefix:
          '/api/v1',
      },
    );

    const unavailableResponse =
      await unavailableApp.inject({
        method:
          'GET',

        url:
          '/api/v1/setups/events/stream',
      });

    assert.equal(
      unavailableResponse
        .statusCode,
      503,
    );

    assert.equal(
      unavailableResponse
        .json()
        .error,
      'setup_lifecycle_stream_unavailable',
    );

    await unavailableApp.close();
  },
);

test(
  'buildApp stores startup events and exposes them through lifecycle SSE',
  async (t) => {
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

    await app.listen({
      host:
        '127.0.0.1',

      port:
        0,
    });

    t.after(
      async () => {
        await app.close();
      },
    );

    assert.equal(
      runtime.starts,
      1,
    );

    const address =
      app.server
        .address() as
          AddressInfo;

    const payload =
      await new Promise<string>(
        (
          resolve,
          reject,
        ) => {
          let body =
            '';

          let settled =
            false;

          const timeout =
            setTimeout(
              () => {
                if (
                  settled
                ) {
                  return;
                }

                settled =
                  true;

                reject(
                  new Error(
                    'Timed out waiting for buildApp lifecycle event',
                  ),
                );
              },
              2_000,
            );

          const request =
            get(
              {
                host:
                  '127.0.0.1',

                port:
                  address.port,

                path:
                  '/api/v1/setups/events/stream'
                  + '?afterEventId=0',

                headers: {
                  accept:
                    'text/event-stream',
                },
              },
              (response) => {
                response.setEncoding(
                  'utf8',
                );

                response.on(
                  'data',
                  (
                    chunk:
                      string,
                  ) => {
                    body +=
                      chunk;

                    if (
                      !settled
                      && body.includes(
                        '"candidateId":"setup-startup"',
                      )
                    ) {
                      settled =
                        true;

                      clearTimeout(
                        timeout,
                      );

                      resolve(
                        body,
                      );

                      response.destroy();
                    }
                  },
                );
              },
            );

          request.on(
            'error',
            (
              error,
            ) => {
              if (
                settled
              ) {
                return;
              }

              settled =
                true;

              clearTimeout(
                timeout,
              );

              reject(
                error,
              );
            },
          );
        },
      );

    assert.match(
      payload,
      /event: setup_event/,
    );

    assert.match(
      payload,
      /id: 1/,
    );

    await app.close();

    assert.equal(
      runtime.stops,
      1,
    );
  },
);


test(
  'keeps replay events ordered before live events arriving during replay',
  async (t) => {
    const source =
      new TestEventSource();

    const firstEvent =
      createEvent(
        1,
      );

    const secondEvent =
      createEvent(
        2,
      );

    const raceHistory:
    SetupEventHistoryReader = {
      getStatus:
        () => ({
          state:
            'running',

          eventsCount:
            2,

          maxEvents:
            20,

          firstEventId:
            1,

          lastEventId:
            2,

          droppedEventsCount:
            0,
        }),

      getEvents:
        () => {
          source.emit(
            createEvent(
              3,
            ),
          );

          return [
            structuredClone(
              secondEvent,
            ),

            structuredClone(
              firstEvent,
            ),
          ];
        },

      getEvent:
        (
          eventId,
        ) => {
          if (
            eventId === 1
          ) {
            return structuredClone(
              firstEvent,
            );
          }

          if (
            eventId === 2
          ) {
            return structuredClone(
              secondEvent,
            );
          }

          return null;
        },

      getCandidateEvents:
        () => [
          structuredClone(
            secondEvent,
          ),

          structuredClone(
            firstEvent,
          ),
        ],
    };

    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      setupLifecycleSseRoutes,
      {
        prefix:
          '/api/v1',

        setupEventHistoryReader:
          raceHistory,

        setupDetectionRuntimeEventSource:
          source,
      },
    );

    await app.listen({
      host:
        '127.0.0.1',

      port:
        0,
    });

    t.after(
      async () => {
        await app.close();
      },
    );

    const address =
      app.server
        .address() as
          AddressInfo;

    const payload =
      await new Promise<string>(
        (
          resolve,
          reject,
        ) => {
          let body =
            '';

          let settled =
            false;

          const timeout =
            setTimeout(
              () => {
                if (
                  settled
                ) {
                  return;
                }

                settled =
                  true;

                reject(
                  new Error(
                    'Timed out waiting for ordered replay payload',
                  ),
                );
              },
              2_000,
            );

          const request =
            get(
              {
                host:
                  '127.0.0.1',

                port:
                  address.port,

                path:
                  '/api/v1/setups/events/stream'
                  + '?afterEventId=1',

                headers: {
                  accept:
                    'text/event-stream',
                },
              },
              (response) => {
                response.setEncoding(
                  'utf8',
                );

                response.on(
                  'data',
                  (
                    chunk:
                      string,
                  ) => {
                    body +=
                      chunk;

                    if (
                      !settled
                      && body.includes(
                        'id: 2',
                      )
                      && body.includes(
                        'id: 3',
                      )
                    ) {
                      settled =
                        true;

                      clearTimeout(
                        timeout,
                      );

                      resolve(
                        body,
                      );

                      response.destroy();
                    }
                  },
                );
              },
            );

          request.on(
            'error',
            (
              error,
            ) => {
              if (
                settled
              ) {
                return;
              }

              settled =
                true;

              clearTimeout(
                timeout,
              );

              reject(
                error,
              );
            },
          );
        },
      );

    assert.match(
      payload,
      /id: 2[\s\S]*id: 3/,
    );
  },
);
