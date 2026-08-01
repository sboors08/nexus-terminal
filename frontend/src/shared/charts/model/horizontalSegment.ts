import type {
  LineData,
  UTCTimestamp,
} from 'lightweight-charts';

import type {
  Candle,
} from '../../api/contracts.js';
import {
  toUtcTimestamp,
} from './candleMapping.js';

export function buildNexusHorizontalSegmentData(
  candles: readonly Candle[],
  startTime: string,
  price: number,
): LineData<UTCTimestamp>[] {
  if (
    !Number.isFinite(price)
    || price <= 0
  ) {
    return [];
  }

  const startMilliseconds =
    Date.parse(startTime);

  if (!Number.isFinite(startMilliseconds)) {
    return [];
  }

  let firstEligibleCandle:
    Candle | null = null;

  let latestClosedCandle:
    Candle | null = null;

  for (const candle of candles) {
    if (candle.isClosed === false) {
      continue;
    }

    const openMilliseconds =
      Date.parse(candle.openTime);

    if (!Number.isFinite(openMilliseconds)) {
      continue;
    }

    if (
      !latestClosedCandle
      || openMilliseconds
        > Date.parse(
          latestClosedCandle.openTime,
        )
    ) {
      latestClosedCandle =
        candle;
    }

    if (
      openMilliseconds
        >= startMilliseconds
      && (
        !firstEligibleCandle
        || openMilliseconds
          < Date.parse(
            firstEligibleCandle.openTime,
          )
      )
    ) {
      firstEligibleCandle =
        candle;
    }
  }

  if (
    !firstEligibleCandle
    || !latestClosedCandle
  ) {
    return [];
  }

  const start =
    toUtcTimestamp(
      firstEligibleCandle.openTime,
    );

  const end =
    toUtcTimestamp(
      latestClosedCandle.openTime,
    );

  if (end < start) {
    return [];
  }

  if (end === start) {
    return [
      {
        time: start,
        value: price,
      },
    ];
  }

  return [
    {
      time: start,
      value: price,
    },
    {
      time: end,
      value: price,
    },
  ];
}
