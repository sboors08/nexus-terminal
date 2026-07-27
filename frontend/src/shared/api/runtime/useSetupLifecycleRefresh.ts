import {
  useEffect,
  useRef,
} from 'react';
import {
  SetupLifecycleStreamClient,
  type SetupLifecycleStreamEvent,
} from './setupLifecycleStream.js';

export const DEFAULT_SETUP_LIFECYCLE_REFRESH_THROTTLE_MS =
  250;

export interface SetupLifecycleRefreshTimerScheduler {
  schedule:
    (
      callback:
        () => void,
      delayMs:
        number,
    ) => unknown;

  cancel:
    (
      handle:
        unknown,
    ) => void;
}

export interface SetupLifecycleEventThrottle {
  push:
    (
      event:
        SetupLifecycleStreamEvent,
    ) => void;

  cancel:
    () => void;
}

const defaultTimerScheduler:
SetupLifecycleRefreshTimerScheduler = {
  schedule:
    (
      callback,
      delayMs,
    ) =>
      globalThis.setTimeout(
        callback,
        delayMs,
      ),

  cancel:
    (handle) =>
      globalThis.clearTimeout(
        handle as ReturnType<
          typeof setTimeout
        >,
      ),
};

export function createSetupLifecycleEventThrottle(
  onEvent:
    (
      event:
        SetupLifecycleStreamEvent,
    ) => void,

  delayMs:
    number =
      DEFAULT_SETUP_LIFECYCLE_REFRESH_THROTTLE_MS,

  scheduler:
    SetupLifecycleRefreshTimerScheduler =
      defaultTimerScheduler,
): SetupLifecycleEventThrottle {
  if (
    !Number.isFinite(
      delayMs,
    )
    || delayMs < 0
  ) {
    throw new Error(
      'Setup Lifecycle refresh throttle must be a non-negative number',
    );
  }

  let timerHandle:
    unknown | null = null;

  let latestEvent:
    SetupLifecycleStreamEvent | null =
      null;

  return {
    push:
      (event) => {
        latestEvent =
          event;

        if (
          timerHandle
          !== null
        ) {
          return;
        }

        timerHandle =
          scheduler.schedule(
            () => {
              timerHandle =
                null;

              const eventToHandle =
                latestEvent;

              latestEvent =
                null;

              if (
                eventToHandle
              ) {
                onEvent(
                  eventToHandle,
                );
              }
            },
            delayMs,
          );
      },

    cancel:
      () => {
        if (
          timerHandle
          !== null
        ) {
          scheduler.cancel(
            timerHandle,
          );
        }

        timerHandle =
          null;

        latestEvent =
          null;
      },
  };
}

export interface UseSetupLifecycleRefreshOptions {
  candidateId?: string;
  symbol?: string;
  enabled?: boolean;
  throttleMs?: number;

  onEvent:
    (
      event:
        SetupLifecycleStreamEvent,
    ) => void;
}

export function useSetupLifecycleRefresh(
  options:
    UseSetupLifecycleRefreshOptions,
): void {
  const onEventRef =
    useRef(
      options.onEvent,
    );

  onEventRef.current =
    options.onEvent;

  const enabled =
    options.enabled
    ?? true;

  const throttleMs =
    options.throttleMs
    ?? DEFAULT_SETUP_LIFECYCLE_REFRESH_THROTTLE_MS;

  useEffect(
    () => {
      if (
        !enabled
      ) {
        return;
      }

      const client =
        new SetupLifecycleStreamClient({
          ...(
            options.candidateId
              ? {
                  candidateId:
                    options.candidateId,
                }
              : {}
          ),

          ...(
            options.symbol
              ? {
                  symbol:
                    options.symbol,
                }
              : {}
          ),
        });

      let lastHandledEventId =
        0;

      const eventThrottle =
        createSetupLifecycleEventThrottle(
          (event) =>
            onEventRef.current(
              event,
            ),
          throttleMs,
        );

      const unsubscribe =
        client.subscribe(
          (
            snapshot,
          ) => {
            const event =
              snapshot.lastEvent;

            if (
              !event
              || event.eventId
                <= lastHandledEventId
            ) {
              return;
            }

            lastHandledEventId =
              event.eventId;

            eventThrottle.push(
              event,
            );
          },
        );

      client.connect();

      return () => {
        eventThrottle.cancel();
        unsubscribe();
        client.close();
      };
    },
    [
      enabled,
      options.candidateId,
      options.symbol,
      throttleMs,
    ],
  );
}
