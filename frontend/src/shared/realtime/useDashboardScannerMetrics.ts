import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchMarketScannerMetrics,
  normalizeMarketScannerSymbol,
  type MarketScannerMetrics,
} from './dashboardScannerMetrics';

export type DashboardScannerMetricsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseDashboardScannerMetricsOptions {
  symbols: readonly string[];
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
}

export interface UseDashboardScannerMetricsResult {
  metrics: Readonly<
    Record<string, MarketScannerMetrics>
  >;
  status: DashboardScannerMetricsStatus;
  error: Error | null;
  lastUpdatedAt: string | null;
  retry: () => void;
}

export function useDashboardScannerMetrics(
  options: UseDashboardScannerMetricsOptions,
): UseDashboardScannerMetricsResult {
  const {
    symbols,
    baseUrl,
    enabled = true,
    intervalMs = 2_000,
  } = options;

  const symbolsKey = symbols.join(',');

  const normalizedSymbols = useMemo(
    () => [
      ...new Set(
        symbols
          .map(normalizeMarketScannerSymbol),
      ),
    ],
    [symbolsKey],
  );

  const normalizedSymbolsKey =
    normalizedSymbols.join(',');

  const [metrics, setMetrics] = useState<
    Record<string, MarketScannerMetrics>
  >({});

  const [status, setStatus] =
    useState<DashboardScannerMetricsStatus>(
      enabled ? 'loading' : 'idle',
    );

  const [error, setError] =
    useState<Error | null>(null);

  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] = useState<string | null>(null);

  const [retryToken, setRetryToken] =
    useState(0);

  const retry = useCallback(() => {
    setRetryToken(
      (current) => current + 1,
    );
  }, []);

  useEffect(() => {
    if (
      !enabled
      || normalizedSymbols.length === 0
    ) {
      setMetrics({});
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
      if (requestInProgress) return;

      requestInProgress = true;

      if (initial) {
        setStatus('loading');
      }

      try {
        const response =
          await fetchMarketScannerMetrics({
            baseUrl,
            symbols: normalizedSymbols,
            scannerWindow: '1m',
          });

        if (cancelled) return;

        const nextMetrics: Record<
          string,
          MarketScannerMetrics
        > = {};

        for (const metric of response) {
          nextMetrics[metric.symbol] =
            metric;
        }

        setMetrics(nextMetrics);
        setStatus('ready');
        setError(null);
        setLastUpdatedAt(
          new Date().toISOString(),
        );
      } catch (caughtError: unknown) {
        if (cancelled) return;

        setStatus('error');
        setError(
          caughtError instanceof Error
            ? caughtError
            : new Error(
                'Market scanner metrics request failed',
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
      Math.max(1_000, intervalMs),
    );

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [
    baseUrl,
    enabled,
    intervalMs,
    normalizedSymbolsKey,
    retryToken,
  ]);

  return {
    metrics,
    status,
    error,
    lastUpdatedAt,
    retry,
  };
}
