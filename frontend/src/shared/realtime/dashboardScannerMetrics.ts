import {
  formatScannerPrice,
  formatScannerTradeTime,
} from './scannerRealtime.js';

export const MARKET_SCANNER_METRICS_PATH =
  '/api/v1/market/realtime/scanner-metrics';

export function buildDashboardScannerWorkspaceUrl(
  route: string,
  symbol: string,
): string {
  const params = new URLSearchParams();

  params.set(
    'symbol',
    normalizeMarketScannerSymbol(symbol),
  );
  params.set('timeframe', '1m');

  return `${route}?${params.toString()}`;
}

export interface MarketScannerMetrics {
  symbol: string;
  windowMs: number;
  price: number | null;
  priceChangePct: number | null;
  volatilityPct: number | null;
  spreadPct: number | null;
  topBookQuoteValue: number | null;
  orderBookImbalancePct: number | null;
  liquidityScore: number | null;
  activityScore: number | null;
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
  liquidityScore: number;
  activityScore: number;
}

export interface DashboardScannerMetricView {
  symbol: string;
  isLive: boolean;
  priceValue: number | null;
  priceLabel: string;
  priceChangePct: number | null;
  priceChangeLabel: string;
  quoteVolumeLabel: string;
  quoteVolumeValue: number | null;
  tradesCountLabel: string;
  speedLabel: string;
  volatilityPct: number | null;
  volatilityLabel: string;
  spreadPct: number | null;
  topBookQuoteValue: number | null;
  orderBookImbalancePct: number | null;
  liquidityIsLive: boolean;
  liquidityScore: number;
  liquidityTitle: string;
  activityIsLive: boolean;
  activityScore: number;
  activityTitle: string;
  updatedAtLabel: string;
  sourceLabel: 'LIVE' | 'TEST';
}

export interface DashboardScannerRankableItem {
  view: Pick<
    DashboardScannerMetricView,
    | 'activityIsLive'
    | 'activityScore'
    | 'quoteVolumeValue'
  >;
}

export function sortDashboardScannerRows<
  T extends DashboardScannerRankableItem,
>(
  rows: readonly T[],
): T[] {
  return rows
    .map((row, originalIndex) => ({
      row,
      originalIndex,
    }))
    .sort((left, right) => {
      if (
        left.row.view.activityIsLive
        !== right.row.view.activityIsLive
      ) {
        return left.row.view.activityIsLive
          ? -1
          : 1;
      }

      const activityDifference =
        right.row.view.activityScore
        - left.row.view.activityScore;

      if (activityDifference !== 0) {
        return activityDifference;
      }

      const volumeDifference =
        (
          right.row.view.quoteVolumeValue
          ?? 0
        )
        - (
          left.row.view.quoteVolumeValue
          ?? 0
        );

      if (volumeDifference !== 0) {
        return volumeDifference;
      }

      return (
        left.originalIndex
        - right.originalIndex
      );
    })
    .map(({ row }) => row);
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
    spreadPct: readNullableNumber(
      value,
      'spreadPct',
    ),
    topBookQuoteValue:
      readNullableNumber(
        value,
        'topBookQuoteValue',
      ),
    orderBookImbalancePct:
      readNullableNumber(
        value,
        'orderBookImbalancePct',
      ),
    liquidityScore:
      readNullableNumber(
        value,
        'liquidityScore',
      ),
    activityScore:
      readNullableNumber(
        value,
        'activityScore',
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

function normalizeLiquidityScore(
  value: number,
): number {
  return Math.min(
    9,
    Math.max(
      1,
      Math.round(value),
    ),
  );
}

function normalizeActivityScore(
  value: number,
): number {
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(value),
    ),
  );
}

function buildActivityTitle(
  metric: MarketScannerMetrics,
): string {
  if (metric.activityScore === null) {
    return 'TEST · ожидание live-активности';
  }

  const volatilityLabel =
    metric.volatilityPct === null
      ? 'нет данных'
      : `${metric.volatilityPct.toFixed(2)}%`;

  const liquidityLabel =
    metric.liquidityScore === null
      ? 'нет данных'
      : `${normalizeLiquidityScore(metric.liquidityScore)}/9`;

  return (
    'LIVE · объём '
    + formatQuoteVolume(
        metric.quoteVolume,
      )
    + ' · скорость '
    + formatInteger(
        metric.tradesPerMinute,
      )
    + '/мин · волатильность '
    + volatilityLabel
    + ' · ликвидность '
    + liquidityLabel
  );
}

function buildLiquidityTitle(
  metric: MarketScannerMetrics,
): string {
  if (
    metric.liquidityScore === null
    || metric.spreadPct === null
    || metric.topBookQuoteValue === null
  ) {
    return 'TEST · ожидание данных стакана';
  }

  const imbalanceLabel =
    metric.orderBookImbalancePct === null
      ? 'нет данных'
      : formatSignedPercent(
          metric.orderBookImbalancePct,
        );

  return (
    'LIVE · спред '
    + metric.spreadPct.toFixed(4)
    + '% · верх стакана '
    + formatQuoteVolume(
        metric.topBookQuoteValue,
      )
    + ' · дисбаланс '
    + imbalanceLabel
  );
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
      quoteVolumeValue: null,
      tradesCountLabel:
        fallback.tradesCountLabel,
      speedLabel:
        fallback.speedLabel,
      volatilityPct: null,
      volatilityLabel:
        fallback.volatilityLabel,
      spreadPct: null,
      topBookQuoteValue: null,
      orderBookImbalancePct: null,
      liquidityIsLive: false,
      liquidityScore:
        normalizeLiquidityScore(
          fallback.liquidityScore,
        ),
      liquidityTitle:
        'TEST · тестовая ликвидность',
      activityIsLive: false,
      activityScore:
        normalizeActivityScore(
          fallback.activityScore,
        ),
      activityTitle:
        'TEST · тестовая оценка активности',
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
    quoteVolumeValue:
      matchingMetric.quoteVolume,
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
    spreadPct:
      matchingMetric.spreadPct,
    topBookQuoteValue:
      matchingMetric.topBookQuoteValue,
    orderBookImbalancePct:
      matchingMetric.orderBookImbalancePct,
    liquidityIsLive:
      matchingMetric.liquidityScore !== null
      && matchingMetric.spreadPct !== null
      && matchingMetric.topBookQuoteValue !== null,
    liquidityScore:
      normalizeLiquidityScore(
        matchingMetric.liquidityScore
        ?? fallback.liquidityScore,
      ),
    liquidityTitle:
      buildLiquidityTitle(
        matchingMetric,
      ),
    activityIsLive:
      matchingMetric.activityScore !== null,
    activityScore:
      normalizeActivityScore(
        matchingMetric.activityScore
        ?? fallback.activityScore,
      ),
    activityTitle:
      buildActivityTitle(
        matchingMetric,
      ),
    updatedAtLabel:
      formatScannerTradeTime(
        matchingMetric.updatedAt,
      ),
    sourceLabel: 'LIVE',
  };
}
