import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type {
  Candle,
} from '../../api/contracts.js';
import type {
  ApiQueryResult,
} from '../../api/useApiQuery.js';
import {
  buildMarketCandlesUrl,
  fetchMarketCandles,
  MARKET_CANDLES_PAGE_SIZE,
  mergeMarketCandlePages,
  type MarketCandleTimeframe,
} from '../api/marketCandles.js';

export interface UseMarketCandlesOptions {
  baseUrl?: string;
  symbol: string;
  timeframe: MarketCandleTimeframe;
}

export interface UseMarketCandlesResult
  extends ApiQueryResult<Candle[]> {
  loadOlder: () => void;
  isLoadingOlder: boolean;
  hasMore: boolean;
  olderError: Error | null;
}

interface MarketCandlesState {
  status:
    | 'loading'
    | 'success'
    | 'error';
  data:
    | Candle[]
    | null;
  error:
    | Error
    | null;
  isLoadingOlder: boolean;
  hasMore: boolean;
  olderError:
    | Error
    | null;
}

function asError(
  value: unknown,
): Error {
  return value instanceof Error
    ? value
    : new Error(
        'Неизвестная ошибка загрузки свечей',
      );
}

export const MARKET_CANDLES_REQUEST_TIMEOUT_MS =
  15_000;

export const MARKET_CANDLES_CACHE_MAX_ENTRIES =
  24;

export interface MarketCandlesCacheEntry {
  data:
    Candle[];

  hasMore:
    boolean;
}

const marketCandlesCache =
  new Map<
    string,
    MarketCandlesCacheEntry
  >();

export function readMarketCandlesCache(
  key:
    string,
): MarketCandlesCacheEntry | null {
  const cached =
    marketCandlesCache.get(
      key,
    );

  if (!cached) {
    return null;
  }

  marketCandlesCache.delete(
    key,
  );

  marketCandlesCache.set(
    key,
    cached,
  );

  return {
    data:
      [
        ...cached.data,
      ],

    hasMore:
      cached.hasMore,
  };
}

export function writeMarketCandlesCache(
  key:
    string,

  data:
    readonly Candle[],

  hasMore:
    boolean,
): void {
  marketCandlesCache.delete(
    key,
  );

  marketCandlesCache.set(
    key,
    {
      data:
        [
          ...data,
        ],

      hasMore,
    },
  );

  while (
    marketCandlesCache.size
    > MARKET_CANDLES_CACHE_MAX_ENTRIES
  ) {
    const oldestKey =
      marketCandlesCache
        .keys()
        .next()
        .value;

    if (
      typeof oldestKey
      !== 'string'
    ) {
      break;
    }

    marketCandlesCache.delete(
      oldestKey,
    );
  }
}

export function clearMarketCandlesCache(): void {
  marketCandlesCache.clear();
}

export function getMarketCandlesCacheSize(): number {
  return marketCandlesCache.size;
}

