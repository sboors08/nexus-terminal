import type {
  Candle,
} from '../../api/contracts.js';

export const MARKET_CANDLES_PATH =
  '/api/v1/market/candles';

export const MARKET_CANDLE_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '8h',
  '12h',
  '1d',
] as const;

export type MarketCandleTimeframe =
  typeof MARKET_CANDLE_TIMEFRAMES[number];

export type MarketCandlesFetch =
  typeof globalThis.fetch;

export interface FetchMarketCandlesOptions {
  baseUrl?: string;
  symbol: string;
  timeframe: MarketCandleTimeframe;
  signal?: AbortSignal;
  fetcher?: MarketCandlesFetch;
}

function resolveBaseUrl(
  baseUrl: string | undefined,
): string {
  return (
    baseUrl
      ?.trim()
      .replace(/\/+$/, '')
    ?? ''
  );
}

export function normalizeMarketCandleSymbol(
  symbol: string,
): string {
  const normalized =
    symbol
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z0-9]{5,30}$/.test(
      normalized,
    )
  ) {
    throw new Error(
      'Market candle symbol must contain only A-Z and 0-9',
    );
  }

  return normalized;
}

export function normalizeMarketCandleTimeframe(
  timeframe: string,
): MarketCandleTimeframe {
  if (
    !MARKET_CANDLE_TIMEFRAMES.includes(
      timeframe as MarketCandleTimeframe,
    )
  ) {
    throw new Error(
      `Unsupported market candle timeframe: ${timeframe}`,
    );
  }

  return timeframe as MarketCandleTimeframe;
}

export function buildMarketCandlesUrl(
  options:
    Pick<
      FetchMarketCandlesOptions,
      'baseUrl' | 'symbol' | 'timeframe'
    >,
): string {
  const params = new URLSearchParams({
    symbol: normalizeMarketCandleSymbol(
      options.symbol,
    ),
    timeframe:
      normalizeMarketCandleTimeframe(
        options.timeframe,
      ),
  });

  return (
    `${resolveBaseUrl(options.baseUrl)}`
    + MARKET_CANDLES_PATH
    + `?${params.toString()}`
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function readTimestamp(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];

  if (
    typeof value !== 'string'
    || value.length === 0
    || !Number.isFinite(
      Date.parse(value),
    )
  ) {
    throw new Error(
      `Invalid market candle: ${key}`,
    );
  }

  return value;
}

function readPositiveNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `Invalid market candle: ${key}`,
    );
  }

  return value;
}

function readNonNegativeNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid market candle: ${key}`,
    );
  }

  return value;
}

function readNonNegativeInteger(
  record: Record<string, unknown>,
  key: string,
): number {
  const value =
    readNonNegativeNumber(
      record,
      key,
    );

  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `Invalid market candle: ${key}`,
    );
  }

  return value;
}

export function parseMarketCandle(
  value: unknown,
): Candle {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid market candle response item',
    );
  }

  const openTime =
    readTimestamp(
      value,
      'openTime',
    );

  const closeTime =
    readTimestamp(
      value,
      'closeTime',
    );

  const open =
    readPositiveNumber(
      value,
      'open',
    );

  const high =
    readPositiveNumber(
      value,
      'high',
    );

  const low =
    readPositiveNumber(
      value,
      'low',
    );

  const close =
    readPositiveNumber(
      value,
      'close',
    );

  if (
    Date.parse(closeTime)
    < Date.parse(openTime)
    || high < low
    || high < Math.max(open, close)
    || low > Math.min(open, close)
  ) {
    throw new Error(
      'Invalid market candle OHLC range',
    );
  }

  return {
    openTime,
    closeTime,
    open,
    high,
    low,
    close,
    volume:
      readNonNegativeNumber(
        value,
        'volume',
      ),
    tradesCount:
      readNonNegativeInteger(
        value,
        'tradesCount',
      ),
  };
}

const defaultFetch:
MarketCandlesFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchMarketCandles(
  options: FetchMarketCandlesOptions,
): Promise<Candle[]> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      buildMarketCandlesUrl(
        options,
      ),
      {
        method: 'GET',
        headers: {
          accept:
            'application/json',
        },
        signal: options.signal,
      },
    );

  if (!response.ok) {
    throw new Error(
      `Market candles request failed: ${response.status}`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      'Invalid market candles response',
    );
  }

  return payload.map(
    parseMarketCandle,
  );
}