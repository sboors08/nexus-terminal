import type {
  RealtimeLiquidation,
} from './realtime-market-data.types.js';

type UnknownRecord =
  Record<string, unknown>;

export interface MarketWideLiquidationSymbolChange {
  addedSymbols: string[];
  removedSymbols: string[];
}

export interface MarketWideLiquidationStoreOptions {
  symbols?: readonly string[];
  maxEventsPerSymbol?: number;
  maxRecentEvents?: number;
}

export const DEFAULT_MARKET_WIDE_LIQUIDATIONS_PER_SYMBOL =
  100;

export const DEFAULT_MARKET_WIDE_RECENT_LIQUIDATIONS =
  1_000;

const SYMBOL_PATTERN =
  /^[A-Z0-9_]{5,40}$/;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function normalizeSymbol(
  value: unknown,
): string {
  if (
    typeof value !== 'string'
  ) {
    throw new Error(
      'Invalid Binance liquidation symbol',
    );
  }

  const symbol =
    value
      .trim()
      .toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      'Invalid Binance liquidation symbol: '
      + value,
    );
  }

  return symbol;
}

function readString(
  record: UnknownRecord,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      'Invalid Binance liquidation field: '
      + key,
    );
  }

  return value.trim();
}

function readNumber(
  record: UnknownRecord,
  key: string,
  minimum: number,
  inclusive = true,
): number {
  const value =
    record[key];

  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  const belowMinimum =
    inclusive
      ? parsed < minimum
      : parsed <= minimum;

  if (
    !Number.isFinite(parsed)
    || belowMinimum
  ) {
    throw new Error(
      'Invalid Binance liquidation field: '
      + key,
    );
  }

  return parsed;
}

function readInteger(
  record: UnknownRecord,
  key: string,
  minimum: number,
): number {
  const parsed =
    readNumber(
      record,
      key,
      minimum,
    );

  if (
    !Number.isInteger(parsed)
  ) {
    throw new Error(
      'Invalid Binance liquidation field: '
      + key,
    );
  }

  return parsed;
}

function timestampToIso(
  value: number,
  field: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      'Invalid Binance liquidation timestamp: '
      + field,
    );
  }

  return date.toISOString();
}

function cloneLiquidation(
  value:
    RealtimeLiquidation,
): RealtimeLiquidation {
  return {
    ...value,
  };
}

function validateLimit(
  value: number,
  name: string,
): void {
  if (
    !Number.isInteger(value)
    || value <= 0
  ) {
    throw new Error(
      name
      + ' must be a positive integer',
    );
  }
}

function validateRealtimeLiquidation(
  value:
    RealtimeLiquidation,
): RealtimeLiquidation {
  const symbol =
    normalizeSymbol(
      value.symbol,
    );

  const pairSymbol =
    normalizeSymbol(
      value.pairSymbol,
    );

  if (
    value.side !== 'buy'
    && value.side !== 'sell'
  ) {
    throw new Error(
      'Invalid market-wide liquidation side: '
      + symbol,
    );
  }

  if (
    typeof value.orderType
      !== 'string'
    || value.orderType.length === 0
    || typeof value.timeInForce
      !== 'string'
    || value.timeInForce.length === 0
    || typeof value.orderStatus
      !== 'string'
    || value.orderStatus.length === 0
  ) {
    throw new Error(
      'Invalid market-wide liquidation order fields: '
      + symbol,
    );
  }

  const updatedAtMs =
    Date.parse(
      value.updatedAt,
    );

  const tradeAtMs =
    Date.parse(
      value.tradeAt,
    );

  if (
    !Number.isFinite(
      updatedAtMs,
    )
    || !Number.isFinite(
      tradeAtMs,
    )
    || !Number.isFinite(
      value.originalQuantity,
    )
    || value.originalQuantity <= 0
    || !Number.isFinite(
      value.price,
    )
    || value.price < 0
    || !Number.isFinite(
      value.averagePrice,
    )
    || value.averagePrice < 0
    || !Number.isFinite(
      value.lastFilledQuantity,
    )
    || value.lastFilledQuantity < 0
    || !Number.isFinite(
      value.filledQuantity,
    )
    || value.filledQuantity < 0
    || value.lastFilledQuantity
      > value.filledQuantity
        + 0.000000000001
    || value.filledQuantity
      > value.originalQuantity
        + 0.000000000001
  ) {
    throw new Error(
      'Invalid market-wide liquidation values: '
      + symbol,
    );
  }

  return {
    ...value,
    symbol,
    pairSymbol,
  };
}

