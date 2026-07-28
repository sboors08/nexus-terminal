import type {
  OrderBookDepthBucket,
  OrderBookDepthClientLifecycleState,
  OrderBookDepthRuntimeSnapshot,
  OrderBookDepthRuntimeStatus,
} from './orderBookDepthClient';

export type WorkspaceLiquidityFreshnessState =
  | 'collecting'
  | 'live'
  | 'stale'
  | 'error';

export type WorkspaceLiquidityFreshnessTone =
  | 'pending'
  | 'live'
  | 'warning'
  | 'error';

export interface WorkspaceLiquidityFreshness {
  state:
    WorkspaceLiquidityFreshnessState;
  tone:
    WorkspaceLiquidityFreshnessTone;
  label: string;
  message: string;
  lastUpdatedLabel: string;
}

export interface WorkspaceLiquidityRow {
  side:
    | 'bid'
    | 'ask';
  price: number;
  quantity: number;
  quoteValue: number;
  levelsCount: number;
  distancePct:
    number
    | null;
  intensity: number;
}

export interface WorkspaceLiquidityMapView {
  symbol:
    string
    | null;
  freshness:
    WorkspaceLiquidityFreshness;
  asks:
    WorkspaceLiquidityRow[];
  bids:
    WorkspaceLiquidityRow[];
  synchronized: boolean;
  midpoint:
    number
    | null;
  spread:
    number
    | null;
  spreadPct:
    number
    | null;
  bidDepthQuote: number;
  askDepthQuote: number;
  totalDepthQuote: number;
  imbalancePct:
    number
    | null;
  buyerPressurePct:
    number
    | null;
  lastUpdateId:
    number
    | null;
  updatedAt:
    string
    | null;
  ageMs:
    number
    | null;
  staleAfterMs:
    number
    | null;
  lastError:
    string
    | null;
}

