import {
  normalizeMarketScannerSymbol,
  type MarketScannerFetch,
} from './dashboardScannerMetrics.js';

export const MARKET_WIDE_LIQUIDATIONS_PATH =
  '/api/v1/market/realtime/market-wide/liquidations';

export interface RealtimeLiquidation {
  symbol: string;
  pairSymbol: string;
  side:
    | 'buy'
    | 'sell';
  orderType: string;
  timeInForce: string;
  originalQuantity: number;
  price: number;
  averagePrice: number;
  orderStatus: string;
  lastFilledQuantity: number;
  filledQuantity: number;
  tradeAt: string;
  updatedAt: string;
}

export interface FetchMarketWideLiquidationsOptions {
  baseUrl?: string;
  symbol?: string;
  limit?: number;
  fetcher?: MarketScannerFetch;
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

function readString(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const field =
    value[key];

  if (typeof field !== 'string') {
    throw new Error(
      `Invalid liquidation: ${key}`,
    );
  }

  return field;
}

function readNumber(
  value:
    Record<string, unknown>,
  key: string,
): number {
  const field =
    value[key];

  if (
    typeof field !== 'number'
    || !Number.isFinite(field)
  ) {
    throw new Error(
      `Invalid liquidation: ${key}`,
    );
  }

  return field;
}

function readTimestamp(
  value:
    Record<string, unknown>,
  key: string,
): string {
  const timestamp =
    readString(
      value,
      key,
    );

  if (
    !Number.isFinite(
      Date.parse(timestamp),
    )
  ) {
    throw new Error(
      `Invalid liquidation timestamp: ${key}`,
    );
  }

  return timestamp;
}

export function parseMarketWideLiquidation(
  value: unknown,
): RealtimeLiquidation {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid market-wide liquidation payload',
    );
  }

  const side =
    readString(
      value,
      'side',
    );

  if (
    side !== 'buy'
    && side !== 'sell'
  ) {
    throw new Error(
      'Invalid liquidation: side',
    );
  }

  const liquidation: RealtimeLiquidation = {
    symbol:
      normalizeMarketScannerSymbol(
        readString(
          value,
          'symbol',
        ),
      ),
    pairSymbol:
      normalizeMarketScannerSymbol(
        readString(
          value,
          'pairSymbol',
        ),
      ),
    side,
    orderType:
      readString(
        value,
        'orderType',
      ),
    timeInForce:
      readString(
        value,
        'timeInForce',
      ),
    originalQuantity:
      readNumber(
        value,
        'originalQuantity',
      ),
    price:
      readNumber(
        value,
        'price',
      ),
    averagePrice:
      readNumber(
        value,
        'averagePrice',
      ),
    orderStatus:
      readString(
        value,
        'orderStatus',
      ),
    lastFilledQuantity:
      readNumber(
        value,
        'lastFilledQuantity',
      ),
    filledQuantity:
      readNumber(
        value,
        'filledQuantity',
      ),
    tradeAt:
      readTimestamp(
        value,
        'tradeAt',
      ),
    updatedAt:
      readTimestamp(
        value,
        'updatedAt',
      ),
  };

  if (
    liquidation.originalQuantity <= 0
    || liquidation.price < 0
    || liquidation.averagePrice < 0
    || liquidation.lastFilledQuantity < 0
    || liquidation.filledQuantity < 0
    || liquidation.lastFilledQuantity
      > liquidation.filledQuantity
    || liquidation.filledQuantity
      > liquidation.originalQuantity
  ) {
    throw new Error(
      'Invalid market-wide liquidation values',
    );
  }

  return liquidation;
}

function resolveBaseUrl(
  baseUrl:
    string
    | undefined,
): string {
  return (
    baseUrl
      ?.trim()
      .replace(/\/+$/, '')
    ?? ''
  );
}

function normalizeLimit(
  limit:
    number
    | undefined,
): number {
  const normalized =
    limit
    ?? 10;

  if (
    !Number.isInteger(normalized)
    || normalized < 1
    || normalized > 1_000
  ) {
    throw new Error(
      'Liquidation limit must be an integer from 1 to 1000',
    );
  }

  return normalized;
}

export function buildMarketWideLiquidationsUrl(
  options:
    Pick<
      FetchMarketWideLiquidationsOptions,
      | 'baseUrl'
      | 'symbol'
      | 'limit'
    > = {},
): string {
  const params =
    new URLSearchParams();

  if (options.symbol) {
    params.set(
      'symbol',
      normalizeMarketScannerSymbol(
        options.symbol,
      ),
    );
  }

  params.set(
    'limit',
    String(
      normalizeLimit(
        options.limit,
      ),
    ),
  );

  return (
    resolveBaseUrl(
      options.baseUrl,
    )
    + MARKET_WIDE_LIQUIDATIONS_PATH
    + `?${params.toString()}`
  );
}

const defaultFetch:
MarketScannerFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchMarketWideLiquidations(
  options:
    FetchMarketWideLiquidationsOptions = {},
): Promise<
  RealtimeLiquidation[]
> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      buildMarketWideLiquidationsUrl(
        options,
      ),
      {
        headers: {
          accept:
            'application/json',
        },
      },
    );

  if (!response.ok) {
    throw new Error(
      `Market-wide liquidations request failed: ${response.status}`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      'Invalid market-wide liquidations response',
    );
  }

  return payload
    .map(
      parseMarketWideLiquidation,
    )
    .sort(
      (
        left,
        right,
      ) =>
        Date.parse(
          right.updatedAt,
        )
        - Date.parse(
            left.updatedAt,
          ),
    );
}
