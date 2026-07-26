import {
  useEffect,
  useRef,
} from 'react';
import {
  SetupLifecycleStreamClient,
  type SetupLifecycleStreamEvent,
} from './setupLifecycleStream';

export interface UseSetupLifecycleRefreshOptions {
  candidateId?: string;
  symbol?: string;
  enabled?: boolean;

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

      let refreshTimer:
        ReturnType<
          typeof setTimeout
        >
        | null = null;

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

            if (
              refreshTimer
              !== null
            ) {
              clearTimeout(
                refreshTimer,
              );
            }

            refreshTimer =
              setTimeout(
                () => {
                  refreshTimer =
                    null;

                  onEventRef.current(
                    event,
                  );
                },
                50,
              );
          },
        );

      client.connect();

      return () => {
        if (
          refreshTimer
          !== null
        ) {
          clearTimeout(
            refreshTimer,
          );
        }

        unsubscribe();
        client.close();
      };
    },
    [
      enabled,
      options.candidateId,
      options.symbol,
    ],
  );
}
