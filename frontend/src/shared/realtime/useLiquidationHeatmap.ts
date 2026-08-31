import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  fetchLiquidationHeatmap,
  type LiquidationHeatmapSnapshot,
} from './liquidationHeatmap.js';
import type {
  ScannerWindow,
} from '../config/tradingPresets.js';

export type LiquidationHeatmapQueryStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseLiquidationHeatmapOptions {
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
  symbol: string;
  scannerWindow?: ScannerWindow;
  limit?: number;
  historyLimit?: number;
}

export interface UseLiquidationHeatmapResult {
  snapshot: LiquidationHeatmapSnapshot | null;
  status: LiquidationHeatmapQueryStatus;
  error: Error | null;
  retry: () => void;
}

export function useLiquidationHeatmap(
  options: UseLiquidationHeatmapOptions,
): UseLiquidationHeatmapResult {
  const {
    baseUrl,
    enabled = true,
    intervalMs = 5_000,
    symbol,
    scannerWindow = '1m',
    limit = 250,
    historyLimit = 360,
  } = options;

  const [snapshot, setSnapshot] =
    useState<LiquidationHeatmapSnapshot | null>(null);
  const [status, setStatus] =
    useState<LiquidationHeatmapQueryStatus>(
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
        const response = await fetchLiquidationHeatmap({
          baseUrl,
          symbol,
          scannerWindow,
          limit,
          historyLimit:
            initial
              ? historyLimit
              : 2,
        });

        if (cancelled) {
          return;
        }

        setSnapshot((current) => {
          if (initial || current === null) {
            return response;
          }

          const byStart = new Map(
            current.historyBuckets.map(
              (bucket) => [bucket.bucketStart, bucket],
            ),
          );

          for (const bucket of response.historyBuckets) {
            byStart.set(bucket.bucketStart, bucket);
          }

          return {
            ...response,
            historyBuckets: [...byStart.values()]
              .sort(
                (left, right) =>
                  left.bucketStart.localeCompare(
                    right.bucketStart,
                  ),
              )
              .slice(-historyLimit),
          };
        });
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
                'Liquidation heatmap request failed',
              ),
        );
      } finally {
        requestInProgress = false;
      }
    };

    void load(true);

    const timer = globalThis.setInterval(
      () => {
        void load(false);
      },
      Math.max(2_000, intervalMs),
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
    historyLimit,
    retryToken,
    scannerWindow,
    symbol,
  ]);

  return {
    snapshot,
    status,
    error,
    retry,
  };
}
