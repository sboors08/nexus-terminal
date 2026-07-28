import type {
  OrderBookDepthBucket,
  OrderBookDepthLevel,
  OrderBookDepthMetrics,
  OrderBookDepthSide,
  OrderBookDepthView,
} from './order-book-depth.types.js';

export interface OrderBookDepthMetricsOptions {
  depthRangePct?: number;
}

export interface OrderBookDepthBucketOptions {
  bucketSize: number;
  maxBucketsPerSide?: number;
}

function assertPositiveFinite(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(
      value,
    )
    || value <= 0
  ) {
    throw new Error(
      `${name} must be a positive finite number`,
    );
  }
}

function round(
  value: number,
  digits: number,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function sumQuoteValue(
  levels:
    readonly OrderBookDepthLevel[],
): number {
  return levels.reduce(
    (
      total,
      level,
    ) =>
      total
      + level.quoteValue,
    0,
  );
}

function bucketPrecision(
  bucketSize: number,
): number {
  const text =
    bucketSize.toString();

  if (
    text.includes(
      'e-',
    )
  ) {
    const exponent =
      Number(
        text.split(
          'e-',
        )[1],
      );

    return Number.isFinite(
      exponent,
    )
      ? Math.min(
          12,
          exponent,
        )
      : 8;
  }

  const decimal =
    text.split(
      '.',
    )[1];

  return Math.min(
    12,
    decimal?.length
    ?? 0,
  );
}

function bucketSide(
  side:
    OrderBookDepthSide,
  levels:
    readonly OrderBookDepthLevel[],
  bucketSize: number,
  maxBucketsPerSide: number,
): OrderBookDepthBucket[] {
  const buckets =
    new Map<
      number,
      {
        quantity: number;
        quoteValue: number;
        levelsCount: number;
      }
    >();

  for (
    const level
    of levels
  ) {
    const rawIndex =
      level.price
      / bucketSize;

    const bucketIndex =
      side === 'bid'
        ? Math.floor(
            rawIndex
            + Number.EPSILON,
          )
        : Math.ceil(
            rawIndex
            - Number.EPSILON,
          );

    const current =
      buckets.get(
        bucketIndex,
      )
      ?? {
        quantity: 0,
        quoteValue: 0,
        levelsCount: 0,
      };

    current.quantity +=
      level.quantity;

    current.quoteValue +=
      level.quoteValue;

    current.levelsCount +=
      1;

    buckets.set(
      bucketIndex,
      current,
    );
  }

  const precision =
    bucketPrecision(
      bucketSize,
    );

  const multiplier =
    side === 'bid'
      ? -1
      : 1;

  return [
    ...buckets.entries(),
  ]
    .sort(
      (
        [leftIndex],
        [rightIndex],
      ) =>
        (
          leftIndex
          - rightIndex
        )
        * multiplier,
    )
    .slice(
      0,
      maxBucketsPerSide,
    )
    .map(
      (
        [
          index,
          value,
        ],
      ) => ({
        side,
        price:
          round(
            index
            * bucketSize,
            precision,
          ),
        quantity:
          value.quantity,
        quoteValue:
          value.quoteValue,
        levelsCount:
          value.levelsCount,
      }),
    );
}

export function bucketOrderBookDepth(
  view: OrderBookDepthView,
  options:
    OrderBookDepthBucketOptions,
): {
  bids:
    OrderBookDepthBucket[];
  asks:
    OrderBookDepthBucket[];
} {
  assertPositiveFinite(
    options.bucketSize,
    'bucketSize',
  );

  const maxBucketsPerSide =
    options.maxBucketsPerSide
    ?? 100;

  if (
    !Number.isSafeInteger(
      maxBucketsPerSide,
    )
    || maxBucketsPerSide < 1
  ) {
    throw new Error(
      'maxBucketsPerSide must be a positive safe integer',
    );
  }

  return {
    bids:
      bucketSide(
        'bid',
        view.bids,
        options.bucketSize,
        maxBucketsPerSide,
      ),
    asks:
      bucketSide(
        'ask',
        view.asks,
        options.bucketSize,
        maxBucketsPerSide,
      ),
  };
}

export function calculateOrderBookDepthMetrics(
  view: OrderBookDepthView,
  options:
    OrderBookDepthMetricsOptions = {},
): OrderBookDepthMetrics {
  const depthRangePct =
    options.depthRangePct
    ?? 0.2;

  assertPositiveFinite(
    depthRangePct,
    'depthRangePct',
  );

  const bestBid =
    view.bids[0]
      ?.price
    ?? null;

  const bestAsk =
    view.asks[0]
      ?.price
    ?? null;

  const hasTwoSidedBook =
    bestBid !== null
    && bestAsk !== null
    && bestBid > 0
    && bestAsk > 0;

  const midpoint =
    hasTwoSidedBook
      ? (
          bestBid
          + bestAsk
        )
        / 2
      : null;

  const spread =
    hasTwoSidedBook
      ? Math.max(
          0,
          bestAsk
          - bestBid,
        )
      : null;

  const spreadPct =
    midpoint !== null
    && spread !== null
    && midpoint > 0
      ? (
          spread
          / midpoint
        )
        * 100
      : null;

  const rangeRatio =
    depthRangePct
    / 100;

  const bidDepth =
    midpoint === null
      ? []
      : view.bids.filter(
          (level) =>
            level.price
            >= midpoint
              * (
                1
                - rangeRatio
              ),
        );

  const askDepth =
    midpoint === null
      ? []
      : view.asks.filter(
          (level) =>
            level.price
            <= midpoint
              * (
                1
                + rangeRatio
              ),
        );

  const bidDepthQuote =
    sumQuoteValue(
      bidDepth,
    );

  const askDepthQuote =
    sumQuoteValue(
      askDepth,
    );

  const totalDepthQuote =
    bidDepthQuote
    + askDepthQuote;

  const imbalancePct =
    totalDepthQuote > 0
      ? (
          (
            bidDepthQuote
            - askDepthQuote
          )
          / totalDepthQuote
        )
        * 100
      : null;

  return {
    symbol:
      view.symbol,
    synchronized:
      view.synchronized,
    bestBid,
    bestAsk,
    midpoint,
    spread,
    spreadPct,
    depthRangePct,
    bidDepthQuote,
    askDepthQuote,
    totalDepthQuote,
    imbalancePct,
    updatedAt:
      view.updatedAt,
  };
}
