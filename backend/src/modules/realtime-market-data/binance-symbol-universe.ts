export type BinanceSymbolUniverseStatus =
  | 'collecting'
  | 'active';

export interface BinanceUsdMPerpetualSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface BinanceSymbolUniverseEntry
  extends BinanceUsdMPerpetualSymbol {
  status: BinanceSymbolUniverseStatus;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface BinanceSymbolUniverseSnapshot {
  entries: BinanceSymbolUniverseEntry[];
  activeSymbols: string[];
  collectingSymbols: string[];
  addedSymbols: string[];
  removedSymbols: string[];
  updatedAt: string;
}

export interface ReconcileBinanceSymbolUniverseOptions {
  collectingDurationMs?: number;
}

type UnknownRecord =
  Record<string, unknown>;

const DEFAULT_COLLECTING_DURATION_MS =
  15 * 60 * 1000;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function uppercaseString(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  return normalized || null;
}

function normalizeObservedAt(
  value: Date | string,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      'Invalid Binance symbol universe timestamp',
    );
  }

  return date.toISOString();
}

function normalizeUsdMPerpetualSymbol(
  value: unknown,
  targetQuoteAsset: string,
): BinanceUsdMPerpetualSymbol | null {
  if (!isRecord(value)) {
    return null;
  }

  const symbol =
    uppercaseString(value.symbol);

  const status =
    uppercaseString(value.status);

  const baseAsset =
    uppercaseString(value.baseAsset);

  const quoteAsset =
    uppercaseString(value.quoteAsset);

  const contractType =
    uppercaseString(value.contractType);

  if (
    !symbol
    || !baseAsset
    || !quoteAsset
    || !contractType
  ) {
    return null;
  }

  if (
    !/^[A-Z0-9]{5,30}$/.test(
      symbol,
    )
  ) {
    return null;
  }

  if (
    !/^[A-Z0-9]{2,20}$/.test(
      baseAsset,
    )
    || !/^[A-Z0-9]{2,20}$/.test(
      quoteAsset,
    )
  ) {
    return null;
  }

  if (status !== 'TRADING') {
    return null;
  }

  if (
    quoteAsset
    !== targetQuoteAsset
  ) {
    return null;
  }

  if (
    contractType
    !== 'PERPETUAL'
  ) {
    return null;
  }

  return {
    symbol,
    baseAsset,
    quoteAsset,
  };
}

function deduplicateSymbols(
  symbols:
    readonly BinanceUsdMPerpetualSymbol[],
): BinanceUsdMPerpetualSymbol[] {
  const symbolsById =
    new Map<
      string,
      BinanceUsdMPerpetualSymbol
    >();

  for (const symbol of symbols) {
    symbolsById.set(
      symbol.symbol,
      {
        ...symbol,
      },
    );
  }

  return [
    ...symbolsById.values(),
  ].sort(
    (left, right) =>
      left.symbol.localeCompare(
        right.symbol,
      ),
  );
}

function buildSnapshot(
  entries:
    BinanceSymbolUniverseEntry[],
  addedSymbols: string[],
  removedSymbols: string[],
  updatedAt: string,
): BinanceSymbolUniverseSnapshot {
  const sortedEntries =
    [...entries].sort(
      (left, right) =>
        left.symbol.localeCompare(
          right.symbol,
        ),
    );

  return {
    entries: sortedEntries,
    activeSymbols:
      sortedEntries
        .filter(
          (entry) =>
            entry.status === 'active',
        )
        .map(
          (entry) => entry.symbol,
        ),
    collectingSymbols:
      sortedEntries
        .filter(
          (entry) =>
            entry.status
            === 'collecting',
        )
        .map(
          (entry) => entry.symbol,
        ),
    addedSymbols:
      [...addedSymbols].sort(),
    removedSymbols:
      [...removedSymbols].sort(),
    updatedAt,
  };
}

