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
  endTime?: string,
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

  const endMilliseconds =
    endTime === undefined
      ? Number.POSITIVE_INFINITY
      : Date.parse(endTime);

  if (
    !Number.isFinite(endMilliseconds)
    && endMilliseconds
      !== Number.POSITIVE_INFINITY
  ) {
    return [];
  }

  if (
    endMilliseconds
    < startMilliseconds
  ) {
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

    const closeMilliseconds =
      Date.parse(candle.closeTime);

    if (
      !Number.isFinite(openMilliseconds)
      || !Number.isFinite(closeMilliseconds)
      || closeMilliseconds
        > endMilliseconds
    ) {
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