export function parseBinanceMarketWideLiquidation(
  payload: unknown,
): RealtimeLiquidation | null {
  if (
    !isRecord(payload)
  ) {
    throw new Error(
      'Invalid Binance liquidation payload',
    );
  }

  if (
    payload.e !== 'forceOrder'
  ) {
    throw new Error(
      'Binance payload is not a forceOrder event',
    );
  }

  if (
    !isRecord(
      payload.o,
    )
  ) {
    throw new Error(
      'Invalid Binance liquidation order body',
    );
  }

  const order =
    payload.o;

  /*
   * Binance documentation currently shows ps/st at the
   * forceOrder event root, while the live all-market stream
   * has also been observed delivering them inside "o".
   *
   * Accept both factual wire shapes. If Binance sends both
   * locations, they must agree.
   */
  const topLevelSymbolType =
    payload.st === undefined
      ? null
      : readInteger(
          payload,
          'st',
          1,
        );

  const orderSymbolType =
    order.st === undefined
      ? null
      : readInteger(
          order,
          'st',
          1,
        );

  if (
    topLevelSymbolType !== null
    && orderSymbolType !== null
    && topLevelSymbolType
      !== orderSymbolType
  ) {
    throw new Error(
      'Binance liquidation symbol type mismatch',
    );
  }

  const symbolType =
    orderSymbolType
    ?? topLevelSymbolType;

  if (symbolType === null) {
    throw new Error(
      'Missing Binance liquidation symbol type',
    );
  }

  if (
    symbolType === 2
  ) {
    return null;
  }

  if (
    symbolType !== 1
  ) {
    throw new Error(
      'Unsupported Binance liquidation symbol type: '
      + symbolType,
    );
  }

  const topLevelPairSymbol =
    payload.ps === undefined
      ? null
      : normalizeSymbol(
          payload.ps,
        );

  const orderPairSymbol =
    order.ps === undefined
      ? null
      : normalizeSymbol(
          order.ps,
        );

  if (
    topLevelPairSymbol !== null
    && orderPairSymbol !== null
    && topLevelPairSymbol
      !== orderPairSymbol
  ) {
    throw new Error(
      'Binance liquidation pair symbol mismatch',
    );
  }

  const pairSymbol =
    orderPairSymbol
    ?? topLevelPairSymbol;

  if (pairSymbol === null) {
    throw new Error(
      'Missing Binance liquidation pair symbol',
    );
  }

  const side =
    readString(
      order,
      'S',
    ).toUpperCase();

  if (
    side !== 'BUY'
    && side !== 'SELL'
  ) {
    throw new Error(
      'Invalid Binance liquidation side',
    );
  }

  const originalQuantity =
    readNumber(
      order,
      'q',
      0,
      false,
    );

  const price =
    readNumber(
      order,
      'p',
      0,
    );

  const averagePrice =
    readNumber(
      order,
      'ap',
      0,
    );

  const lastFilledQuantity =
    readNumber(
      order,
      'l',
      0,
    );

  const filledQuantity =
    readNumber(
      order,
      'z',
      0,
    );

  if (
    lastFilledQuantity
      > filledQuantity
        + 0.000000000001
    || filledQuantity
      > originalQuantity
        + 0.000000000001
  ) {
    throw new Error(
      'Invalid Binance liquidation fill quantities',
    );
  }

  const eventTimeMs =
    readInteger(
      payload,
      'E',
      0,
    );

  const tradeTimeMs =
    readInteger(
      order,
      'T',
      0,
    );

  return {
    symbol:
      normalizeSymbol(
        order.s,
      ),
    pairSymbol,
    side:
      side === 'BUY'
        ? 'buy'
        : 'sell',
    orderType:
      readString(
        order,
        'o',
      ),
    timeInForce:
      readString(
        order,
        'f',
      ),
    originalQuantity,
    price,
    averagePrice,
    orderStatus:
      readString(
        order,
        'X',
      ),
    lastFilledQuantity,
    filledQuantity,
    tradeAt:
      timestampToIso(
        tradeTimeMs,
        'T',
      ),
    updatedAt:
      timestampToIso(
        eventTimeMs,
        'E',
      ),
  };
}