export function parseBinanceUsdMPerpetualSymbolUniverse(
  payload: unknown,
  quoteAsset = 'USDT',
): BinanceUsdMPerpetualSymbol[] {
  if (
    !isRecord(payload)
    || !Array.isArray(
      payload.symbols,
    )
  ) {
    throw new Error(
      'Binance exchangeInfo response does not contain symbols',
    );
  }

  const normalizedQuoteAsset =
    uppercaseString(quoteAsset);

  if (
    !normalizedQuoteAsset
    || !/^[A-Z0-9]{2,20}$/.test(
      normalizedQuoteAsset,
    )
  ) {
    throw new Error(
      `Invalid Binance quote asset: ${quoteAsset}`,
    );
  }

  const symbols =
    payload.symbols
      .map(
        (symbol) =>
          normalizeUsdMPerpetualSymbol(
            symbol,
            normalizedQuoteAsset,
          ),
      )
      .filter(
        (
          symbol,
        ): symbol is BinanceUsdMPerpetualSymbol =>
          symbol !== null,
      );

  return deduplicateSymbols(symbols);
}

export function createInitialBinanceSymbolUniverse(
  symbols:
    readonly BinanceUsdMPerpetualSymbol[],
  observedAt: Date | string,
): BinanceSymbolUniverseSnapshot {
  const updatedAt =
    normalizeObservedAt(
      observedAt,
    );

  const entries =
    deduplicateSymbols(symbols)
      .map(
        (
          symbol,
        ): BinanceSymbolUniverseEntry => ({
          ...symbol,
          status: 'active',
          firstSeenAt: updatedAt,
          lastSeenAt: updatedAt,
        }),
      );

  return buildSnapshot(
    entries,
    [],
    [],
    updatedAt,
  );
}

export function reconcileBinanceSymbolUniverse(
  previousEntries:
    readonly BinanceSymbolUniverseEntry[],
  nextSymbols:
    readonly BinanceUsdMPerpetualSymbol[],
  observedAt: Date | string,
  options:
    ReconcileBinanceSymbolUniverseOptions = {},
): BinanceSymbolUniverseSnapshot {
  const updatedAt =
    normalizeObservedAt(
      observedAt,
    );

  const collectingDurationMs =
    options.collectingDurationMs
    ?? DEFAULT_COLLECTING_DURATION_MS;

  if (
    !Number.isFinite(
      collectingDurationMs,
    )
    || collectingDurationMs < 0
  ) {
    throw new Error(
      'collectingDurationMs must be a non-negative finite number',
    );
  }

  const observedAtMs =
    Date.parse(updatedAt);

  const previousBySymbol =
    new Map(
      previousEntries.map(
        (entry) => [
          entry.symbol,
          entry,
        ],
      ),
    );

  const normalizedNextSymbols =
    deduplicateSymbols(
      nextSymbols,
    );

  const nextSymbolIds =
    new Set(
      normalizedNextSymbols.map(
        (symbol) => symbol.symbol,
      ),
    );

  const addedSymbols: string[] =
    [];

  const entries =
    normalizedNextSymbols.map(
      (
        symbol,
      ): BinanceSymbolUniverseEntry => {
        const previous =
          previousBySymbol.get(
            symbol.symbol,
          );

        if (!previous) {
          addedSymbols.push(
            symbol.symbol,
          );

          return {
            ...symbol,
            status: 'collecting',
            firstSeenAt: updatedAt,
            lastSeenAt: updatedAt,
          };
        }

        const parsedFirstSeenAt =
          Date.parse(
            previous.firstSeenAt,
          );

        const firstSeenAt =
          Number.isFinite(
            parsedFirstSeenAt,
          )
            ? previous.firstSeenAt
            : updatedAt;

        const ageMs =
          Math.max(
            0,
            observedAtMs
            - Date.parse(
                firstSeenAt,
              ),
          );

        const status:
        BinanceSymbolUniverseStatus =
          previous.status === 'active'
          || ageMs
            >= collectingDurationMs
            ? 'active'
            : 'collecting';

        return {
          ...symbol,
          status,
          firstSeenAt,
          lastSeenAt: updatedAt,
        };
      },
    );

  const removedSymbols =
    previousEntries
      .filter(
        (entry) =>
          !nextSymbolIds.has(
            entry.symbol,
          ),
      )
      .map(
        (entry) => entry.symbol,
      );

  return buildSnapshot(
    entries,
    addedSymbols,
    removedSymbols,
    updatedAt,
  );
}