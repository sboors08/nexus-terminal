import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSetupLifecycleStreamUrl,
  parseSetupLifecycleEvent,
  SetupLifecycleStreamClient,
} from '../node_modules/.tmp/realtime-test/api/runtime/setupLifecycleStream.js';

class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.closed = false;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners =
      this.listeners.get(type)
      ?? new Set();

    listeners.add(listener);

    this.listeners.set(
      type,
      listeners,
    );
  }

  removeEventListener(type, listener) {
    this.listeners
      .get(type)
      ?.delete(listener);
  }

  close() {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type, data) {
    const event =
      data === undefined
        ? {
            type,
          }
        : {
            type,
            data:
              JSON.stringify(data),
          };

    for (
      const listener
      of this.listeners.get(type)
      ?? []
    ) {
      listener(event);
    }
  }

  emitRaw(type, data) {
    for (
      const listener
      of this.listeners.get(type)
      ?? []
    ) {
      listener({
        type,
        data,
      });
    }
  }
}

function createCandidate(stage = 'LEVEL_CONFIRMED') {
  return {
    id:
      'setup-sol',

    symbol:
      'SOLUSDT',

    timeframe:
      '1m',

    setupType:
      'level_breakout',

    direction:
      'long',

    stage,

    outcome:
      stage === 'BREAKOUT_CONFIRMED'
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
        stage === 'BREAKOUT_CONFIRMED'
          ? 3
          : 2,

      confirmedAt:
        '2026-07-26T12:00:00.000Z',
    },

    currentPrice:
      100,

    distanceToLevelPct:
      0.2,

    createdAt:
      '2026-07-26T12:00:00.000Z',

    updatedAt:
      '2026-07-26T12:01:00.000Z',

    expiresAt:
      '2026-07-26T13:00:00.000Z',
  };
}

function createLifecycleEvent() {
  const candidate =
    createCandidate(
      'BREAKOUT_CONFIRMED',
    );

  return {
    eventId:
      7,

    type:
      'breakout_confirmed',

    occurredAt:
      '2026-07-26T12:01:00.000Z',

    candidateId:
      candidate.id,

    symbol:
      candidate.symbol,

    setupType:
      candidate.setupType,

    direction:
      candidate.direction,

    previousStage:
      'THIRD_TOUCH_CONFIRMED',

    currentStage:
      candidate.stage,

    outcome:
      candidate.outcome,

    candidate,
  };
}

test(
  'builds Setup Lifecycle SSE URLs with normalized filters',
  () => {
    assert.equal(
      buildSetupLifecycleStreamUrl(),
      '/api/v1/setups/events/stream',
    );

    assert.equal(
      buildSetupLifecycleStreamUrl({
        baseUrl:
          'http://127.0.0.1:4100/',

        candidateId:
          ' setup-sol ',

        symbol:
          ' solusdt ',
      }),
      'http://127.0.0.1:4100/api/v1/setups/events/stream'
      + '?candidateId=setup-sol'
      + '&symbol=SOLUSDT',
    );

    assert.throws(
      () =>
        buildSetupLifecycleStreamUrl({
          candidateId:
            'bad candidate',
        }),
      /Invalid setup lifecycle candidate id/,
    );

    assert.throws(
      () =>
        buildSetupLifecycleStreamUrl({
          symbol:
            'SOL/USDT',
        }),
      /Invalid setup lifecycle symbol/,
    );
  },
);

test(
  'parses and validates Setup Lifecycle events',
  () => {
    const event =
      parseSetupLifecycleEvent(
        createLifecycleEvent(),
      );

    assert.equal(
      event.eventId,
      7,
    );

    assert.equal(
      event.type,
      'breakout_confirmed',
    );

    assert.equal(
      event.candidate.stage,
      'BREAKOUT_CONFIRMED',
    );

    assert.throws(
      () =>
        parseSetupLifecycleEvent({
          ...createLifecycleEvent(),

          candidateId:
            'another-setup',
        }),
      /does not match event/,
    );
  },
);

test(
  'receives ready and setup events and closes cleanly',
  () => {
    let source =
      null;

    const client =
      new SetupLifecycleStreamClient({
        candidateId:
          'setup-sol',

        eventSourceFactory:
          (
            url,
          ) => {
            source =
              new FakeEventSource(
                url,
              );

            return source;
          },
      });

    const snapshots =
      [];

    const unsubscribe =
      client.subscribe(
        (
          snapshot,
        ) => {
          snapshots.push(
            snapshot,
          );
        },
      );

    client.connect();

    assert.equal(
      source?.url,
      '/api/v1/setups/events/stream?candidateId=setup-sol',
    );

    assert.equal(
      snapshots.at(-1)?.state,
      'connecting',
    );

    source?.emit(
      'open',
    );

    assert.equal(
      snapshots.at(-1)?.state,
      'open',
    );

    source?.emit(
      'ready',
      {
        connectedAt:
          '2026-07-26T12:00:00.000Z',

        firstEventId:
          1,

        lastEventId:
          6,

        replayLimit:
          500,

        filters: {
          candidateId:
            'setup-sol',
        },
      },
    );

    assert.equal(
      snapshots.at(-1)
        ?.ready
        ?.lastEventId,
      6,
    );

    source?.emit(
      'setup_event',
      createLifecycleEvent(),
    );

    assert.equal(
      snapshots.at(-1)
        ?.lastEvent
        ?.eventId,
      7,
    );

    client.close();

    assert.equal(
      source?.closed,
      true,
    );

    assert.equal(
      snapshots.at(-1)?.state,
      'closed',
    );

    unsubscribe();
  },
);

test(
  'reports reconnecting and malformed event payloads',
  () => {
    let source =
      null;

    const client =
      new SetupLifecycleStreamClient({
        eventSourceFactory:
          (
            url,
          ) => {
            source =
              new FakeEventSource(
                url,
              );

            return source;
          },
      });

    client.connect();

    source?.emitRaw(
      'setup_event',
      '{broken json',
    );

    assert.ok(
      client
        .getSnapshot()
        .error,
    );

    source.readyState =
      0;

    source.emit(
      'error',
    );

    assert.equal(
      client
        .getSnapshot()
        .state,
      'reconnecting',
    );

    assert.match(
      client
        .getSnapshot()
        .error
        ?.message
        ?? '',
      /interrupted/,
    );
  },
);
