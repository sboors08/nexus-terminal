import type {
  MarketSymbol,
} from '../contracts';

export const RUNTIME_MARKET_SYMBOLS_PATH =
  '/api/v1/market/symbols';

export type RuntimeMarketSymbolsFetch =
  typeof globalThis.fetch;

export interface FetchRuntimeMarketSymbolsOptions {
  baseUrl?: string;
  signal?: AbortSignal;
  fetcher?: RuntimeMarketSymbolsFetch;
}

type JsonRecord =
  Record<string, unknown>;

function normalizeBaseUrl(
  value: string | undefined,
): string {
  return (
    value
      ?.trim()
      .replace(/\/+$/u, '')
    ?? ''
  );
}

function readRecord(
  value: unknown,
  index: number,
): JsonRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new Error(
      `Invalid market symbol at index ${index}`,
    );
  }

  return value as JsonRecord;
}

function readString(
  record: JsonRecord,
  key: string,
  index: number,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid market symbol ${key} at index ${index}`,
    );
  }

  return value;
}

function readNumber(
  record: JsonRecord,
  key: string,
  index: number,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid market symbol ${key} at index ${index}`,
    );
  }

  return value;
}

function readNullableNumber(
  record: JsonRecord,
  key: string,
  index: number,
): number | null {
  const value =
    record[key];

  if (value === null) {
    return null;
  }

  return readNumber(
    record,
    key,
    index,
  );
}

export function parseRuntimeMarketSymbols(
  value: unknown,
): MarketSymbol[] {
  if (!Array.isArray(value)) {
    throw new Error(
      'Invalid market symbols response',
    );
  }

  return value.map(
    (item, index) => {
      const record =
        readRecord(
          item,
          index,
        );

      const exchange =
        readString(
          record,
          'exchange',
          index,
        );

      if (exchange !== 'binance') {
        throw new Error(
          `Invalid market symbol exchange at index ${index}`,
        );
      }

      return {
        symbol:
          readString(
            record,
            'symbol',
            index,
          ),

        baseAsset:
          readString(
            record,
            'baseAsset',
            index,
          ),

        quoteAsset:
          readString(
            record,
            'quoteAsset',
            index,
          ),

        exchange:
          'binance',

        price:
          readNumber(
            record,
            'price',
            index,
          ),

        priceChangePct:
          readNumber(
            record,
            'priceChangePct',
            index,
          ),

        volumeQuote:
          readNumber(
            record,
            'volumeQuote',
            index,
          ),

        tradesCount:
          readNumber(
            record,
            'tradesCount',
            index,
          ),

        tradeRate:
          readNumber(
            record,
            'tradeRate',
            index,
          ),

        volatilityPct:
          readNumber(
            record,
            'volatilityPct',
            index,
          ),

        btcCorrelation:
          readNullableNumber(
            record,
            'btcCorrelation',
            index,
          ),

        btcRelativeStrength:
          readNullableNumber(
            record,
            'btcRelativeStrength',
            index,
          ),

        updatedAt:
          readString(
            record,
            'updatedAt',
            index,
          ),
      };
    },
  );
}

const defaultFetch:
RuntimeMarketSymbolsFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchRuntimeMarketSymbols(
  options:
    FetchRuntimeMarketSymbolsOptions = {},
): Promise<MarketSymbol[]> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      normalizeBaseUrl(
        options.baseUrl,
      )
      + RUNTIME_MARKET_SYMBOLS_PATH,
      {
        method:
          'GET',

        headers: {
          accept:
            'application/json',
        },

        signal:
          options.signal,
      },
    );

  let payload:
    unknown;

  try {
    payload =
      await response.json();
  } catch {
    throw new Error(
      'Market symbols returned invalid JSON',
    );
  }

  if (!response.ok) {
    throw new Error(
      `Market symbols request failed with status ${response.status}`,
    );
  }

  return parseRuntimeMarketSymbols(
    payload,
  );
}
