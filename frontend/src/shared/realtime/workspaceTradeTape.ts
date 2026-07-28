import {
  resolveDataFreshness,
} from './dataFreshness.js';
import type {
  DataFreshness,
  DataFreshnessSourceState,
} from './dataFreshness';
import type {
  RealtimeClientLifecycleState,
  RealtimeConnectionState,
  RealtimeSymbolSnapshot,
  RealtimeTrade,
} from './realtimeClient';

export const WORKSPACE_TAPE_WINDOW_MS =
  10_000;

export const WORKSPACE_TAPE_STALE_AFTER_MS =
  20_000;

export const WORKSPACE_TAPE_MERGE_WINDOW_MS =
  250;

export const WORKSPACE_TAPE_PRICE_TOLERANCE_PCT =
  0.00015;

export const WORKSPACE_TAPE_MAX_PRINTS =
  60;

export const WORKSPACE_TAPE_MIN_LARGE_QUOTE_VALUE =
  1_000;

export interface WorkspaceTradeTapePrint {
  id: string;
  symbol: string;
  timestamp: string;
  price: number;
  quantity: number;
  quoteValue: number;
  tradesCount: number;
  side: 'buy' | 'sell';
  isLarge: boolean;
}

export interface WorkspaceTradeTapeMetrics {
  tradeRate: number;
  previousTradeRate: number;
  accelerationPct: number | null;
  buyQuoteValue: number;
  sellQuoteValue: number;
  totalQuoteValue: number;
  deltaQuoteValue: number;
  buySharePct: number | null;
}

export interface WorkspaceTradeTapeView {
  prints: WorkspaceTradeTapePrint[];
  metrics: WorkspaceTradeTapeMetrics;
  freshness: DataFreshness;
  largeThresholdQuoteValue: number | null;
  lastTradeAt: string | null;
}

export interface WorkspaceTradeTapeInput {
  snapshot:
    RealtimeSymbolSnapshot
    | undefined;
  lifecycleState:
    RealtimeClientLifecycleState;
  backendState:
    RealtimeConnectionState
    | null;
  error?: unknown;
  now?: number;
}

type NormalizedTrade =
  Omit<
    RealtimeTrade,
    'tradesCount'
  >
  & {
    tradesCount: number;
    timestampMs: number;
  };

