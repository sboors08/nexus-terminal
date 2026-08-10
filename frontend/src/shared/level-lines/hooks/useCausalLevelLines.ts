import {
  useMemo,
} from 'react';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  fetchLevelLines,
  LEVEL_LINES_TIMEFRAMES,
  type LevelLinesSnapshot,
  type LevelLinesTimeframe,
} from '../../api/runtime/levelLinesApi.js';
import {
  useApiQuery,
  type ApiQueryStatus,
} from '../../api/useApiQuery.js';
import {
  buildCausalLevelLinesView,
  type CausalLevelLinesView,
} from '../model/causalLevelLines.js';

const REFRESH_INTERVAL_MS = 15_000;

export interface UseCausalLevelLinesOptions {
  readonly symbol: string;
  readonly timeframe: string;
  readonly candles: readonly Candle[];
}

export interface UseCausalLevelLinesResult
  extends CausalLevelLinesView {
  readonly supported: boolean;
  readonly status: ApiQueryStatus;
  readonly snapshot: LevelLinesSnapshot | null;
  readonly error: Error | null;
  readonly retry: () => void;
}

function isSupportedTimeframe(
  value: string,
): value is LevelLinesTimeframe {
  return LEVEL_LINES_TIMEFRAMES.includes(
    value as LevelLinesTimeframe,
  );
}

export function useCausalLevelLines(
  options: UseCausalLevelLinesOptions,
): UseCausalLevelLinesResult {
  const normalizedSymbol =
    options.symbol
      .trim()
      .toUpperCase();
  const supported =
    isSupportedTimeframe(
      options.timeframe,
    );
  const query =
    useApiQuery<LevelLinesSnapshot | null>(
      `causal-level-lines:${normalizedSymbol}:${options.timeframe}`,
      () =>
        supported
          ? fetchLevelLines({
              symbol:
                normalizedSymbol,
              timeframe:
                options.timeframe,
              limit:
                500,
            })
          : Promise.resolve(null),
      {
        preserveData: true,
        intervalMs:
          supported
            ? REFRESH_INTERVAL_MS
            : 0,
      },
    );
  const snapshot =
    query.data?.symbol === normalizedSymbol
    && query.data.timeframe === options.timeframe
      ? query.data
      : null;
  const view =
    useMemo(
      () =>
        buildCausalLevelLinesView(
          snapshot,
          options.candles,
        ),
      [
        options.candles,
        snapshot,
      ],
    );

  return {
    ...view,
    supported,
    status:
      query.status,
    snapshot,
    error:
      query.error,
    retry:
      query.retry,
  };
}
