import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  OrderBookDepthClient,
  type OrderBookDepthClientOptions,
  type OrderBookDepthClientState,
} from './orderBookDepthClient';

export interface UseOrderBookDepthOptions
extends OrderBookDepthClientOptions {
  enabled?: boolean;
}

export interface UseOrderBookDepthResult
extends OrderBookDepthClientState {
  reconnect: () => void;
  close: () => void;
}

const INITIAL_STATE:
OrderBookDepthClientState = {
  lifecycleState:
    'idle',
  status:
    null,
  snapshot:
    null,
  error:
    null,
};

export function useOrderBookDepth(
  options:
    UseOrderBookDepthOptions,
): UseOrderBookDepthResult {
  const {
    baseUrl,
    symbol,
    levelsLimit,
    depthRangePct,
    bucketSize,
    maxBucketsPerSide,
    eventSourceFactory,
    enabled = true,
  } = options;

  const clientRef =
    useRef<
      OrderBookDepthClient
      | null
    >(
      null,
    );

  const [
    state,
    setState,
  ] = useState<
    OrderBookDepthClientState
  >(
    INITIAL_STATE,
  );

  useEffect(
    () => {
      const client =
        new OrderBookDepthClient({
          symbol,
          ...(
            baseUrl === undefined
              ? {}
              : { baseUrl }
          ),
          ...(
            levelsLimit === undefined
              ? {}
              : { levelsLimit }
          ),
          ...(
            depthRangePct === undefined
              ? {}
              : { depthRangePct }
          ),
          ...(
            bucketSize === undefined
              ? {}
              : { bucketSize }
          ),
          ...(
            maxBucketsPerSide === undefined
              ? {}
              : {
                  maxBucketsPerSide,
                }
          ),
          ...(
            eventSourceFactory
              === undefined
              ? {}
              : {
                  eventSourceFactory,
                }
          ),
        });

      clientRef.current =
        client;

      const unsubscribe =
        client.subscribe(
          setState,
        );

      if (enabled) {
        client.connect();
      }

      return () => {
        unsubscribe();
        client.close();

        if (
          clientRef.current
          === client
        ) {
          clientRef.current =
            null;
        }
      };
    },
    [
      baseUrl,
      bucketSize,
      depthRangePct,
      enabled,
      eventSourceFactory,
      levelsLimit,
      maxBucketsPerSide,
      symbol,
    ],
  );

  const reconnect =
    useCallback(
      () => {
        clientRef.current
          ?.reconnect();
      },
      [],
    );

  const close =
    useCallback(
      () => {
        clientRef.current
          ?.close();
      },
      [],
    );

  return {
    ...state,
    reconnect,
    close,
  };
}