interface MutableTapePrint
  extends WorkspaceTradeTapePrint {
  timestampMs: number;
  firstTradeId: string;
  lastTradeId: string;
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

function normalizeTrade(
  trade: RealtimeTrade,
): NormalizedTrade | null {
  const timestampMs =
    Date.parse(
      trade.timestamp,
    );

  if (
    typeof trade.id !== 'string'
    || trade.id.length === 0
    || typeof trade.symbol !== 'string'
    || trade.symbol.length === 0
    || !Number.isFinite(
      timestampMs,
    )
    || !Number.isFinite(
      trade.price,
    )
    || trade.price <= 0
    || !Number.isFinite(
      trade.quantity,
    )
    || trade.quantity <= 0
    || !Number.isFinite(
      trade.quoteValue,
    )
    || trade.quoteValue <= 0
    || (
      trade.side !== 'buy'
      && trade.side !== 'sell'
    )
  ) {
    return null;
  }

  const tradesCount =
    typeof trade.tradesCount
      === 'number'
    && Number.isFinite(
      trade.tradesCount,
    )
    && trade.tradesCount > 0
      ? Math.max(
          1,
          Math.trunc(
            trade.tradesCount,
          ),
        )
      : 1;

  return {
    ...trade,
    tradesCount,
    timestampMs,
  };
}

function canMergeTrade(
  previous: MutableTapePrint,
  next: NormalizedTrade,
): boolean {
  if (
    previous.symbol
      !== next.symbol
    || previous.side
      !== next.side
  ) {
    return false;
  }

  const timeGap =
    next.timestampMs
    - previous.timestampMs;

  if (
    timeGap < 0
    || timeGap
      > WORKSPACE_TAPE_MERGE_WINDOW_MS
  ) {
    return false;
  }

  const referencePrice =
    Math.max(
      previous.price,
      next.price,
    );

  const priceGapPct =
    Math.abs(
      previous.price
      - next.price,
    )
    / referencePrice;

  return priceGapPct
    <= WORKSPACE_TAPE_PRICE_TOLERANCE_PCT;
}

function percentile(
  sortedValues: readonly number[],
  ratio: number,
): number {
  if (
    sortedValues.length === 0
  ) {
    return 0;
  }

  const position =
    (
      sortedValues.length
      - 1
    )
    * ratio;

  const lowerIndex =
    Math.floor(
      position,
    );

  const upperIndex =
    Math.ceil(
      position,
    );

  const lowerValue =
    sortedValues[
      lowerIndex
    ];

  const upperValue =
    sortedValues[
      upperIndex
    ];

  if (
    lowerIndex
    === upperIndex
  ) {
    return lowerValue;
  }

  return lowerValue
    + (
      upperValue
      - lowerValue
    )
    * (
      position
      - lowerIndex
    );
}

function getLargeThreshold(
  prints:
    readonly MutableTapePrint[],
): number | null {
  if (
    prints.length === 0
  ) {
    return null;
  }

  const values =
    prints
      .map(
        (print) =>
          print.quoteValue,
      )
      .sort(
        (left, right) =>
          left - right,
      );

  const median =
    percentile(
      values,
      0.5,
    );

  const highTail =
    percentile(
      values,
      0.9,
    );

  return round(
    Math.max(
      WORKSPACE_TAPE_MIN_LARGE_QUOTE_VALUE,
      median * 3,
      highTail,
    ),
    2,
  );
}

function buildPrints(
  trades:
    readonly NormalizedTrade[],
): {
  prints:
    WorkspaceTradeTapePrint[];
  largeThresholdQuoteValue:
    number
    | null;
} {
  const merged:
    MutableTapePrint[] = [];

  for (
    const trade
    of trades
  ) {
    const previous =
      merged[
        merged.length - 1
      ];

    if (
      previous
      && canMergeTrade(
        previous,
        trade,
      )
    ) {
      const quantity =
        previous.quantity
        + trade.quantity;

      const quoteValue =
        previous.quoteValue
        + trade.quoteValue;

      previous.quantity =
        quantity;

      previous.quoteValue =
        quoteValue;

      previous.price =
        quoteValue
        / quantity;

      previous.tradesCount +=
        trade.tradesCount;

      previous.timestamp =
        trade.timestamp;

      previous.timestampMs =
        trade.timestampMs;

      previous.lastTradeId =
        trade.id;

      previous.id =
        previous.firstTradeId
        + ':'
        + previous.lastTradeId;

      continue;
    }

    merged.push({
      id:
        trade.id,
      symbol:
        trade.symbol,
      timestamp:
        trade.timestamp,
      timestampMs:
        trade.timestampMs,
      price:
        trade.price,
      quantity:
        trade.quantity,
      quoteValue:
        trade.quoteValue,
      tradesCount:
        trade.tradesCount,
      side:
        trade.side,
      isLarge:
        false,
      firstTradeId:
        trade.id,
      lastTradeId:
        trade.id,
    });
  }

  const largeThresholdQuoteValue =
    getLargeThreshold(
      merged,
    );

  const prints =
    merged
      .slice(
        -WORKSPACE_TAPE_MAX_PRINTS,
      )
      .reverse()
      .map(
        (
          {
            timestampMs: _timestampMs,
            firstTradeId: _firstTradeId,
            lastTradeId: _lastTradeId,
            ...print
          },
        ): WorkspaceTradeTapePrint => ({
          ...print,
          isLarge:
            largeThresholdQuoteValue
              !== null
            && print.quoteValue
              >= largeThresholdQuoteValue,
        }),
      );

  return {
    prints,
    largeThresholdQuoteValue,
  };
}

function sumTradesCount(
  trades:
    readonly NormalizedTrade[],
): number {
  return trades.reduce(
    (
      total,
      trade,
    ) =>
      total
      + trade.tradesCount,
    0,
  );
}

function sumQuoteValue(
  trades:
    readonly NormalizedTrade[],
  side:
    'buy'
    | 'sell',
): number {
  return trades.reduce(
    (
      total,
      trade,
    ) =>
      trade.side
        === side
        ? total
          + trade.quoteValue
        : total,
    0,
  );
}

function buildMetrics(
  trades:
    readonly NormalizedTrade[],
  now: number,
): WorkspaceTradeTapeMetrics {
  const currentWindowStart =
    now
    - WORKSPACE_TAPE_WINDOW_MS;

  const previousWindowStart =
    currentWindowStart
    - WORKSPACE_TAPE_WINDOW_MS;

  const currentTrades =
    trades.filter(
      (trade) =>
        trade.timestampMs
          > currentWindowStart
        && trade.timestampMs
          <= now,
    );

  const previousTrades =
    trades.filter(
      (trade) =>
        trade.timestampMs
          > previousWindowStart
        && trade.timestampMs
          <= currentWindowStart,
    );

  const windowSeconds =
    WORKSPACE_TAPE_WINDOW_MS
    / 1_000;

  const tradeRate =
    round(
      sumTradesCount(
        currentTrades,
      )
      / windowSeconds,
      2,
    );

  const previousTradeRate =
    round(
      sumTradesCount(
        previousTrades,
      )
      / windowSeconds,
      2,
    );

  const buyQuoteValue =
    round(
      sumQuoteValue(
        currentTrades,
        'buy',
      ),
      2,
    );

  const sellQuoteValue =
    round(
      sumQuoteValue(
        currentTrades,
        'sell',
      ),
      2,
    );

  const totalQuoteValue =
    round(
      buyQuoteValue
      + sellQuoteValue,
      2,
    );

  const accelerationPct =
    previousTradeRate > 0
      ? round(
          (
            (
              tradeRate
              - previousTradeRate
            )
            / previousTradeRate
          )
          * 100,
          1,
        )
      : null;

  return {
    tradeRate,
    previousTradeRate,
    accelerationPct,
    buyQuoteValue,
    sellQuoteValue,
    totalQuoteValue,
    deltaQuoteValue:
      round(
        buyQuoteValue
        - sellQuoteValue,
        2,
      ),
    buySharePct:
      totalQuoteValue > 0
        ? round(
            (
              buyQuoteValue
              / totalQuoteValue
            )
            * 100,
            1,
          )
        : null,
  };
}

function resolveTapeSourceState(
  lifecycleState:
    RealtimeClientLifecycleState,
  backendState:
    RealtimeConnectionState
    | null,
): DataFreshnessSourceState {
  if (
    lifecycleState
      === 'error'
  ) {
    return 'error';
  }

  if (
    lifecycleState
      === 'closed'
    || backendState
      === 'stopped'
  ) {
    return 'offline';
  }

  if (
    lifecycleState
      === 'open'
    && backendState
      === 'connected'
  ) {
    return 'open';
  }

  if (
    lifecycleState
      === 'reconnecting'
    || backendState
      === 'reconnecting'
  ) {
    return 'reconnecting';
  }

  return 'connecting';
}

export function buildWorkspaceTradeTape(
  input:
    WorkspaceTradeTapeInput,
): WorkspaceTradeTapeView {
  const now =
    typeof input.now
      === 'number'
    && Number.isFinite(
      input.now,
    )
      ? input.now
      : Date.now();

  const normalizedTrades =
    (
      input.snapshot
        ?.recentTrades
      ?? []
    )
      .map(
        normalizeTrade,
      )
      .filter(
        (
          trade,
        ): trade is NormalizedTrade =>
          trade !== null,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.timestampMs
          - right.timestampMs,
      );

  const {
    prints,
    largeThresholdQuoteValue,
  } =
    buildPrints(
      normalizedTrades,
    );

  const lastTrade =
    normalizedTrades[
      normalizedTrades.length
      - 1
    ];

  const lastTradeAt =
    lastTrade
      ?.timestamp
    ?? null;

  const freshness =
    resolveDataFreshness({
      hasData:
        prints.length > 0,
      sourceState:
        resolveTapeSourceState(
          input.lifecycleState,
          input.backendState,
        ),
      updatedAt:
        lastTradeAt,
      error:
        input.error
        ?? null,
      staleAfterMs:
        WORKSPACE_TAPE_STALE_AFTER_MS,
      now,
    });

  const metricsNow =
    freshness.state
      === 'stale'
    && lastTrade
      ? lastTrade.timestampMs
      : now;

  return {
    prints,
    metrics:
      buildMetrics(
        normalizedTrades,
        metricsNow,
      ),
    freshness,
    largeThresholdQuoteValue,
    lastTradeAt,
  };
}
