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
  CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
  SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
} from '../src/modules/setup-engine/causal-setup-adapter.types.js';
import type {
  SetupDetectionRuntimeEventSource,
} from '../src/modules/setup-engine/setup-detection-runtime.types.js';
import {
  JsonFileSetupEventHistoryPersistence,
  normalizeSetupEventHistoryPersistenceSnapshot,
  SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,
  SETUP_EVENT_HISTORY_PERSISTENCE_VERSION,
  SetupEventHistoryPersistenceError,
  type SetupEventHistoryPersistenceContract,
  type SetupEventHistoryPersistenceSnapshot,
} from '../src/modules/setup-engine/setup-event-history.persistence.js';
import {
  SetupEventHistoryService,
} from '../src/modules/setup-engine/setup-event-history.service.js';
import type {
  SetupEngineOutcome,
  SetupEngineStage,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventListener,
  SetupLifecycleEventType,
} from '../src/modules/setup-engine/setup-lifecycle-events.types.js';

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

    return () => {
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

function createCandidate(
  input: {
    id: string;
    createdAt: string;
    updatedAt: string;
    stage: SetupEngineStage;
    outcome: SetupEngineOutcome;
  },
): SetupEngineState {
  const createdAtMs =
    Date.parse(
      input.createdAt,
    );

  const lineId =
    `line-${input.id}`;

  const terminal =
    input.stage
      === 'BREAKOUT_CONFIRMED'
    || input.stage
      === 'REJECTION_CONFIRMED';

  return {
    id:
      input.id,
    symbol:
      'SOLUSDT',
    timeframe:
      '1m',
    setupType:
      'level_breakout',
    direction:
      'long',
    stage:
      input.stage,
    outcome:
      input.outcome,
    level: {
      kind:
        'resistance',
      centerPrice:
        100,
      zoneLow:
        100,
      zoneHigh:
        100,
      touches:
        2,
      confirmedAt:
        input.createdAt,
    },
    currentPrice:
      terminal
        ? 101
        : 99.5,
    distanceToLevelPct:
      terminal
        ? 1
        : 0.5,
    createdAt:
      input.createdAt,
    updatedAt:
      input.updatedAt,
    expiresAt:
      new Date(
        createdAtMs
        + 60 * 60 * 1_000,
      ).toISOString(),
    episode: {
      version:
        SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
      id:
        input.id,
      lineId,
      setupType:
        'level_breakout',
      startedAt:
        input.createdAt,
      departureExtremumObservedAt:
        new Date(
          createdAtMs
          - 60_000,
        ).toISOString(),
      boundary:
        'observation_threshold_reentry',
      restartDeterministic:
        true,
      usesFutureCandles:
        false,
    },
    causal: {
      version:
        CAUSAL_SETUP_ADAPTER_CONTRACT_VERSION,
      source:
        'level_lines',
      lineId,
      lineStatus:
        'confirmed',
      stage:
        terminal
          ? 'CONFIRMATION'
          : 'OBSERVATION',
      reason:
        terminal
          ? 'realtime_confirmation_confirmed'
          : 'observation_progress_threshold_met',
      observedAt:
        input.updatedAt,
      observationProgress:
        0.5,
      observationProgressThreshold:
        0.5,
      distanceToLevelPercent:
        terminal
          ? 0
          : null,
      maxDistanceToLevelPercent:
        0.5,
      realtimeConfirmationStatus:
        terminal
          ? 'confirmed'
          : 'not_applicable',
      realtimeConfirmationReasons:
        terminal
          ? [
              'test_confirmation',
            ]
          : [],
      sourceObservationalOnly:
        true,
      sourceCreatesSetup:
        false,
      sourceCreatesSignal:
        false,
      evaluatesBreakout:
        false,
      evaluatesBounce:
        false,
      usesFutureCandles:
        false,
      usesFutureRealtimeEvidence:
        false,
    },
  };
}

function createEvent(
  input: {
    eventId: number;
    candidateId: string;
    type:
      SetupLifecycleEventType;
    occurredAt: string;
    createdAt?: string;
    previousStage:
      SetupEngineStage
      | null;
    currentStage:
      SetupEngineStage;
    outcome:
      SetupEngineOutcome;
  },
): SetupLifecycleEvent {
  const createdAt =
    input.createdAt
    ?? input.occurredAt;

  const candidate =
    createCandidate({
      id:
        input.candidateId,
      createdAt,
      updatedAt:
        input.occurredAt,
      stage:
        input.currentStage,
      outcome:
        input.outcome,
    });

  return {
    eventId:
      input.eventId,
    type:
      input.type,
    occurredAt:
      input.occurredAt,
    candidateId:
      candidate.id,
    symbol:
      candidate.symbol,
    setupType:
      candidate.setupType,
    direction:
      candidate.direction,
    previousStage:
      input.previousStage,
    currentStage:
      candidate.stage,
    outcome:
      candidate.outcome,
    candidate,
  };
}

async function withTempDirectory(
  run:
    (
      directory: string,
    ) => Promise<void>,
): Promise<void> {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'nexus-setup-history-',
      ),
    );

  try {
    await run(
      directory,
    );
  } finally {
    await rm(
      directory,
      {
        recursive:
          true,
        force:
          true,
      },
    );
  }
}

