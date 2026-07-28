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
  resolveDataFreshness,
  type DataFreshness,
} from '../../realtime/dataFreshness.js';
import {
  liveMarketCandleStore,
  mergeLiveMarketCandle,
  type LiveMarketCandle,
  type LiveMarketCandleConnectionState,
} from '../api/liveMarketCandles.js';
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
  freshness: DataFreshness;
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
  updatedAt:
    | string
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

  updatedAt:
    string;
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

    updatedAt:
      cached.updatedAt,
  };
}

export function writeMarketCandlesCache(
  key:
    string,

  data:
    readonly Candle[],

  hasMore:
    boolean,

  updatedAt:
    string = new Date()
      .toISOString(),
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

      updatedAt,
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

export const MARKET_CANDLES_STALE_AFTER_MS =
  15_000;

export interface MarketCandlesFreshnessInput {
  hasData: boolean;
  connectionState:
    LiveMarketCandleConnectionState;
  updatedAt:
    string
    | null;
  error:
    unknown;
  isOnline: boolean;
  now?: number;
}

export function resolveMarketCandlesFreshness(
  input:
    MarketCandlesFreshnessInput,
): DataFreshness {
  return resolveDataFreshness({
    hasData:
      input.hasData,
    sourceState:
      input.isOnline
        ? input.connectionState
        : 'offline',
    updatedAt:
      input.updatedAt,
    error:
      input.error,
    staleAfterMs:
      MARKET_CANDLES_STALE_AFTER_MS,
    now:
      input.now,
  });
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
    updatedAt:
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

  const liveCandleRef =
    useRef<
      LiveMarketCandle
      | null
    >(
      null,
    );

  const [
    liveFreshnessState,
    setLiveFreshnessState,
  ] = useState<{
    connectionState:
      LiveMarketCandleConnectionState;
    updatedAt:
      string
      | null;
    error:
      Error
      | null;
  }>({
    connectionState:
      'connecting',
    updatedAt:
      null,
    error:
      null,
  });

  const [
    browserOnline,
    setBrowserOnline,
  ] = useState(
    () =>
      typeof navigator
        === 'undefined'
        ? true
        : navigator.onLine,
  );

  const [
    freshnessNow,
    setFreshnessNow,
  ] = useState(
    () =>
      Date.now(),
  );

  const commitState = (
    next: MarketCandlesState,
  ) => {
    stateRef.current =
      next;

    setState(next);
  };

  useEffect(() => {
    if (
      typeof window
      === 'undefined'
    ) {
      return;
    }

    const handleOnline =
      () => {
        setBrowserOnline(
          true,
        );

        setFreshnessNow(
          Date.now(),
        );
      };

    const handleOffline =
      () => {
        setBrowserOnline(
          false,
        );

        setFreshnessNow(
          Date.now(),
        );
      };

    window.addEventListener(
      'online',
      handleOnline,
    );

    window.addEventListener(
      'offline',
      handleOffline,
    );

    return () => {
      window.removeEventListener(
        'online',
        handleOnline,
      );

      window.removeEventListener(
        'offline',
        handleOffline,
      );
    };
  }, []);

  useEffect(() => {
    const timer =
      globalThis.setInterval(
        () => {
          setFreshnessNow(
            Date.now(),
          );
        },
        5_000,
      );

    return () => {
      globalThis.clearInterval(
        timer,
      );
    };
  }, [
    key,
  ]);

  useEffect(() => {
    liveCandleRef.current =
      null;

    setLiveFreshnessState({
      connectionState:
        'connecting',
      updatedAt:
        null,
      error:
        null,
    });

    setFreshnessNow(
      Date.now(),
    );

    const unsubscribe =
      liveMarketCandleStore
        .subscribe(
          {
            baseUrl:
              options.baseUrl,
            symbol:
              options.symbol,
            timeframe:
              options.timeframe,
          },
          (
            liveState,
          ) => {
            const candle =
              liveState.candle;

            setLiveFreshnessState(
              (current) => ({
                connectionState:
                  liveState
                    .connectionState,
                updatedAt:
                  candle?.updatedAt
                  ?? current.updatedAt,
                error:
                  liveState.error,
              }),
            );

            setFreshnessNow(
              Date.now(),
            );

            if (!candle) {
              return;
            }

            liveCandleRef.current =
              candle;

            if (
              keyRef.current
              !== key
            ) {
              return;
            }

            const current =
              stateRef.current;

            if (
              current.status
                !== 'success'
              || current.data
                === null
            ) {
              return;
            }

            const data =
              mergeLiveMarketCandle(
                current.data,
                candle,
              );

            writeMarketCandlesCache(
              key,
              data,
              current.hasMore,
              candle.updatedAt,
            );

            commitState({
              ...current,
              data,
              error:
                null,
              updatedAt:
                candle.updatedAt,
            });
          },
        );

    return unsubscribe;
  }, [
    key,
    options.baseUrl,
    options.symbol,
    options.timeframe,
  ]);

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

            updatedAt:
              cached.updatedAt,

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

            updatedAt:
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

        const liveCandle =
          liveCandleRef.current;

        const data =
          liveCandle
            ? mergeLiveMarketCandle(
                page,
                liveCandle,
              )
            : mergeMarketCandlePages(
                page,
              );

        const hasMore =
          page.length
          === MARKET_CANDLES_PAGE_SIZE;

        const updatedAt =
          liveCandle?.updatedAt
          ?? new Date()
            .toISOString();

        writeMarketCandlesCache(
          key,
          data,
          hasMore,
          updatedAt,
        );

        commitState({
          status:
            'success',

          data,

          error:
            null,

          updatedAt,

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
          const liveCandle =
            liveCandleRef.current;

          const fallbackData =
            liveCandle
              ? mergeLiveMarketCandle(
                  cached.data,
                  liveCandle,
                )
              : cached.data;

          const fallbackUpdatedAt =
            liveCandle?.updatedAt
            ?? cached.updatedAt;

          writeMarketCandlesCache(
            key,
            fallbackData,
            cached.hasMore,
            fallbackUpdatedAt,
          );

          commitState({
            status:
              'success',

            data:
              fallbackData,

            error:
              timedOut
                ? new Error(
                    'Превышено время загрузки свечей',
                  )
                : asError(
                    error,
                  ),

            updatedAt:
              fallbackUpdatedAt,

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
                  'Превышено время загрузки свечей',
                )
              : asError(
                  error,
                ),

          updatedAt:
            null,

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
            latestState.updatedAt
              ?? undefined,
          );

          commitState({
            status:
              'success',
            data:
              merged,
            error:
              null,
            updatedAt:
              latestState.updatedAt,
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

  const freshness =
    resolveMarketCandlesFreshness({
      hasData:
        state.data !== null
        && state.data.length > 0,
      connectionState:
        liveFreshnessState
          .connectionState,
      updatedAt:
        liveFreshnessState
          .updatedAt
        ?? state.updatedAt,
      error:
        liveFreshnessState.error
        ?? state.error,
      isOnline:
        browserOnline,
      now:
        freshnessNow,
    });

  return {
    status:
      state.status,
    data:
      state.data,
    error:
      state.error,
    freshness,
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
