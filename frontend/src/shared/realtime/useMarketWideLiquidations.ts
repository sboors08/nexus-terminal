import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  fetchMarketWideLiquidations,
  type RealtimeLiquidation,
} from './marketWideLiquidations.js';

export type MarketWideLiquidationsStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface UseMarketWideLiquidationsOptions {
  baseUrl?: string;
  enabled?: boolean;
  intervalMs?: number;
  symbol?: string;
  limit?: number;
}

export interface UseMarketWideLiquidationsResult {
  liquidations:
    readonly RealtimeLiquidation[];
  status:
    MarketWideLiquidationsStatus;
  error: Error | null;
  lastUpdatedAt: string | null;
  retry: () => void;
}

export function useMarketWideLiquidations(
  options:
    UseMarketWideLiquidationsOptions = {},
): UseMarketWideLiquidationsResult {
  const {
    baseUrl,
    enabled = true,
    intervalMs = 2_000,
    symbol,
    limit = 10,
  } = options;

  const [
    liquidations,
    setLiquidations,
  ] = useState<
    RealtimeLiquidation[]
  >([]);

  const [
    status,
    setStatus,
  ] = useState<
    MarketWideLiquidationsStatus
  >(
    enabled
      ? 'loading'
      : 'idle',
  );

  const [
    error,
    setError,
  ] = useState<
    Error | null
  >(null);

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
    useCallback(
      () => {
        setRetryToken(
          (current) =>
            current + 1,
        );
      },
      [],
    );

  useEffect(
    () => {
      if (!enabled) {
        setLiquidations([]);
        setStatus('idle');
        setError(null);
        setLastUpdatedAt(null);
        return;
      }

      let cancelled = false;
      let requestInProgress =
        false;

      const load =
        async (
          initial: boolean,
        ): Promise<void> => {
          if (
            requestInProgress
          ) {
            return;
          }

          requestInProgress =
            true;

          if (initial) {
            setStatus(
              'loading',
            );
          }

          try {
            const response =
              await fetchMarketWideLiquidations({
                baseUrl,
                symbol,
                limit,
              });

            if (cancelled) {
              return;
            }

            setLiquidations(
              response,
            );

            setStatus(
              'ready',
            );

            setError(
              null,
            );

            setLastUpdatedAt(
              new Date()
                .toISOString(),
            );
          } catch (
            caughtError:
              unknown
          ) {
            if (cancelled) {
              return;
            }

            setStatus(
              'error',
            );

            setError(
              caughtError
                instanceof Error
                ? caughtError
                : new Error(
                    'Market-wide liquidations request failed',
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
        cancelled =
          true;

        globalThis.clearInterval(
          timer,
        );
      };
    },
    [
      baseUrl,
      enabled,
      intervalMs,
      limit,
      retryToken,
      symbol,
    ],
  );

  return {
    liquidations,
    status,
    error,
    lastUpdatedAt,
    retry,
  };
}
