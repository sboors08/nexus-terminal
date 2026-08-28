export interface NexusChartPriceFormat {
  type: 'price';
  precision: number;
  minMove: number;
}

function readDecimalPlaces(
  value: number,
): number {
  for (
    let precision = 0;
    precision <= 8;
    precision += 1
  ) {
    const scale =
      10 ** precision;

    const scaledValue =
      value * scale;

    const nearestInteger =
      Math.round(
        scaledValue,
      );

    const tolerance =
      Number.EPSILON
      * Math.max(
        1,
        Math.abs(
          scaledValue,
        ),
      )
      * 32;

    if (
      Math.abs(
        scaledValue
        - nearestInteger,
      ) <= tolerance
    ) {
      return precision;
    }
  }

  return 8;
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
