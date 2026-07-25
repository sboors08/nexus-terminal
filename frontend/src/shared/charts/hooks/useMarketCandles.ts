import type {
  Candle,
} from '../../api/contracts.js';
import {
  useApiQuery,
  type ApiQueryResult,
} from '../../api/useApiQuery.js';
import {
  buildMarketCandlesUrl,
  fetchMarketCandles,
  type MarketCandleTimeframe,
} from '../api/marketCandles.js';

export interface UseMarketCandlesOptions {
  baseUrl?: string;
  symbol: string;
  timeframe: MarketCandleTimeframe;
}

export function useMarketCandles(
  options: UseMarketCandlesOptions,
): ApiQueryResult<Candle[]> {
  const key =
    buildMarketCandlesUrl(
      options,
    );

  return useApiQuery(
    key,
    () =>
      fetchMarketCandles(
        options,
      ),
  );
}