export class MarketWideLiquidationStore {
  private readonly states =
    new Map<
      string,
      RealtimeLiquidation[]
    >();

  private recent:
    RealtimeLiquidation[] = [];

  private readonly maxEventsPerSymbol:
    number;

  private readonly maxRecentEvents:
    number;

  constructor(
    options:
      MarketWideLiquidationStoreOptions = {},
  ) {
    this.maxEventsPerSymbol =
      options.maxEventsPerSymbol
      ?? DEFAULT_MARKET_WIDE_LIQUIDATIONS_PER_SYMBOL;

    this.maxRecentEvents =
      options.maxRecentEvents
      ?? DEFAULT_MARKET_WIDE_RECENT_LIQUIDATIONS;

    validateLimit(
      this.maxEventsPerSymbol,
      'maxEventsPerSymbol',
    );

    validateLimit(
      this.maxRecentEvents,
      'maxRecentEvents',
    );

    this.replaceSymbols(
      options.symbols
      ?? [],
    );
  }

  replaceSymbols(
    symbols: readonly string[],
  ): MarketWideLiquidationSymbolChange {
    const normalizedSymbols =
      [
        ...new Set(
          symbols.map(
            normalizeSymbol,
          ),
        ),
      ].sort();

    const next =
      new Set(
        normalizedSymbols,
      );

    const removedSymbols =
      [
        ...this.states.keys(),
      ]
        .filter(
          (symbol) =>
            !next.has(symbol),
        )
        .sort();

    const addedSymbols =
      normalizedSymbols
        .filter(
          (symbol) =>
            !this.states.has(
              symbol,
            ),
        );

    for (
      const symbol
      of removedSymbols
    ) {
      this.states.delete(
        symbol,
      );
    }

    if (
      removedSymbols.length > 0
    ) {
      const removed =
        new Set(
          removedSymbols,
        );

      this.recent =
        this.recent.filter(
          (item) =>
            !removed.has(
              item.symbol,
            ),
        );
    }

    for (
      const symbol
      of addedSymbols
    ) {
      this.states.set(
        symbol,
        [],
      );
    }

    return {
      addedSymbols,
      removedSymbols,
    };
  }

  getSymbols(): string[] {
    return [
      ...this.states.keys(),
    ].sort();
  }

  apply(
    value:
      RealtimeLiquidation,
  ): boolean {
    const normalized =
      validateRealtimeLiquidation(
        value,
      );

    const state =
      this.states.get(
        normalized.symbol,
      );

    if (!state) {
      return false;
    }

    const latest =
      state.at(-1)
      ?? null;

    if (latest) {
      const currentTimestamp =
        Date.parse(
          latest.updatedAt,
        );

      const nextTimestamp =
        Date.parse(
          normalized.updatedAt,
        );

      if (
        nextTimestamp
        < currentTimestamp
      ) {
        return false;
      }
    }

    const stored =
      cloneLiquidation(
        normalized,
      );

    state.push(
      stored,
    );

    if (
      state.length
      > this.maxEventsPerSymbol
    ) {
      state.splice(
        0,
        state.length
          - this.maxEventsPerSymbol,
      );
    }

    this.recent.push(
      cloneLiquidation(
        stored,
      ),
    );

    if (
      this.recent.length
      > this.maxRecentEvents
    ) {
      this.recent.splice(
        0,
        this.recent.length
          - this.maxRecentEvents,
      );
    }

    return true;
  }

  getLatest(
    symbol: string,
  ): RealtimeLiquidation | null {
    const normalizedSymbol =
      normalizeSymbol(
        symbol,
      );

    const state =
      this.states.get(
        normalizedSymbol,
      );

    const latest =
      state?.at(-1)
      ?? null;

    return latest
      ? cloneLiquidation(
          latest,
        )
      : null;
  }

  getRecent(
    symbol?: string,
    limit =
      this.maxRecentEvents,
  ): RealtimeLiquidation[] {
    validateLimit(
      limit,
      'liquidation limit',
    );

    const source =
      symbol === undefined
        ? this.recent
        : this.states.get(
            normalizeSymbol(
              symbol,
            ),
          )
          ?? [];

    return source
      .slice(-limit)
      .map(
        cloneLiquidation,
      );
  }
}