class DeferredLoadPersistence
implements SetupEventHistoryPersistenceContract {
  readonly adapter =
    'deferred_test';

  private resolver:
    (
      value:
        unknown | null,
    ) => void =
      () => undefined;

  private readonly loaded =
    new Promise<
      unknown | null
    >(
      (resolve) => {
        this.resolver =
          resolve;
      },
    );

  load():
  Promise<unknown | null> {
    return this.loaded;
  }

  async save(
    _snapshot:
      SetupEventHistoryPersistenceSnapshot,
  ): Promise<void> {
    return;
  }

  resolveLoad(
    value:
      unknown | null,
  ): void {
    this.resolver(
      value,
    );
  }
}

class WriteFailurePersistence
implements SetupEventHistoryPersistenceContract {
  readonly adapter =
    'write_failure_test';

  async load():
  Promise<unknown | null> {
    return null;
  }

  async save(
    _snapshot:
      SetupEventHistoryPersistenceSnapshot,
  ): Promise<void> {
    throw new Error(
      'C:\\private\\sensitive-path\\history.json',
    );
  }
}

test(
  'hydrates persistence before subscribing to live lifecycle events',
  async () => {
    const source =
      new TestEventSource();
    const persistence =
      new DeferredLoadPersistence();

    const history =
      new SetupEventHistoryService(
        source,
        {
          maxEvents:
            10,
        },
        persistence,
      );

    const start =
      history.start();

    if (start === undefined) {
      throw new Error(
        'Persistent Setup Event History start must be asynchronous',
      );
    }

    assert.equal(
      source.listenerCount,
      0,
    );

    persistence.resolveLoad(
      null,
    );

    await start;

    assert.equal(
      source.listenerCount,
      1,
    );

    assert.equal(
      history
        .getStatus()
        .persistence
        ?.state,
      'ready',
    );

    await history.stop();
  },
);

