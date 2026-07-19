import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RealtimeMarketDataClient,
  type RealtimeClientState,
  type RealtimeMarketDataClientOptions,
} from './realtimeClient';

export interface UseRealtimeMarketDataOptions extends RealtimeMarketDataClientOptions {
  enabled?: boolean;
}

export interface UseRealtimeMarketDataResult extends RealtimeClientState {
  reconnect: () => void;
  close: () => void;
}

const INITIAL_STATE: RealtimeClientState = {
  lifecycleState: 'idle',
  status: null,
  snapshots: {},
  error: null,
};

export function useRealtimeMarketData(
  options: UseRealtimeMarketDataOptions = {},
): UseRealtimeMarketDataResult {
  const {
    baseUrl,
    symbol,
    symbols,
    eventSourceFactory,
    enabled = true,
  } = options;

  const symbolsKey = symbols?.join(',') ?? '';
  const clientRef = useRef<RealtimeMarketDataClient | null>(null);
  const [state, setState] = useState<RealtimeClientState>(INITIAL_STATE);

  useEffect(() => {
    const client = new RealtimeMarketDataClient({
      baseUrl,
      symbol,
      symbols: symbolsKey ? symbolsKey.split(',') : undefined,
      eventSourceFactory,
    });
    clientRef.current = client;

    const unsubscribe = client.subscribe(setState);
    if (enabled) client.connect();

    return () => {
      unsubscribe();
      client.close();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, [baseUrl, enabled, eventSourceFactory, symbol, symbolsKey]);

  const reconnect = useCallback(() => {
    clientRef.current?.reconnect();
  }, []);

  const close = useCallback(() => {
    clientRef.current?.close();
  }, []);

  return {
    ...state,
    reconnect,
    close,
  };
}
