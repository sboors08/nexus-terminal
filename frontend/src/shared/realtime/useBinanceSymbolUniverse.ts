import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  fetchBinanceSymbolUniverse,
  type BinanceSymbolUniverseSnapshot,
} from './binanceSymbolUniverse';

export type BinanceSymbolUniverseLoadStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseBinanceSymbolUniverseOptions {
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseBinanceSymbolUniverseResult {
  snapshot:
    BinanceSymbolUniverseSnapshot
    | null;
  status:
    BinanceSymbolUniverseLoadStatus;
  error: Error | null;
  retry: () => void;
}

export function useBinanceSymbolUniverse(
  options:
    UseBinanceSymbolUniverseOptions = {},
): UseBinanceSymbolUniverseResult {
  const {
    baseUrl,
    enabled = true,
    intervalMs = 60_000,
  } = options;

  const [snapshot, setSnapshot] =
    useState<
      BinanceSymbolUniverseSnapshot
      | null
    >(null);

  const [status, setStatus] =
    useState<
      BinanceSymbolUniverseLoadStatus
    >(
      enabled
        ? 'loading'
        : 'idle',
    );

  const [error, setError] =
    useState<Error | null>(null);

  const [retryToken, setRetryToken] =
    useState(0);

  const retry = useCallback(() => {
    setRetryToken(
      (current) => current + 1,
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    let requestInProgress = false;

    const load = async (
      initial: boolean,
    ): Promise<void> => {
      if (requestInProgress) {
        return;
      }

      requestInProgress = true;

      if (initial) {
        setStatus('loading');
      }

      try {
        const nextSnapshot =
          await fetchBinanceSymbolUniverse({
            baseUrl,
          });

        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setStatus('ready');
        setError(null);
      } catch (caughtError: unknown) {
        if (cancelled) {
          return;
        }

        setStatus('error');

        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error(
                'Binance Symbol Universe request failed',
              ),
        );
      } finally {
        requestInProgress = false;
      }
    };

    void load(true);

    const timer =
      globalThis.setInterval(
        () => {
          void load(false);
        },
        Math.max(
          10_000,
          intervalMs,
        ),
      );

    return () => {
      cancelled = true;

      globalThis.clearInterval(
        timer,
      );
    };
  }, [
    baseUrl,
    enabled,
    intervalMs,
    retryToken,
  ]);

  return {
    snapshot,
    status,
    error,
    retry,
  };
}