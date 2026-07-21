export const BINANCE_SYMBOL_UNIVERSE_PATH =
  '/api/v1/market/symbol-universe';

export type BinanceSymbolUniverseEntryStatus =
  | 'collecting'
  | 'active';

export type BinanceSymbolUniverseServiceState =
  | 'idle'
  | 'refreshing'
  | 'ready'
  | 'degraded'
  | 'error'
  | 'stopped';

export interface BinanceSymbolUniverseEntry {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: BinanceSymbolUniverseEntryStatus;
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
  serviceState:
    BinanceSymbolUniverseServiceState;
  initialized: boolean;
  refreshCount: number;
  lastSuccessfulRefreshAt:
    string | null;
  lastError: string | null;
}

export type BinanceSymbolUniverseFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchBinanceSymbolUniverseOptions {
  baseUrl?: string;
  fetcher?: BinanceSymbolUniverseFetch;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const ASSET_PATTERN =
  /^[A-Z0-9]{1,20}$/;

const ENTRY_STATUSES =
  new Set<
    BinanceSymbolUniverseEntryStatus
  >([
    'collecting',
    'active',
  ]);

const SERVICE_STATES =
  new Set<
    BinanceSymbolUniverseServiceState
  >([
    'idle',
    'refreshing',
    'ready',
    'degraded',
    'error',
    'stopped',
  ]);

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];

  if (
    typeof value !== 'string'
    || value.length === 0
  ) {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return value;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean {
  const value = record[key];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return value;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (
    typeof value !== 'number'
    || !Number.isInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return value;
}

function normalizeSymbol(
  value: unknown,
): string {
  if (typeof value !== 'string') {
    throw new Error(
      'Invalid Binance Symbol Universe symbol',
    );
  }

  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Binance Symbol Universe symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeAsset(
  value: unknown,
  key: string,
): string {
  if (typeof value !== 'string') {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  const asset =
    value.trim().toUpperCase();

  if (!ASSET_PATTERN.test(asset)) {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return asset;
}

function readSymbolArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid Binance Symbol Universe field: ${key}`,
    );
  }

  return [
    ...new Set(
      value.map(normalizeSymbol),
    ),
  ];
}

function parseEntry(
  value: unknown,
): BinanceSymbolUniverseEntry {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid Binance Symbol Universe entry',
    );
  }

  const status =
    readString(value, 'status');

  if (
    !ENTRY_STATUSES.has(
      status as
        BinanceSymbolUniverseEntryStatus,
    )
  ) {
    throw new Error(
      `Invalid Binance Symbol Universe entry status: ${status}`,
    );
  }

  return {
    symbol:
      normalizeSymbol(value.symbol),
    baseAsset:
      normalizeAsset(
        value.baseAsset,
        'baseAsset',
      ),
    quoteAsset:
      normalizeAsset(
        value.quoteAsset,
        'quoteAsset',
      ),
    status:
      status as
        BinanceSymbolUniverseEntryStatus,
    firstSeenAt:
      readString(
        value,
        'firstSeenAt',
      ),
    lastSeenAt:
      readString(
        value,
        'lastSeenAt',
      ),
  };
}

export function buildBinanceSymbolUniverseUrl(
  baseUrl?: string,
): string {
  const normalizedBaseUrl =
    baseUrl
      ?.trim()
      .replace(/\/+$/, '')
    ?? '';

  return (
    normalizedBaseUrl
    + BINANCE_SYMBOL_UNIVERSE_PATH
  );
}

export function parseBinanceSymbolUniverseSnapshot(
  value: unknown,
): BinanceSymbolUniverseSnapshot {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid Binance Symbol Universe payload',
    );
  }

  if (!Array.isArray(value.entries)) {
    throw new Error(
      'Invalid Binance Symbol Universe field: entries',
    );
  }

  const entries =
    value.entries.map(parseEntry);

  const serviceState =
    readString(
      value,
      'serviceState',
    );

  if (
    !SERVICE_STATES.has(
      serviceState as
        BinanceSymbolUniverseServiceState,
    )
  ) {
    throw new Error(
      `Invalid Binance Symbol Universe service state: ${serviceState}`,
    );
  }

  return {
    entries,
    activeSymbols:
      readSymbolArray(
        value,
        'activeSymbols',
      ),
    collectingSymbols:
      readSymbolArray(
        value,
        'collectingSymbols',
      ),
    addedSymbols:
      readSymbolArray(
        value,
        'addedSymbols',
      ),
    removedSymbols:
      readSymbolArray(
        value,
        'removedSymbols',
      ),
    updatedAt:
      readString(
        value,
        'updatedAt',
      ),
    serviceState:
      serviceState as
        BinanceSymbolUniverseServiceState,
    initialized:
      readBoolean(
        value,
        'initialized',
      ),
    refreshCount:
      readNonNegativeInteger(
        value,
        'refreshCount',
      ),
    lastSuccessfulRefreshAt:
      readNullableString(
        value,
        'lastSuccessfulRefreshAt',
      ),
    lastError:
      readNullableString(
        value,
        'lastError',
      ),
  };
}

export async function fetchBinanceSymbolUniverse(
  options:
    FetchBinanceSymbolUniverseOptions = {},
): Promise<
  BinanceSymbolUniverseSnapshot
> {
  const fetcher =
    options.fetcher
    ?? globalThis.fetch;

  const response =
    await fetcher(
      buildBinanceSymbolUniverseUrl(
        options.baseUrl,
      ),
      {
        headers: {
          accept: 'application/json',
        },
      },
    );

  const text =
    await response.text();

  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        'Binance Symbol Universe returned invalid JSON',
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      `Binance Symbol Universe request failed with status ${response.status}`,
    );
  }

  return parseBinanceSymbolUniverseSnapshot(
    payload,
  );
}