test(
  'persists full lifecycle history and dedupes replayed events across restart',
  async () => {
    await withTempDirectory(
      async (
        directory,
      ) => {
        const filePath =
          join(
            directory,
            'history.json',
          );

        const firstSource =
          new TestEventSource();
        const firstPersistence =
          new JsonFileSetupEventHistoryPersistence({
            filePath,
          });
        const firstHistory =
          new SetupEventHistoryService(
            firstSource,
            {
              maxEvents:
                10,
            },
            firstPersistence,
          );

        await firstHistory.start();

        const createdAt =
          '2026-08-22T20:00:00.000Z';
        const terminalAt =
          '2026-08-22T20:05:00.000Z';

        firstSource.emit(
          createEvent({
            eventId:
              1,
            candidateId:
              'setup-line-a-level_breakout-episode-1',
            type:
              'candidate_created',
            occurredAt:
              createdAt,
            previousStage:
              null,
            currentStage:
              'LEVEL_CONFIRMED',
            outcome:
              null,
          }),
        );

        firstSource.emit(
          createEvent({
            eventId:
              2,
            candidateId:
              'setup-line-a-level_breakout-episode-1',
            type:
              'breakout_confirmed',
            occurredAt:
              terminalAt,
            createdAt,
            previousStage:
              'THIRD_TOUCH_CONFIRMED',
            currentStage:
              'BREAKOUT_CONFIRMED',
            outcome:
              'breakout',
          }),
        );

        await firstHistory.stop();

        const persisted =
          JSON.parse(
            await readFile(
              filePath,
              'utf8',
            ),
          ) as {
            events:
              SetupLifecycleEvent[];
          };

        assert.equal(
          persisted.events.length,
          2,
        );

        assert.equal(
          persisted.events[1]
            ?.candidate
            .episode
            ?.id,
          'setup-line-a-level_breakout-episode-1',
        );

        assert.equal(
          persisted.events[1]
            ?.outcome,
          'breakout',
        );

        const secondSource =
          new TestEventSource();
        const secondHistory =
          new SetupEventHistoryService(
            secondSource,
            {
              maxEvents:
                10,
            },
            new JsonFileSetupEventHistoryPersistence({
              filePath,
            }),
          );

        await secondHistory.start();

        assert.deepEqual(
          secondHistory
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

        secondSource.emit(
          createEvent({
            eventId:
              1,
            candidateId:
              'setup-line-a-level_breakout-episode-1',
            type:
              'breakout_confirmed',
            occurredAt:
              terminalAt,
            createdAt,
            previousStage:
              'THIRD_TOUCH_CONFIRMED',
            currentStage:
              'BREAKOUT_CONFIRMED',
            outcome:
              'breakout',
          }),
        );

        assert.equal(
          secondHistory
            .getStatus()
            .eventsCount,
          2,
        );

        assert.equal(
          secondHistory
            .getStatus()
            .persistence
            ?.duplicateEventsCount,
          1,
        );

        secondSource.emit(
          createEvent({
            eventId:
              1,
            candidateId:
              'setup-line-b-level_breakout-episode-2',
            type:
              'candidate_created',
            occurredAt:
              '2026-08-22T20:10:00.000Z',
            previousStage:
              null,
            currentStage:
              'LEVEL_CONFIRMED',
            outcome:
              null,
          }),
        );

        assert.deepEqual(
          secondHistory
            .getEvents()
            .map(
              (event) =>
                event.eventId,
            ),
          [
            3,
            2,
            1,
          ],
        );

        await secondHistory.stop();

        const thirdSource =
          new TestEventSource();
        const thirdHistory =
          new SetupEventHistoryService(
            thirdSource,
            {
              maxEvents:
                10,
            },
            new JsonFileSetupEventHistoryPersistence({
              filePath,
            }),
          );

        await thirdHistory.start();

        assert.deepEqual(
          thirdHistory
            .getEvents()
            .map(
              (event) => [
                event.eventId,
                event.candidateId,
                event.outcome,
              ],
            ),
          [
            [
              3,
              'setup-line-b-level_breakout-episode-2',
              null,
            ],
            [
              2,
              'setup-line-a-level_breakout-episode-1',
              'breakout',
            ],
            [
              1,
              'setup-line-a-level_breakout-episode-1',
              null,
            ],
          ],
        );

        await thirdHistory.stop();
      },
    );
  },
);

test(
  'retains bounded persisted history deterministically across restart',
  async () => {
    await withTempDirectory(
      async (
        directory,
      ) => {
        const filePath =
          join(
            directory,
            'bounded.json',
          );

        const source =
          new TestEventSource();
        const history =
          new SetupEventHistoryService(
            source,
            {
              maxEvents:
                2,
            },
            new JsonFileSetupEventHistoryPersistence({
              filePath,
            }),
          );

        await history.start();

        for (
          let index = 1;
          index <= 3;
          index += 1
        ) {
          source.emit(
            createEvent({
              eventId:
                index,
              candidateId:
                `setup-bounded-${index}`,
              type:
                'candidate_created',
              occurredAt:
                `2026-08-22T21:0${index}:00.000Z`,
              previousStage:
                null,
              currentStage:
                'LEVEL_CONFIRMED',
              outcome:
                null,
            }),
          );
        }

        await history.stop();

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
          history
            .getStatus()
            .droppedEventsCount,
          1,
        );

        const restarted =
          new SetupEventHistoryService(
            new TestEventSource(),
            {
              maxEvents:
                2,
            },
            new JsonFileSetupEventHistoryPersistence({
              filePath,
            }),
          );

        await restarted.start();

        assert.deepEqual(
          restarted
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
          restarted
            .getStatus()
            .droppedEventsCount,
          1,
        );

        await restarted.stop();
      },
    );
  },
);

