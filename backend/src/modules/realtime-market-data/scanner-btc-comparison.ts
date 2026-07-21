export interface ScannerPriceSample {
  timestampMs: number;
  closePrice: number;
}

const DEFAULT_MINIMUM_CORRELATION_RETURNS = 3;

function normalizePriceSamples(
  samples: readonly ScannerPriceSample[],
): ScannerPriceSample[] {
  const byTimestamp =
    new Map<number, number>();

  for (const sample of samples) {
    if (
      !Number.isFinite(sample.timestampMs)
      || !Number.isFinite(sample.closePrice)
      || sample.closePrice <= 0
    ) {
      continue;
    }

    byTimestamp.set(
      sample.timestampMs,
      sample.closePrice,
    );
  }

  return [...byTimestamp.entries()]
    .sort(
      ([leftTimestamp], [rightTimestamp]) =>
        leftTimestamp - rightTimestamp,
    )
    .map(
      ([timestampMs, closePrice]) => ({
        timestampMs,
        closePrice,
      }),
    );
}

function calculateReturn(
  previousPrice: number,
  currentPrice: number,
): number {
  return (
    currentPrice - previousPrice
  ) / previousPrice;
}

export function calculatePearsonCorrelation(
  leftValues: readonly number[],
  rightValues: readonly number[],
): number | null {
  if (
    leftValues.length !== rightValues.length
    || leftValues.length < 2
  ) {
    return null;
  }

  const count = leftValues.length;

  const leftMean =
    leftValues.reduce(
      (sum, value) => sum + value,
      0,
    ) / count;

  const rightMean =
    rightValues.reduce(
      (sum, value) => sum + value,
      0,
    ) / count;

  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < count; index += 1) {
    const leftDelta =
      leftValues[index]! - leftMean;

    const rightDelta =
      rightValues[index]! - rightMean;

    covariance +=
      leftDelta * rightDelta;

    leftVariance +=
      leftDelta * leftDelta;

    rightVariance +=
      rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(
    leftVariance * rightVariance,
  );

  if (
    !Number.isFinite(denominator)
    || denominator <= Number.EPSILON
  ) {
    return null;
  }

  const correlation =
    covariance / denominator;

  if (!Number.isFinite(correlation)) {
    return null;
  }

  return Math.max(
    -1,
    Math.min(1, correlation),
  );
}

export function calculateScannerBtcCorrelation(
  symbolSamples:
    readonly ScannerPriceSample[],
  btcSamples:
    readonly ScannerPriceSample[],
  minimumReturns =
    DEFAULT_MINIMUM_CORRELATION_RETURNS,
): number | null {
  if (
    !Number.isInteger(minimumReturns)
    || minimumReturns < 2
  ) {
    throw new Error(
      'Minimum correlation returns must be an integer greater than one',
    );
  }

  const normalizedSymbolSamples =
    normalizePriceSamples(symbolSamples);

  const normalizedBtcSamples =
    normalizePriceSamples(btcSamples);

  const symbolPricesByTimestamp =
    new Map(
      normalizedSymbolSamples.map(
        (sample) => [
          sample.timestampMs,
          sample.closePrice,
        ],
      ),
    );

  const btcPricesByTimestamp =
    new Map(
      normalizedBtcSamples.map(
        (sample) => [
          sample.timestampMs,
          sample.closePrice,
        ],
      ),
    );

  const commonTimestamps =
    [...symbolPricesByTimestamp.keys()]
      .filter(
        (timestampMs) =>
          btcPricesByTimestamp.has(
            timestampMs,
          ),
      )
      .sort(
        (left, right) => left - right,
      );

  if (
    commonTimestamps.length
    < minimumReturns + 1
  ) {
    return null;
  }

  const symbolReturns: number[] = [];
  const btcReturns: number[] = [];

  for (
    let index = 1;
    index < commonTimestamps.length;
    index += 1
  ) {
    const previousTimestamp =
      commonTimestamps[index - 1]!;

    const currentTimestamp =
      commonTimestamps[index]!;

    const previousSymbolPrice =
      symbolPricesByTimestamp.get(
        previousTimestamp,
      )!;

    const currentSymbolPrice =
      symbolPricesByTimestamp.get(
        currentTimestamp,
      )!;

    const previousBtcPrice =
      btcPricesByTimestamp.get(
        previousTimestamp,
      )!;

    const currentBtcPrice =
      btcPricesByTimestamp.get(
        currentTimestamp,
      )!;

    symbolReturns.push(
      calculateReturn(
        previousSymbolPrice,
        currentSymbolPrice,
      ),
    );

    btcReturns.push(
      calculateReturn(
        previousBtcPrice,
        currentBtcPrice,
      ),
    );
  }

  if (
    symbolReturns.length < minimumReturns
  ) {
    return null;
  }

  return calculatePearsonCorrelation(
    symbolReturns,
    btcReturns,
  );
}

export function calculateScannerRelativeStrengthPct(
  symbolPriceChangePct: number | null,
  btcPriceChangePct: number | null,
): number | null {
  if (
    symbolPriceChangePct === null
    || btcPriceChangePct === null
    || !Number.isFinite(
      symbolPriceChangePct,
    )
    || !Number.isFinite(
      btcPriceChangePct,
    )
  ) {
    return null;
  }

  return (
    symbolPriceChangePct
    - btcPriceChangePct
  );
}