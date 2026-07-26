import type {
  CandlestickData,
  HistogramData,
  UTCTimestamp,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';

export interface CandleVolumeColors {
  up: string;
  down: string;
}

export interface CandleChartData {
  candles:
    CandlestickData<UTCTimestamp>[];
  volume:
    HistogramData<UTCTimestamp>[];
}

export function toUtcTimestamp(
  value: string,
): UTCTimestamp {
  const milliseconds =
    Date.parse(value);

  if (!Number.isFinite(milliseconds)) {
    throw new Error(
      `Invalid candle timestamp: ${value}`,
    );
  }

  return Math.floor(
    milliseconds / 1000,
  ) as UTCTimestamp;
}

function sortAndDeduplicateCandles(
  candles: readonly Candle[],
): Candle[] {
  const candlesByTime =
    new Map<number, Candle>();

  for (const candle of candles) {
    candlesByTime.set(
      Date.parse(candle.openTime),
      candle,
    );
  }

  return [
    ...candlesByTime.values(),
  ].sort(
    (left, right) =>
      Date.parse(left.openTime)
      - Date.parse(right.openTime),
  );
}

export function mapCandleChartData(
  candles: readonly Candle[],
  colors: CandleVolumeColors,
): CandleChartData {
  const normalizedCandles =
    sortAndDeduplicateCandles(
      candles,
    );

  return {
    candles:
      normalizedCandles.map(
        (candle) => ({
          time:
            toUtcTimestamp(
              candle.openTime,
            ),
          open:
            candle.open,
          high:
            candle.high,
          low:
            candle.low,
          close:
            candle.close,
        }),
      ),
    volume:
      normalizedCandles.map(
        (candle) => ({
          time:
            toUtcTimestamp(
              candle.openTime,
            ),
          value:
            candle.volume,
          color:
            candle.close
            >= candle.open
              ? colors.up
              : colors.down,
        }),
      ),
  };
}