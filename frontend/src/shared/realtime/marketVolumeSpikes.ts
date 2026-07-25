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

export const MARKET_VOLUME_SPIKE_PERIOD_MINUTES = [
  1,
  3,
  5,
  15,
] as const;

export type MarketVolumeSpikePeriodMinutes =
  typeof MARKET_VOLUME_SPIKE_PERIOD_MINUTES[number];

export interface FetchMarketVolumeSpikesOptions {
  baseUrl?: string;
  symbol?: string;
  limit?: number;
  periodMinutes?: MarketVolumeSpikePeriodMinutes;
  baselinePeriods?: number;
  minVolumeRatio?: number;
  minTradesRatio?: number;
  minCurrentQuoteVolume?: number;
  statuses?: readonly MarketVolumeSpikeStatus[];
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

function normalizePeriodMinutes(
  value:
    MarketVolumeSpikePeriodMinutes
    | undefined,
): MarketVolumeSpikePeriodMinutes | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !MARKET_VOLUME_SPIKE_PERIOD_MINUTES
      .includes(value)
  ) {
    throw new Error(
      'Volume spike periodMinutes must be one of: 1, 3, 5, 15',
    );
  }

  return value;
}

function normalizeIntegerRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new Error(
      `Volume spike ${label} must be an integer from ${minimum} to ${maximum}`,
    );
  }

  return value;
}

function normalizeNumberRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isFinite(value)
    || value < minimum
    || value > maximum
  ) {
    throw new Error(
      `Volume spike ${label} must be from ${minimum} to ${maximum}`,
    );
  }

  return value;
}

function normalizeStatuses(
  statuses:
    readonly MarketVolumeSpikeStatus[]
    | undefined,
): readonly MarketVolumeSpikeStatus[] | undefined {
  if (statuses === undefined) {
    return undefined;
  }

  if (
    statuses.length === 0
    || statuses.some(
      (status) =>
        !MARKET_VOLUME_SPIKE_STATUSES
          .includes(status),
    )
  ) {
    throw new Error(
      'Volume spike statuses must contain only: new, growing, stable, fading',
    );
  }

  return [
    ...new Set(statuses),
  ];
}

export function buildMarketVolumeSpikesUrl(
  options:
    Pick<
      FetchMarketVolumeSpikesOptions,
      | 'baseUrl'
      | 'symbol'
      | 'limit'
      | 'periodMinutes'
      | 'baselinePeriods'
      | 'minVolumeRatio'
      | 'minTradesRatio'
      | 'minCurrentQuoteVolume'
      | 'statuses'
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

  const periodMinutes =
    normalizePeriodMinutes(
      options.periodMinutes,
    );

  if (periodMinutes !== undefined) {
    params.set(
      'periodMinutes',
      String(periodMinutes),
    );
  }

  const baselinePeriods =
    normalizeIntegerRange(
      options.baselinePeriods,
      3,
      48,
      'baselinePeriods',
    );

  if (baselinePeriods !== undefined) {
    params.set(
      'baselinePeriods',
      String(baselinePeriods),
    );
  }

  const minVolumeRatio =
    normalizeNumberRange(
      options.minVolumeRatio,
      1,
      100,
      'minVolumeRatio',
    );

  if (minVolumeRatio !== undefined) {
    params.set(
      'minVolumeRatio',
      String(minVolumeRatio),
    );
  }

  const minTradesRatio =
    normalizeNumberRange(
      options.minTradesRatio,
      0.1,
      100,
      'minTradesRatio',
    );

  if (minTradesRatio !== undefined) {
    params.set(
      'minTradesRatio',
      String(minTradesRatio),
    );
  }

  const minCurrentQuoteVolume =
    normalizeNumberRange(
      options.minCurrentQuoteVolume,
      0,
      1_000_000_000_000,
      'minCurrentQuoteVolume',
    );

  if (
    minCurrentQuoteVolume
    !== undefined
  ) {
    params.set(
      'minCurrentQuoteVolume',
      String(
        minCurrentQuoteVolume,
      ),
    );
  }

  const statuses =
    normalizeStatuses(
      options.statuses,
    );

  if (statuses !== undefined) {
    params.set(
      'statuses',
      statuses.join(','),
    );
  }

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