export interface BuildWorkspaceLiquidityMapOptions {
  snapshot:
    OrderBookDepthRuntimeSnapshot
    | null
    | undefined;
  lifecycleState:
    OrderBookDepthClientLifecycleState;
  status:
    OrderBookDepthRuntimeStatus
    | null;
  error:
    Error
    | null;
  now?: number;
  maxRowsPerSide?: number;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function formatAge(
  ageMs:
    number
    | null,
): string {
  if (
    ageMs === null
  ) {
    return 'обновление ожидается';
  }

  if (
    ageMs < 1_000
  ) {
    return 'обновлено сейчас';
  }

  const seconds =
    Math.floor(
      ageMs
      / 1_000,
    );

  if (
    seconds < 60
  ) {
    return (
      `обновлено ${seconds} с назад`
    );
  }

  const minutes =
    Math.floor(
      seconds
      / 60,
    );

  return (
    `обновлено ${minutes} мин назад`
  );
}

function resolveAgeMs(
  snapshot:
    OrderBookDepthRuntimeSnapshot,
  now: number,
): number | null {
  if (
    snapshot.updatedAt
    !== null
  ) {
    const updatedAtMs =
      Date.parse(
        snapshot.updatedAt,
      );

    if (
      Number.isFinite(
        updatedAtMs,
      )
    ) {
      return Math.max(
        0,
        now
        - updatedAtMs,
      );
    }
  }

  return snapshot.ageMs;
}

function toBuckets(
  snapshot:
    OrderBookDepthRuntimeSnapshot,
): {
  bids:
    OrderBookDepthBucket[];
  asks:
    OrderBookDepthBucket[];
} {
  if (
    snapshot.buckets
  ) {
    return {
      bids:
        snapshot.buckets.bids.map(
          (bucket) => ({
            ...bucket,
          }),
        ),
      asks:
        snapshot.buckets.asks.map(
          (bucket) => ({
            ...bucket,
          }),
        ),
    };
  }

  return {
    bids:
      snapshot.bids.map(
        (level) => ({
          side:
            'bid',
          price:
            level.price,
          quantity:
            level.quantity,
          quoteValue:
            level.quoteValue,
          levelsCount:
            1,
        }),
      ),
    asks:
      snapshot.asks.map(
        (level) => ({
          side:
            'ask',
          price:
            level.price,
          quantity:
            level.quantity,
          quoteValue:
            level.quoteValue,
          levelsCount:
            1,
        }),
      ),
  };
}

function toRows(
  buckets:
    readonly OrderBookDepthBucket[],
  midpoint:
    number
    | null,
  maxQuoteValue: number,
): WorkspaceLiquidityRow[] {
  return buckets.map(
    (bucket) => ({
      side:
        bucket.side,
      price:
        bucket.price,
      quantity:
        bucket.quantity,
      quoteValue:
        bucket.quoteValue,
      levelsCount:
        bucket.levelsCount,
      distancePct:
        midpoint !== null
        && midpoint > 0
          ? (
              (
                bucket.price
                - midpoint
              )
              / midpoint
            )
            * 100
          : null,
      intensity:
        maxQuoteValue > 0
          ? clamp(
              bucket.quoteValue
              / maxQuoteValue,
              0,
              1,
            )
          : 0,
    }),
  );
}

function resolveFreshness(
  options:
    BuildWorkspaceLiquidityMapOptions,
  snapshot:
    OrderBookDepthRuntimeSnapshot
    | null,
  ageMs:
    number
    | null,
  hasRows: boolean,
): WorkspaceLiquidityFreshness {
  const connectionInterrupted =
    options.lifecycleState
      === 'reconnecting'
    || options.lifecycleState
      === 'error'
    || options.lifecycleState
      === 'closed'
    || options.status?.state
      === 'reconnecting'
    || options.status?.state
      === 'stopped';

  if (
    snapshot
    && hasRows
    && (
      snapshot.state
        === 'stale'
      || connectionInterrupted
      || (
        ageMs !== null
        && ageMs
          > snapshot.staleAfterMs
      )
    )
  ) {
    return {
      state:
        'stale',
      tone:
        'warning',
      label:
        'STALE',
      message:
        'Показывается последний полученный стакан. Обновления временно прерваны.',
      lastUpdatedLabel:
        formatAge(
          ageMs,
        ),
    };
  }

  if (
    snapshot
    && snapshot.state
      === 'live'
    && snapshot.synchronized
    && hasRows
  ) {
    return {
      state:
        'live',
      tone:
        'live',
      label:
        'LIVE',
      message:
        'Локальный стакан синхронизирован с Binance Futures.',
      lastUpdatedLabel:
        formatAge(
          ageMs,
        ),
    };
  }

  if (
    snapshot?.state
      === 'error'
    || (
      !snapshot
      && (
        options.lifecycleState
          === 'error'
        || options.error
          !== null
      )
    )
  ) {
    return {
      state:
        'error',
      tone:
        'error',
      label:
        'ERROR',
      message:
        snapshot?.lastError
        ?? options.error?.message
        ?? options.status?.lastError
        ?? 'Стакан Binance временно недоступен.',
      lastUpdatedLabel:
        formatAge(
          ageMs,
        ),
    };
  }

  return {
    state:
      'collecting',
    tone:
      'pending',
    label:
      'COLLECTING',
    message:
      'Получаем depth-события и синхронизируем REST snapshot.',
    lastUpdatedLabel:
      formatAge(
        ageMs,
      ),
  };
}

export function resolveWorkspaceLiquidityBucketSize(
  referencePrice: number,
): number {
  if (
    !Number.isFinite(
      referencePrice,
    )
    || referencePrice <= 0
  ) {
    return 1;
  }

  const target =
    referencePrice
    * 0.00015;

  const exponent =
    Math.floor(
      Math.log10(
        target,
      ),
    );

  const magnitude =
    10 ** exponent;

  const normalized =
    target
    / magnitude;

  const niceNormalized =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 5
          ? 5
          : 10;

  return Number(
    (
      niceNormalized
      * magnitude
    ).toPrecision(
      12,
    ),
  );
}

export function buildWorkspaceLiquidityMap(
  options:
    BuildWorkspaceLiquidityMapOptions,
): WorkspaceLiquidityMapView {
  const snapshot =
    options.snapshot
    ?? null;

  const now =
    options.now
    ?? Date.now();

  const maxRowsPerSide =
    options.maxRowsPerSide
    ?? 5;

  if (
    !Number.isSafeInteger(
      maxRowsPerSide,
    )
    || maxRowsPerSide < 1
    || maxRowsPerSide > 20
  ) {
    throw new Error(
      'maxRowsPerSide must be an integer between 1 and 20',
    );
  }

  const buckets =
    snapshot
      ? toBuckets(
          snapshot,
        )
      : {
          bids: [],
          asks: [],
        };

  const visibleAsks =
    buckets.asks
      .slice(
        0,
        maxRowsPerSide,
      )
      .reverse();

  const visibleBids =
    buckets.bids
      .slice(
        0,
        maxRowsPerSide,
      );

  const maxQuoteValue =
    Math.max(
      0,
      ...visibleAsks.map(
        (bucket) =>
          bucket.quoteValue,
      ),
      ...visibleBids.map(
        (bucket) =>
          bucket.quoteValue,
      ),
    );

  const midpoint =
    snapshot?.metrics.midpoint
    ?? null;

  const asks =
    toRows(
      visibleAsks,
      midpoint,
      maxQuoteValue,
    );

  const bids =
    toRows(
      visibleBids,
      midpoint,
      maxQuoteValue,
    );

  const ageMs =
    snapshot
      ? resolveAgeMs(
          snapshot,
          now,
        )
      : null;

  const hasRows =
    asks.length > 0
    || bids.length > 0;

  const freshness =
    resolveFreshness(
      options,
      snapshot,
      ageMs,
      hasRows,
    );

  const imbalancePct =
    snapshot?.metrics
      .imbalancePct
    ?? null;

  return {
    symbol:
      snapshot?.symbol
      ?? null,
    freshness,
    asks,
    bids,
    synchronized:
      snapshot?.synchronized
      ?? false,
    midpoint,
    spread:
      snapshot?.metrics.spread
      ?? null,
    spreadPct:
      snapshot?.metrics.spreadPct
      ?? null,
    bidDepthQuote:
      snapshot?.metrics.bidDepthQuote
      ?? 0,
    askDepthQuote:
      snapshot?.metrics.askDepthQuote
      ?? 0,
    totalDepthQuote:
      snapshot?.metrics.totalDepthQuote
      ?? 0,
    imbalancePct,
    buyerPressurePct:
      imbalancePct === null
        ? null
        : clamp(
            (
              imbalancePct
              + 100
            )
            / 2,
            0,
            100,
          ),
    lastUpdateId:
      snapshot?.lastUpdateId
      ?? null,
    updatedAt:
      snapshot?.updatedAt
      ?? null,
    ageMs,
    staleAfterMs:
      snapshot?.staleAfterMs
      ?? null,
    lastError:
      snapshot?.lastError
      ?? options.status?.lastError
      ?? options.error?.message
      ?? null,
  };
}
