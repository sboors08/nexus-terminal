import {
  formatScannerPrice,
  formatScannerTradeTime,
} from './scannerRealtime.js';

export const MARKET_SCANNER_METRICS_PATH =
  '/api/v1/market/realtime/scanner-metrics';

export interface MarketScannerMetrics {
  symbol: string;
  windowMs: number;
  price: number | null;
  priceChangePct: number | null;
  volatilityPct: number | null;
  quoteVolume: number;
  tradesCount: number;
  tradesPerMinute: number;
  buyTradesCount: number;
  sellTradesCount: number;
  buyQuoteVolume: number;
  sellQuoteVolume: number;
  windowStartedAt: string | null;
  updatedAt: string | null;
}

export interface DashboardScannerMetricFallback {
  symbol: string;
  priceChangeLabel: string;
  quoteVolumeLabel: string;
  tradesCountLabel: string;
  speedLabel: string;
  volatilityLabel: string;
}

export interface DashboardScannerMetricView {
  symbol: string;
  isLive: boolean;
  priceValue: number | null;
  priceLabel: string;
  priceChangePct: number | null;
  priceChangeLabel: string;
  quoteVolumeLabel: string;
  tradesCountLabel: string;
  speedLabel: string;
  volatilityPct: number | null;
  volatilityLabel: string;
  updatedAtLabel: string;
  sourceLabel: 'LIVE' | 'TEST';
}

export type MarketScannerFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface FetchMarketScannerMetricsOptions {
  baseUrl?: string;
  symbols: readonly string[];
  fetcher?: MarketScannerFetch;
}

const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid market scanner metric: ${key}`,
    );
  }

  return value;
}

function readNullableNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];

  if (value === null) return null;

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid market scanner metric: ${key}`,
    );
  }

  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];

  if (value === null) return null;

  if (typeof value !== 'string') {
    throw new Error(
      `Invalid market scanner metric: ${key}`,
    );
  }

  return value;
}

export function normalizeMarketScannerSymbol(
  symbol: string,
): string {
  const normalized = symbol
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!SYMBOL_PATTERN.test(normalized)) {
    throw new Error(
      `Invalid market scanner symbol: ${symbol}`,
    );
  }

  return normalized;
}

function normalizeMarketScannerSymbols(
  symbols: readonly string[],
): string[] {
  const normalized = [
    ...new Set(
      symbols.map(
        normalizeMarketScannerSymbol,
      ),
    ),
  ];

  if (normalized.length === 0) {
    throw new Error(
      'At least one market scanner symbol is required',
    );
  }

  if (normalized.length > 100) {
    throw new Error(
      'Market scanner symbols limit is 100',
    );
  }

  return normalized;
}

export function buildMarketScannerMetricsUrl(
  options: Pick<
    FetchMarketScannerMetricsOptions,
    'baseUrl' | 'symbols'
  >,
): string {
  const baseUrl =
    options.baseUrl
      ?.trim()
      .replace(/\/+$/, '')
    ?? '';

  const symbols =
    normalizeMarketScannerSymbols(
      options.symbols,
    );

  const query = encodeURIComponent(
    symbols.join(','),
  );

  return (
    `${baseUrl}${MARKET_SCANNER_METRICS_PATH}`
    + `?symbols=${query}`
  );
}

function parseMarketScannerMetric(
  value: unknown,
): MarketScannerMetrics {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid market scanner metric payload',
    );
  }

  if (typeof value.symbol !== 'string') {
    throw new Error(
      'Invalid market scanner metric: symbol',
    );
  }

  return {
    symbol: normalizeMarketScannerSymbol(
      value.symbol,
    ),
    windowMs: readNumber(
      value,
      'windowMs',
    ),
    price: readNullableNumber(
      value,
      'price',
    ),
    priceChangePct: readNullableNumber(
      value,
      'priceChangePct',
    ),
    volatilityPct: readNullableNumber(
      value,
      'volatilityPct',
    ),
    quoteVolume: readNumber(
      value,
      'quoteVolume',
    ),
    tradesCount: readNumber(
      value,
      'tradesCount',
    ),
    tradesPerMinute: readNumber(
      value,
      'tradesPerMinute',
    ),
    buyTradesCount: readNumber(
      value,
      'buyTradesCount',
    ),
    sellTradesCount: readNumber(
      value,
      'sellTradesCount',
    ),
    buyQuoteVolume: readNumber(
      value,
      'buyQuoteVolume',
    ),
    sellQuoteVolume: readNumber(
      value,
      'sellQuoteVolume',
    ),
    windowStartedAt: readNullableString(
      value,
      'windowStartedAt',
    ),
    updatedAt: readNullableString(
      value,
      'updatedAt',
    ),
  };
}

