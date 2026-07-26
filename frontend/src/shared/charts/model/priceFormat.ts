export interface NexusChartPriceFormat {
  type: 'price';
  precision: number;
  minMove: number;
}

function readDecimalPlaces(
  value: number,
): number {
  const normalized =
    value
      .toFixed(12)
      .replace(
        /0+$/,
        '',
      )
      .replace(
        /\.$/,
        '',
      );

  const separatorIndex =
    normalized.indexOf(
      '.',
    );

  return separatorIndex < 0
    ? 0
    : normalized.length
      - separatorIndex
      - 1;
}

export function resolveNexusChartPriceFormat(
  values: readonly number[],
): NexusChartPriceFormat {
  const precision =
    values
      .filter(
        (value) =>
          Number.isFinite(value)
          && value > 0,
      )
      .reduce(
        (maximum, value) =>
          Math.max(
            maximum,
            readDecimalPlaces(
              value,
            ),
          ),
        2,
      );

  const normalizedPrecision =
    Math.min(
      8,
      Math.max(
        2,
        precision,
      ),
    );

  return {
    type:
      'price',

    precision:
      normalizedPrecision,

    minMove:
      10
      ** -normalizedPrecision,
  };
}