test(
  'does not overwrite corrupt or unsupported storage and continues in bounded memory',
  async () => {
    await withTempDirectory(
      async (
        directory,
      ) => {
        for (
          const item
          of [
            {
              name:
                'corrupt',
              source:
                '{ definitely-not-json',
              expectedCode:
                'setup_event_history_persistence_corrupt',
            },
            {
              name:
                'unsupported',
              source:
                JSON.stringify(
                  {
                    schema:
                      SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,
                    version:
                      SETUP_EVENT_HISTORY_PERSISTENCE_VERSION
                      + 1,
                    savedAt:
                      '2026-08-22T20:00:00.000Z',
                    droppedEventsCount:
                      0,
                    events:
                      [],
                  },
                  null,
                  2,
                ),
              expectedCode:
                'setup_event_history_persistence_unsupported_version',
            },
          ] as const
        ) {
          const filePath =
            join(
              directory,
              `${item.name}.json`,
            );

          await writeFile(
            filePath,
            item.source,
            'utf8',
          );

          const source =
            new TestEventSource();

          const history =
            new SetupEventHistoryService(
              source,
              {
                maxEvents:
                  1,
              },
              new JsonFileSetupEventHistoryPersistence({
                filePath,
              }),
            );

          await history.start();

          source.emit(
            createEvent({
              eventId:
                1,
              candidateId:
                `setup-${item.name}`,
              type:
                'candidate_created',
              occurredAt:
                '2026-08-22T22:00:00.000Z',
              previousStage:
                null,
              currentStage:
                'LEVEL_CONFIRMED',
              outcome:
                null,
            }),
          );

          assert.equal(
            history
              .getStatus()
              .eventsCount,
            1,
          );

          assert.equal(
            history
              .getStatus()
              .persistence
              ?.state,
            'degraded',
          );

          assert.equal(
            history
              .getStatus()
              .persistence
              ?.writable,
            false,
          );

          assert.equal(
            history
              .getStatus()
              .persistence
              ?.lastErrorCode,
            item.expectedCode,
          );

          await history.stop();

          assert.equal(
            await readFile(
              filePath,
              'utf8',
            ),
            item.source,
          );
        }
      },
    );
  },
);

test(
  'reports only safe write error code while keeping lifecycle events in memory',
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
        new WriteFailurePersistence(),
      );

    await history.start();

    source.emit(
      createEvent({
        eventId:
          1,
        candidateId:
          'setup-write-failure',
        type:
          'candidate_created',
        occurredAt:
          '2026-08-22T22:10:00.000Z',
        previousStage:
          null,
        currentStage:
          'LEVEL_CONFIRMED',
        outcome:
          null,
      }),
    );

    await history.stop();

    const status =
      history.getStatus();

    assert.equal(
      status.eventsCount,
      1,
    );

    assert.equal(
      status.persistence
        ?.state,
      'degraded',
    );

    assert.equal(
      status.persistence
        ?.lastErrorCode,
      'setup_event_history_persistence_write_failed',
    );

    assert.equal(
      JSON.stringify(
        status,
      ).includes(
        'sensitive-path',
      ),
      false,
    );
  },
);

test(
  'normalizer rejects duplicate semantic lifecycle events in persisted storage',
  () => {
    const createdAt =
      '2026-08-22T23:00:00.000Z';

    const event =
      createEvent({
        eventId:
          1,
        candidateId:
          'setup-duplicate-storage',
        type:
          'candidate_created',
        occurredAt:
          createdAt,
        previousStage:
          null,
        currentStage:
          'LEVEL_CONFIRMED',
        outcome:
          null,
      });

    const snapshot:
      SetupEventHistoryPersistenceSnapshot = {
        schema:
          SETUP_EVENT_HISTORY_PERSISTENCE_SCHEMA,
        version:
          SETUP_EVENT_HISTORY_PERSISTENCE_VERSION,
        savedAt:
          createdAt,
        droppedEventsCount:
          0,
        events: [
          event,
          {
            ...event,
            eventId:
              2,
          },
        ],
      };

    assert.throws(
      () => {
        normalizeSetupEventHistoryPersistenceSnapshot(
          snapshot,
        );
      },
      (
        error: unknown,
      ) =>
        error
          instanceof SetupEventHistoryPersistenceError
        && error.code
          === 'setup_event_history_persistence_corrupt',
    );
  },
);