export function useMarketCandles(
  options: UseMarketCandlesOptions,
): UseMarketCandlesResult {
  const key =
    buildMarketCandlesUrl(
      options,
    );

  const [
    retryToken,
    setRetryToken,
  ] = useState(0);

  const [
    state,
    setState,
  ] = useState<MarketCandlesState>({
    status:
      'loading',
    data:
      null,
    error:
      null,
    isLoadingOlder:
      false,
    hasMore:
      true,
    olderError:
      null,
  });

  const stateRef =
    useRef(state);

  const keyRef =
    useRef(key);

  const olderRequestRef =
    useRef<AbortController | null>(
      null,
    );

  const commitState = (
    next: MarketCandlesState,
  ) => {
    stateRef.current =
      next;

    setState(next);
  };

  useEffect(() => {
    let active =
      true;

    let timedOut =
      false;

    keyRef.current =
      key;

    olderRequestRef.current
      ?.abort();

    olderRequestRef.current =
      null;

    const controller =
      new AbortController();

    const cached =
      readMarketCandlesCache(
        key,
      );

    commitState(
      cached
        ? {
            status:
              'success',

            data:
              cached.data,

            error:
              null,

            isLoadingOlder:
              false,

            hasMore:
              cached.hasMore,

            olderError:
              null,
          }
        : {
            status:
              'loading',

            data:
              null,

            error:
              null,

            isLoadingOlder:
              false,

            hasMore:
              true,

            olderError:
              null,
          },
    );

    const timeout =
      globalThis.setTimeout(
        () => {
          timedOut =
            true;

          controller.abort();
        },
        MARKET_CANDLES_REQUEST_TIMEOUT_MS,
      );

    fetchMarketCandles({
      ...options,

      limit:
        MARKET_CANDLES_PAGE_SIZE,

      signal:
        controller.signal,
    })
      .then((page) => {
        globalThis.clearTimeout(
          timeout,
        );

        if (
          !active
          || controller.signal.aborted
        ) {
          return;
        }

        const data =
          mergeMarketCandlePages(
            page,
          );

        const hasMore =
          page.length
          === MARKET_CANDLES_PAGE_SIZE;

        writeMarketCandlesCache(
          key,
          data,
          hasMore,
        );

        commitState({
          status:
            'success',

          data,

          error:
            null,

          isLoadingOlder:
            false,

          hasMore,

          olderError:
            null,
        });
      })
      .catch((error: unknown) => {
        globalThis.clearTimeout(
          timeout,
        );

        if (!active) {
          return;
        }

        if (
          controller.signal.aborted
          && !timedOut
        ) {
          return;
        }

        if (cached) {
          commitState({
            status:
              'success',

            data:
              cached.data,

            error:
              null,

            isLoadingOlder:
              false,

            hasMore:
              cached.hasMore,

            olderError:
              null,
          });

          return;
        }

        commitState({
          status:
            'error',

          data:
            null,

          error:
            timedOut
              ? new Error(
                  '\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d\u043e \u0432\u0440\u0435\u043c\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0441\u0432\u0435\u0447\u0435\u0439',
                )
              : asError(
                  error,
                ),

          isLoadingOlder:
            false,

          hasMore:
            false,

          olderError:
            null,
        });
      });

    return () => {
      active =
        false;

      globalThis.clearTimeout(
        timeout,
      );

      controller.abort();
    };
  }, [
    key,
    retryToken,
  ]);

  const loadOlder =
    useCallback(() => {
      const current =
        stateRef.current;

      const oldestCandle =
        current.data?.[0];

      if (
        current.status
          !== 'success'
        || !oldestCandle
        || current.isLoadingOlder
        || !current.hasMore
      ) {
        return;
      }

      const oldestOpenTime =
        Date.parse(
          oldestCandle.openTime,
        );

      if (
        !Number.isFinite(
          oldestOpenTime,
        )
        || oldestOpenTime <= 0
      ) {
        commitState({
          ...current,
          hasMore:
            false,
        });

        return;
      }

      const controller =
        new AbortController();

      olderRequestRef.current =
        controller;

      const requestKey =
        key;

      commitState({
        ...current,
        isLoadingOlder:
          true,
        olderError:
          null,
      });

      fetchMarketCandles({
        ...options,
        limit:
          MARKET_CANDLES_PAGE_SIZE,
        endTime:
          oldestOpenTime - 1,
        signal:
          controller.signal,
      })
        .then((page) => {
          if (
            controller.signal.aborted
            || keyRef.current
              !== requestKey
          ) {
            return;
          }

          const latestState =
            stateRef.current;

          const currentData =
            latestState.data
            ?? [];

          const merged =
            mergeMarketCandlePages(
              page,
              currentData,
            );

          const addedCount =
            merged.length
            - currentData.length;

          const hasMore =
            page.length
              === MARKET_CANDLES_PAGE_SIZE
            && addedCount > 0;

          writeMarketCandlesCache(
            requestKey,
            merged,
            hasMore,
          );

          commitState({
            status:
              'success',
            data:
              merged,
            error:
              null,
            isLoadingOlder:
              false,
            hasMore,
            olderError:
              null,
          });

          olderRequestRef.current =
            null;
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted
            || keyRef.current
              !== requestKey
          ) {
            return;
          }

          const latestState =
            stateRef.current;

          commitState({
            ...latestState,
            isLoadingOlder:
              false,
            olderError:
              asError(error),
          });

          olderRequestRef.current =
            null;
        });
    }, [
      key,
      options.baseUrl,
      options.symbol,
      options.timeframe,
    ]);

  const retry =
    useCallback(() => {
      olderRequestRef.current
        ?.abort();

      setRetryToken(
        (current) =>
          current + 1,
      );
    }, []);

  return {
    status:
      state.status,
    data:
      state.data,
    error:
      state.error,
    retry,
    loadOlder,
    isLoadingOlder:
      state.isLoadingOlder,
    hasMore:
      state.hasMore,
    olderError:
      state.olderError,
  };
}
