import {
  normalizeMarketScannerSymbol,
  parseMarketScannerMetric,
  type MarketScannerMetrics,
  type MarketScannerFetch,
} from './dashboardScannerMetrics.js';
import type {
  ScannerWindow,
} from '../config/tradingPresets.js';

export const MARKET_WIDE_SCANNER_METRICS_PATH =
  '/api/v1/market/realtime/market-wide/scanner-metrics';

export interface FetchMarketWideScannerMetricsOptions {
  baseUrl?: string;
  symbol?: string;
  scannerWindow?: ScannerWindow;
  fetcher?: MarketScannerFetch;
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

export function buildMarketWideScannerMetricsUrl(
  options:
    Pick<
      FetchMarketWideScannerMetricsOptions,
      | 'baseUrl'
      | 'symbol'
      | 'scannerWindow'
    > = {},
): string {
  const params =
    new URLSearchParams();

  params.set(
    'scannerWindow',
    options.scannerWindow
    ?? '1m',
  );

  if (options.symbol) {
    params.set(
      'symbol',
      normalizeMarketScannerSymbol(
        options.symbol,
      ),
    );
  }

  return (
    `${resolveBaseUrl(options.baseUrl)}`
    + MARKET_WIDE_SCANNER_METRICS_PATH
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

export async function fetchMarketWideScannerMetrics(
  options:
    FetchMarketWideScannerMetricsOptions = {},
): Promise<
  MarketScannerMetrics[]
> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      buildMarketWideScannerMetricsUrl(
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
      `Market-wide scanner metrics request failed: ${response.status}`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      'Invalid market-wide scanner metrics response',
    );
  }

  return payload.map(
    parseMarketScannerMetric,
  );
}

export function indexMarketWideScannerMetrics(
  metrics:
    readonly MarketScannerMetrics[],
): Record<
  string,
  MarketScannerMetrics
> {
  const indexed: Record<
    string,
    MarketScannerMetrics
  > = {};

  for (const metric of metrics) {
    indexed[metric.symbol] = {
      ...metric,
    };
  }

  return indexed;
}