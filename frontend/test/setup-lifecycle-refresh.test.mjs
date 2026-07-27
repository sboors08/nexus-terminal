import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSetupLifecycleEventThrottle,
  DEFAULT_SETUP_LIFECYCLE_REFRESH_THROTTLE_MS,
} from '../node_modules/.tmp/realtime-test/api/runtime/useSetupLifecycleRefresh.js';

function createEvent(
  eventId,
) {
  return {
    eventId,
    type:
      'stage_changed',
    candidateId:
      `setup-${eventId}`,
    symbol:
      'BANKUSDT',
    previousStage:
      'LEVEL_CONFIRMED',
    stage:
      'APPROACHING_THIRD_TOUCH',
    outcome:
      null,
    occurredAt:
      '2026-07-27T17:00:00.000Z',
    emittedAt:
      '2026-07-27T17:00:00.000Z',
  };
}

test(
  'uses a safe default Setup Lifecycle refresh throttle',
  () => {
    assert.equal(
      DEFAULT_SETUP_LIFECYCLE_REFRESH_THROTTLE_MS,
      250,
    );
  },
);

test(
  'coalesces a lifecycle event burst and delivers the latest event',
  () => {
    const scheduled =
      [];

    const cancelled =
      [];

    let nextHandle =
      0;

    const received =
      [];

    const throttle =
      createSetupLifecycleEventThrottle(
        (event) => {
          received.push(
            event,
          );
        },
        250,
        {
          schedule:
            (
              callback,
              delayMs,
            ) => {
              nextHandle += 1;

              scheduled.push({
                handle:
                  nextHandle,
                callback,
                delayMs,
              });

              return nextHandle;
            },

          cancel:
            (handle) => {
              cancelled.push(
                handle,
              );
            },
        },
      );

    throttle.push(
      createEvent(
        1,
      ),
    );

    throttle.push(
      createEvent(
        2,
      ),
    );

    throttle.push(
      createEvent(
        3,
      ),
    );

    assert.equal(
      scheduled.length,
      1,
    );

    assert.equal(
      scheduled[0]?.delayMs,
      250,
    );

    assert.equal(
      received.length,
      0,
    );

    scheduled[0]?.callback();

    assert.equal(
      received.length,
      1,
    );

    assert.equal(
      received[0]?.eventId,
      3,
    );

    throttle.push(
      createEvent(
        4,
      ),
    );

    assert.equal(
      scheduled.length,
      2,
    );

    throttle.cancel();

    assert.deepEqual(
      cancelled,
      [
        2,
      ],
    );

    scheduled[1]?.callback();

    assert.equal(
      received.length,
      1,
    );
  },
);

test(
  'rejects an invalid lifecycle refresh throttle',
  () => {
    assert.throws(
      () =>
        createSetupLifecycleEventThrottle(
          () => {},
          -1,
        ),
      /non-negative number/u,
    );
  },
);