const defaultMarketScannerFetch:
MarketScannerFetch = (
  input,
  init,
) => globalThis.fetch(input, init);

export async function fetchMarketScannerMetrics(
  options: FetchMarketScannerMetricsOptions,
): Promise<MarketScannerMetrics[]> {
  const url = buildMarketScannerMetricsUrl(
    options,
  );

  const response = await (
    options.fetcher
    ?? defaultMarketScannerFetch
  )(
    url,
    {
      headers: {
        accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Market scanner metrics request failed: ${response.status}`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      'Invalid market scanner metrics response',
    );
  }

  return payload.map(
    parseMarketScannerMetric,
  );
}

function formatSignedPercent(
  value: number,
): string {
  return (
    `${value > 0 ? '+' : ''}`
    + `${value.toFixed(2)}%`
  );
}

function formatInteger(
  value: number,
): string {
  return Math.max(
    0,
    Math.round(value),
  )
    .toLocaleString('ru-RU')
    .replace(/\u00a0/g, ' ');
}

function formatQuoteVolume(
  value: number,
): string {
  const normalized = Math.max(0, value);

  if (normalized >= 1_000_000) {
    return `$${(
      normalized / 1_000_000
    ).toFixed(2)}M`;
  }

  if (normalized >= 1_000) {
    return `$${(
      normalized / 1_000
    ).toFixed(2)}K`;
  }

  return `$${normalized.toFixed(2)}`;
}

export function buildDashboardScannerMetricView(
  fallback: DashboardScannerMetricFallback,
  metric:
    | MarketScannerMetrics
    | undefined,
): DashboardScannerMetricView {
  const symbol =
    normalizeMarketScannerSymbol(
      fallback.symbol,
    );

  const matchingMetric =
    metric?.symbol === symbol
      ? metric
      : undefined;

  if (
    !matchingMetric
    || matchingMetric.price === null
    || matchingMetric.updatedAt === null
  ) {
    return {
      symbol,
      isLive: false,
      priceValue: null,
      priceLabel: '\u2014',
      priceChangePct: null,
      priceChangeLabel:
        fallback.priceChangeLabel,
      quoteVolumeLabel:
        fallback.quoteVolumeLabel,
      tradesCountLabel:
        fallback.tradesCountLabel,
      speedLabel:
        fallback.speedLabel,
      volatilityPct: null,
      volatilityLabel:
        fallback.volatilityLabel,
      updatedAtLabel:
        '\u043e\u0436\u0438\u0434\u0430\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445',
      sourceLabel: 'TEST',
    };
  }

  return {
    symbol,
    isLive: true,
    priceValue: matchingMetric.price,
    priceLabel: formatScannerPrice(
      matchingMetric.price,
    ),
    priceChangePct:
      matchingMetric.priceChangePct,
    priceChangeLabel:
      matchingMetric.priceChangePct === null
        ? '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445'
        : formatSignedPercent(
            matchingMetric.priceChangePct,
          ),
    quoteVolumeLabel:
      formatQuoteVolume(
        matchingMetric.quoteVolume,
      ),
    tradesCountLabel:
      formatInteger(
        matchingMetric.tradesCount,
      ),
    speedLabel:
      `${formatInteger(
        matchingMetric.tradesPerMinute,
      )}/\u043c\u0438\u043d`,
    volatilityPct:
      matchingMetric.volatilityPct,
    volatilityLabel:
      matchingMetric.volatilityPct === null
        ? '\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445'
        : `${matchingMetric.volatilityPct.toFixed(2)}%`,
    updatedAtLabel:
      formatScannerTradeTime(
        matchingMetric.updatedAt,
      ),
    sourceLabel: 'LIVE',
  };
}
