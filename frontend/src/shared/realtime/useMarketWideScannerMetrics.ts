import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  fetchMarketWideScannerMetrics,
  indexMarketWideScannerMetrics,
} from './marketWideScannerMetrics.js';
import type {
  MarketScannerMetrics,
} from './dashboardScannerMetrics.js';
import type {
  ScannerWindow,
} from '../config/tradingPresets.js';

export type MarketWideScannerMetricsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseMarketWideScannerMetricsOptions {
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
  scannerWindow?: ScannerWindow;
}

export interface UseMarketWideScannerMetricsResult {
  metrics: Readonly<
    Record<
      string,
      MarketScannerMetrics
    >
  >;
  status:
    MarketWideScannerMetricsStatus;
  error: Error | null;
  lastUpdatedAt: string | null;
  retry: () => void;
}

export function useMarketWideScannerMetrics(
  options:
    UseMarketWideScannerMetricsOptions = {},
): UseMarketWideScannerMetricsResult {
  const {
    baseUrl,
    enabled = true,
    intervalMs = 2_000,
    scannerWindow = '1m',
  } = options;

  const [metrics, setMetrics] =
    useState<
      Record<
        string,
        MarketScannerMetrics
      >
    >({});

  const [status, setStatus] =
    useState<
      MarketWideScannerMetricsStatus
    >(
      enabled
        ? 'loading'
        : 'idle',
    );

  const [error, setError] =
    useState<Error | null>(
      null,
    );

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<
    string | null
  >(null);

  const [
    retryToken,
    setRetryToken,
  ] = useState(0);

  const retry =
    useCallback(() => {
      setRetryToken(
        (current) =>
          current + 1,
      );
    }, []);

  useEffect(() => {
    if (!enabled) {
      setMetrics({});
      setStatus('idle');
      setError(null);
      setLastUpdatedAt(null);

      return;
    }

    let cancelled = false;
    let requestInProgress =
      false;

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
          await fetchMarketWideScannerMetrics({
            baseUrl,
            scannerWindow,
          });

        if (cancelled) {
          return;
        }

        setMetrics(
          indexMarketWideScannerMetrics(
            response,
          ),
        );

        setStatus('ready');
        setError(null);

        setLastUpdatedAt(
          new Date()
            .toISOString(),
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
                'Market-wide scanner metrics request failed',
              ),
        );
      } finally {
        requestInProgress =
          false;
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

      globalThis.clearInterval(
        timer,
      );
    };
  }, [
    baseUrl,
    enabled,
    intervalMs,
    retryToken,
    scannerWindow,
  ]);

  return {
    metrics,
    status,
    error,
    lastUpdatedAt,
    retry,
  };
}