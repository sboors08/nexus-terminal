import {
  normalizeMarketScannerSymbol,
  type MarketScannerFetch,
} from './dashboardScannerMetrics.js';

export const MARKET_VOLUME_SPIKES_PATH =
  '/api/v1/market/realtime/market-wide/volume-spikes';

export type MarketVolumeSpikeStatus =
  | 'new'
  | 'growing'
  | 'stable'
  | 'fading';

export interface MarketVolumeSpike {
  symbol: string;
  status: MarketVolumeSpikeStatus;
  periodMinutes: number;
  baselinePeriods: number;
  currentQuoteVolume: number;
  previousQuoteVolume: number;
  baselineQuoteVolume: number;
  volumeRatio: number;
  previousVolumeRatio: number;
  currentTradesCount: number;
  previousTradesCount: number;
  baselineTradesCount: number;
  tradesRatio: number;
  priceChangePct: number | null;
  periodStartedAt: string;
  updatedAt: string;
}

export interface FetchMarketVolumeSpikesOptions {
  baseUrl?: string;
  symbol?: string;
  limit?: number;
  fetcher?: MarketScannerFetch;
}

const MARKET_VOLUME_SPIKE_STATUSES:
readonly MarketVolumeSpikeStatus[] = [
  'new',
  'growing',
  'stable',
  'fading',
];

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

function normalizeLimit(
  limit: number | undefined,
): number {
  const normalized = limit ?? 20;

  if (
    !Number.isInteger(normalized)
    || normalized < 1
    || normalized > 100
  ) {
    throw new Error(
      'Volume spike limit must be an integer from 1 to 100',
    );
  }

  return normalized;
}

export function buildMarketVolumeSpikesUrl(
  options:
    Pick<
      FetchMarketVolumeSpikesOptions,
      | 'baseUrl'
      | 'symbol'
      | 'limit'
    > = {},
): string {
  const params = new URLSearchParams();

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
    `${resolveBaseUrl(options.baseUrl)}`
    + MARKET_VOLUME_SPIKES_PATH
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
      `Invalid market volume spike: ${key}`,
    );
  }

  return value;
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
      `Invalid market volume spike: ${key}`,
    );
  }

  return value;
}

function readNullableNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];

  if (value === null) {
    return null;
  }

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid market volume spike: ${key}`,
    );
  }

  return value;
}

function readStatus(
  record: Record<string, unknown>,
): MarketVolumeSpikeStatus {
  const value = record.status;

  if (
    typeof value !== 'string'
    || !MARKET_VOLUME_SPIKE_STATUSES.includes(
      value as MarketVolumeSpikeStatus,
    )
  ) {
    throw new Error(
      'Invalid market volume spike: status',
    );
  }

  return value as MarketVolumeSpikeStatus;
}

export function parseMarketVolumeSpike(
  value: unknown,
): MarketVolumeSpike {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid market volume spike response item',
    );
  }

  return {
    symbol: normalizeMarketScannerSymbol(
      readString(value, 'symbol'),
    ),
    status: readStatus(value),
    periodMinutes: readNumber(
      value,
      'periodMinutes',
    ),
    baselinePeriods: readNumber(
      value,
      'baselinePeriods',
    ),
    currentQuoteVolume: readNumber(
      value,
      'currentQuoteVolume',
    ),
    previousQuoteVolume: readNumber(
      value,
      'previousQuoteVolume',
    ),
    baselineQuoteVolume: readNumber(
      value,
      'baselineQuoteVolume',
    ),
    volumeRatio: readNumber(
      value,
      'volumeRatio',
    ),
    previousVolumeRatio: readNumber(
      value,
      'previousVolumeRatio',
    ),
    currentTradesCount: readNumber(
      value,
      'currentTradesCount',
    ),
    previousTradesCount: readNumber(
      value,
      'previousTradesCount',
    ),
    baselineTradesCount: readNumber(
      value,
      'baselineTradesCount',
    ),
    tradesRatio: readNumber(
      value,
      'tradesRatio',
    ),
    priceChangePct: readNullableNumber(
      value,
      'priceChangePct',
    ),
    periodStartedAt: readString(
      value,
      'periodStartedAt',
    ),
    updatedAt: readString(
      value,
      'updatedAt',
    ),
  };
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

export async function fetchMarketVolumeSpikes(
  options:
    FetchMarketVolumeSpikesOptions = {},
): Promise<MarketVolumeSpike[]> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      buildMarketVolumeSpikesUrl(
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
      `Market volume spikes request failed: ${response.status}`,
    );
  }

  const payload: unknown =
    await response.json();

  if (!Array.isArray(payload)) {
    throw new Error(
      'Invalid market volume spikes response',
    );
  }

  return payload.map(
    parseMarketVolumeSpike,
  );
}
