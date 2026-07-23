export type MarketVolumeSpikeStatus =
  | 'new'
  | 'growing'
  | 'stable'
  | 'fading';

export interface MarketVolumeSpikeKline {
  openTime: string;
  closeTime: string;
  open: number;
  close: number;
  quoteVolume: number;
  tradesCount: number;
}

export interface MarketVolumeSpikeOptions {
  periodMinutes: number;
  baselinePeriods: number;
  minVolumeRatio: number;
  minTradesRatio: number;
  fadingVolumeRatio: number;
  trendTolerancePct: number;
  minCurrentQuoteVolume: number;
}

export interface MarketVolumeSpike {
  symbol: string;
  status: MarketVolumeSpikeStatus;
  periodMinutes: number;
  baselinePeriods: number;
  currentQuoteVolume: number;
  previousQuoteVolume: number;
  baselineQuoteVolume: number;
  volumeRatio: number;
  previousVolumeRatio: number;
  currentTradesCount: number;
  previousTradesCount: number;
  baselineTradesCount: number;
  tradesRatio: number;
  priceChangePct: number | null;
  periodStartedAt: string;
  updatedAt: string;
}

interface AggregatedPeriod {
  quoteVolume: number;
  tradesCount: number;
  open: number;
  close: number;
  startedAt: string;
  updatedAt: string;
}

function round(
  value: number,
  digits = 4,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function median(
  values: readonly number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (left, right) =>
        left - right,
    );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 === 1
  ) {
    return sorted[middle] ?? 0;
  }

  return (
    (
      (sorted[middle - 1] ?? 0)
      + (sorted[middle] ?? 0)
    ) / 2
  );
}

function aggregatePeriod(
  klines:
    readonly MarketVolumeSpikeKline[],
): AggregatedPeriod | null {
  const first =
    klines[0];

  const last =
    klines.at(-1);

  if (
    !first
    || !last
  ) {
    return null;
  }

  const quoteVolume =
    klines.reduce(
      (total, kline) =>
        total + kline.quoteVolume,
      0,
    );

  const tradesCount =
    klines.reduce(
      (total, kline) =>
        total + kline.tradesCount,
      0,
    );

  return {
    quoteVolume:
      round(
        quoteVolume,
        8,
      ),
    tradesCount,
    open: first.open,
    close: last.close,
    startedAt: first.openTime,
    updatedAt: last.closeTime,
  };
}

function validateOptions(
  options: MarketVolumeSpikeOptions,
): void {
  const positiveIntegers = [
    options.periodMinutes,
    options.baselinePeriods,
  ];

  if (
    positiveIntegers.some(
      (value) =>
        !Number.isInteger(value)
        || value <= 0,
    )
  ) {
    throw new Error(
      'Volume spike periods must be positive integers',
    );
  }

  const positiveNumbers = [
    options.minVolumeRatio,
    options.minTradesRatio,
    options.fadingVolumeRatio,
  ];

  if (
    positiveNumbers.some(
      (value) =>
        !Number.isFinite(value)
        || value <= 0,
    )
  ) {
    throw new Error(
      'Volume spike thresholds must be positive numbers',
    );
  }

  if (
    !Number.isFinite(options.minCurrentQuoteVolume)
    || options.minCurrentQuoteVolume < 0
  ) {
    throw new Error(
      'Volume spike minimum current quote volume must be a non-negative number',
    );
  }

  if (
    !Number.isFinite(
      options.trendTolerancePct,
    )
    || options.trendTolerancePct < 0
  ) {
    throw new Error(
      'Volume spike trend tolerance must be non-negative',
    );
  }
}

function hasConsecutiveMinuteKlines(
  klines:
    readonly MarketVolumeSpikeKline[],
): boolean {
  for (
    let index = 0;
    index < klines.length;
    index += 1
  ) {
    const current =
      klines[index];

    if (!current) {
      return false;
    }

    const currentOpenTimeMs =
      Date.parse(
        current.openTime,
      );

    if (
      !Number.isFinite(
        currentOpenTimeMs,
      )
    ) {
      return false;
    }

    if (index === 0) {
      continue;
    }

    const previous =
      klines[index - 1];

    if (!previous) {
      return false;
    }

    const previousOpenTimeMs =
      Date.parse(
        previous.openTime,
      );

    if (
      !Number.isFinite(
        previousOpenTimeMs,
      )
      || currentOpenTimeMs
        - previousOpenTimeMs
        !== 60_000
    ) {
      return false;
    }
  }

  return true;
}

