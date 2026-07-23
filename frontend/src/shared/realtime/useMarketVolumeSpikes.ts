import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  fetchMarketVolumeSpikes,
  type MarketVolumeSpike,
} from './marketVolumeSpikes.js';

export type MarketVolumeSpikesQueryStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseMarketVolumeSpikesOptions {
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
  symbol?: string;
  limit?: number;
}

export interface UseMarketVolumeSpikesResult {
  spikes: readonly MarketVolumeSpike[];
  status: MarketVolumeSpikesQueryStatus;
  error: Error | null;
  lastUpdatedAt: string | null;
  retry: () => void;
}

export function useMarketVolumeSpikes(
  options:
    UseMarketVolumeSpikesOptions = {},
): UseMarketVolumeSpikesResult {
  const {
    baseUrl,
    enabled = true,
    intervalMs = 5_000,
    symbol,
    limit = 20,
  } = options;

  const [spikes, setSpikes] =
    useState<MarketVolumeSpike[]>([]);

  const [status, setStatus] =
    useState<MarketVolumeSpikesQueryStatus>(
      enabled
        ? 'loading'
        : 'idle',
    );

  const [error, setError] =
    useState<Error | null>(null);

  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<string | null>(null);

  const [retryToken, setRetryToken] =
    useState(0);

  const retry =
    useCallback(() => {
      setRetryToken(
        (current) =>
          current + 1,
      );
    }, []);

  useEffect(() => {
    if (!enabled) {
      setSpikes([]);
      setStatus('idle');
      setError(null);
      setLastUpdatedAt(null);

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
        const response =
          await fetchMarketVolumeSpikes({
            baseUrl,
            symbol,
            limit,
          });

        if (cancelled) {
          return;
        }

        setSpikes(response);
        setStatus('ready');
        setError(null);
        setLastUpdatedAt(
          new Date().toISOString(),
        );
      } catch (
        caughtError: unknown
      ) {
        if (cancelled) {
          return;
        }

        setStatus('error');
        setError(
          caughtError
            instanceof Error
            ? caughtError
            : new Error(
                'Market volume spikes request failed',
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
          1_000,
          intervalMs,
        ),
      );

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [
    baseUrl,
    enabled,
    intervalMs,
    limit,
    retryToken,
    symbol,
  ]);

  return {
    spikes,
    status,
    error,
    lastUpdatedAt,
    retry,
  };
}