export function calculateMarketVolumeSpike(
  symbol: string,
  sourceKlines:
    readonly MarketVolumeSpikeKline[],
  options: MarketVolumeSpikeOptions,
): MarketVolumeSpike | null {
  validateOptions(options);

  const normalizedSymbol =
    symbol.trim().toUpperCase();

  if (normalizedSymbol.length === 0) {
    throw new Error(
      'Volume spike symbol is required',
    );
  }

  const requiredPeriods =
    options.baselinePeriods + 2;

  const requiredKlines =
    requiredPeriods
    * options.periodMinutes;

  if (
    sourceKlines.length
    < requiredKlines
  ) {
    return null;
  }

  const klines =
    [...sourceKlines]
      .sort(
        (left, right) =>
          Date.parse(left.openTime)
          - Date.parse(right.openTime),
      )
      .slice(
        -requiredKlines,
      );

  if (
    !hasConsecutiveMinuteKlines(
      klines,
    )
  ) {
    return null;
  }

  const periods:
    AggregatedPeriod[] = [];

  for (
    let offset = 0;
    offset < klines.length;
    offset += options.periodMinutes
  ) {
    const period =
      aggregatePeriod(
        klines.slice(
          offset,
          offset
          + options.periodMinutes,
        ),
      );

    if (!period) {
      return null;
    }

    periods.push(period);
  }

  const current =
    periods.at(-1);

  const previous =
    periods.at(-2);

  const baseline =
    periods.slice(
      0,
      options.baselinePeriods,
    );

  if (
    !current
    || !previous
    || baseline.length
      !== options.baselinePeriods
  ) {
    return null;
  }

  const baselineQuoteVolume =
    median(
      baseline.map(
        (period) =>
          period.quoteVolume,
      ),
    );

  const baselineTradesCount =
    median(
      baseline.map(
        (period) =>
          period.tradesCount,
      ),
    );

  if (
    baselineQuoteVolume <= 0
    || baselineTradesCount <= 0
  ) {
    return null;
  }

  const volumeRatio =
    round(
      current.quoteVolume
      / baselineQuoteVolume,
    );

  const previousVolumeRatio =
    round(
      previous.quoteVolume
      / baselineQuoteVolume,
    );

  const tradesRatio =
    round(
      current.tradesCount
      / baselineTradesCount,
    );

  const hasMinimumActivity =
    current.quoteVolume
      >= options.minCurrentQuoteVolume
    && tradesRatio
      >= options.minTradesRatio;

  const isCurrentSpike =
    hasMinimumActivity
    && volumeRatio
      >= options.minVolumeRatio;

  const isFadingSpike =
    hasMinimumActivity
    && previousVolumeRatio
      >= options.minVolumeRatio
    && volumeRatio
      >= options.fadingVolumeRatio;

  if (
    !isCurrentSpike
    && !isFadingSpike
  ) {
    return null;
  }

  let status:
    MarketVolumeSpikeStatus;

  if (
    previousVolumeRatio
    < options.minVolumeRatio
  ) {
    status = 'new';
  } else {
    const trendPct =
      previousVolumeRatio > 0
        ? (
            (
              volumeRatio
              - previousVolumeRatio
            )
            / previousVolumeRatio
          ) * 100
        : 0;

    if (
      trendPct
      > options.trendTolerancePct
    ) {
      status = 'growing';
    } else if (
      trendPct
      < -options.trendTolerancePct
    ) {
      status = 'fading';
    } else {
      status = 'stable';
    }
  }

  const priceChangePct =
    current.open > 0
      ? round(
          (
            (
              current.close
              - current.open
            )
            / current.open
          ) * 100,
        )
      : null;

  return {
    symbol: normalizedSymbol,
    status,
    periodMinutes:
      options.periodMinutes,
    baselinePeriods:
      options.baselinePeriods,
    currentQuoteVolume:
      current.quoteVolume,
    previousQuoteVolume:
      previous.quoteVolume,
    baselineQuoteVolume:
      round(
        baselineQuoteVolume,
        8,
      ),
    volumeRatio,
    previousVolumeRatio,
    currentTradesCount:
      current.tradesCount,
    previousTradesCount:
      previous.tradesCount,
    baselineTradesCount:
      round(
        baselineTradesCount,
        4,
      ),
    tradesRatio,
    priceChangePct,
    periodStartedAt:
      current.startedAt,
    updatedAt:
      current.updatedAt,
  };
}

export const DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS:
  MarketVolumeSpikeOptions = {
    periodMinutes: 5,
    baselinePeriods: 12,
    minVolumeRatio: 2,
    minTradesRatio: 1.5,
    fadingVolumeRatio: 1.5,
    trendTolerancePct: 10,
    minCurrentQuoteVolume: 50_000,
  };
