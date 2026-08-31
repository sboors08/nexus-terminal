import {
  normalizeMarketScannerSymbol,
  type MarketScannerFetch,
} from './dashboardScannerMetrics.js';
import type {
  ScannerWindow,
} from '../config/tradingPresets.js';

export const LIQUIDATION_HEATMAP_PATH =
  '/api/v1/market/realtime/market-wide/liquidation-heatmap';

export const LIQUIDATION_HEATMAP_CONTRACT_VERSION =
  'liquidation-heatmap-v0.1' as const;

export const LIQUIDATION_HEATMAP_MODEL_VERSION =
  'nexus-liquidation-zones-v0.1' as const;

export const LIQUIDATION_HEATMAP_HISTORY_VERSION =
  'liquidation-heatmap-history-v0.1' as const;

export type LiquidatedPositionSide =
  | 'long'
  | 'short';

export type LiquidationHeatmapStatus =
  | 'collecting'
  | 'ready'
  | 'degraded';

export type LiquidationHeatmapInputStatus =
  | 'live'
  | 'stale'
  | 'unavailable';

export interface LiquidationHeatmapObservedEvent {
  id: string;
  kind: 'observed';
  source: 'binance_force_order';
  isEstimate: false;
  symbol: string;
  liquidatedPositionSide:
    LiquidatedPositionSide;
  executionSide: 'buy' | 'sell';
  price: number;
  quantity: number;
  notional: number;
  eventAt: string;
  receivedAt: string;
}

export interface LiquidationHeatmapEstimatedZone {
  id: string;
  kind: 'estimated';
  source: 'nexus_model';
  isEstimate: true;
  modelVersion:
    typeof LIQUIDATION_HEATMAP_MODEL_VERSION;
  symbol: string;
  liquidatedPositionSide:
    LiquidatedPositionSide;
  priceLow: number;
  priceHigh: number;
  centerPrice: number;
  estimatedNotional: number;
  intensity: number;
  confidence: number;
  leverageBand: number | null;
  startedAt: string;
  updatedAt: string;
  reasons: string[];
}

export interface LiquidationHeatmapInputState {
  forceOrder: LiquidationHeatmapInputStatus;
  openInterest: LiquidationHeatmapInputStatus;
  marketDepth: LiquidationHeatmapInputStatus;
  candles: LiquidationHeatmapInputStatus;
  markPrice: LiquidationHeatmapInputStatus;
}

export interface LiquidationHeatmapTimeBucket {
  historyVersion:
    typeof LIQUIDATION_HEATMAP_HISTORY_VERSION;
  symbol: string;
  timeframe: string;
  bucketStart: string;
  bucketEnd: string;
  generatedAt: string;
  status: LiquidationHeatmapStatus;
  marketPrice: number | null;
  inputs: LiquidationHeatmapInputState;
  observedEvents:
    LiquidationHeatmapObservedEvent[];
  estimatedZones:
    LiquidationHeatmapEstimatedZone[];
}

export interface LiquidationHeatmapSnapshot {
  contractVersion:
    typeof LIQUIDATION_HEATMAP_CONTRACT_VERSION;
  modelVersion:
    typeof LIQUIDATION_HEATMAP_MODEL_VERSION;
  symbol: string;
  timeframe: string;
  status: LiquidationHeatmapStatus;
  marketPrice: number | null;
  generatedAt: string;
  inputs: LiquidationHeatmapInputState;
  observedEvents:
    LiquidationHeatmapObservedEvent[];
  estimatedZones:
    LiquidationHeatmapEstimatedZone[];
  historyBuckets:
    LiquidationHeatmapTimeBucket[];
  disclosure: {
    observed:
      'BINANCE_FORCE_ORDER_EXECUTED';
    estimated:
      'NEXUS_MODEL_NOT_EXCHANGE_FACT';
  };
}

export interface FetchLiquidationHeatmapOptions {
  baseUrl?: string;
  symbol: string;
  scannerWindow?: ScannerWindow;
  limit?: number;
  historyLimit?: number;
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
  value: Record<string, unknown>,
  key: string,
): string {
  const field = value[key];

  if (
    typeof field !== 'string'
    || field.trim().length === 0
  ) {
    throw new Error(
      `Invalid liquidation heatmap: ${key}`,
    );
  }

  return field;
}

function readNumber(
  value: Record<string, unknown>,
  key: string,
): number {
  const field = value[key];

  if (
    typeof field !== 'number'
    || !Number.isFinite(field)
  ) {
    throw new Error(
      `Invalid liquidation heatmap: ${key}`,
    );
  }

  return field;
}

function readNullableNumber(
  value: Record<string, unknown>,
  key: string,
): number | null {
  if (value[key] === null) {
    return null;
  }

  return readNumber(value, key);
}

function readBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean {
  const field = value[key];

  if (typeof field !== 'boolean') {
    throw new Error(
      `Invalid liquidation heatmap: ${key}`,
    );
  }

  return field;
}

function readTimestamp(
  value: Record<string, unknown>,
  key: string,
): string {
  const timestamp = readString(value, key);

  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(
      `Invalid liquidation heatmap timestamp: ${key}`,
    );
  }

  return timestamp;
}

function readEnum<TValue extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly TValue[],
): TValue {
  const field = readString(value, key);

  if (!allowed.includes(field as TValue)) {
    throw new Error(
      `Invalid liquidation heatmap: ${key}`,
    );
  }

  return field as TValue;
}

function readInputStatus(
  value: Record<string, unknown>,
  key: string,
): LiquidationHeatmapInputStatus {
  return readEnum(
    value,
    key,
    ['live', 'stale', 'unavailable'],
  );
}

function parseObservedEvent(
  value: unknown,
): LiquidationHeatmapObservedEvent {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid observed liquidation event',
    );
  }

  const event: LiquidationHeatmapObservedEvent = {
    id: readString(value, 'id'),
    kind: readEnum(value, 'kind', ['observed']),
    source: readEnum(
      value,
      'source',
      ['binance_force_order'],
    ),
    isEstimate: readBoolean(value, 'isEstimate') as false,
    symbol: normalizeMarketScannerSymbol(
      readString(value, 'symbol'),
    ),
    liquidatedPositionSide: readEnum(
      value,
      'liquidatedPositionSide',
      ['long', 'short'],
    ),
    executionSide: readEnum(
      value,
      'executionSide',
      ['buy', 'sell'],
    ),
    price: readNumber(value, 'price'),
    quantity: readNumber(value, 'quantity'),
    notional: readNumber(value, 'notional'),
    eventAt: readTimestamp(value, 'eventAt'),
    receivedAt: readTimestamp(value, 'receivedAt'),
  };

  if (
    event.isEstimate
    || event.price <= 0
    || event.quantity <= 0
    || event.notional <= 0
    || (
      event.executionSide === 'sell'
      && event.liquidatedPositionSide !== 'long'
    )
    || (
      event.executionSide === 'buy'
      && event.liquidatedPositionSide !== 'short'
    )
  ) {
    throw new Error(
      'Invalid observed liquidation values',
    );
  }

  return event;
}

function parseEstimatedZone(
  value: unknown,
): LiquidationHeatmapEstimatedZone {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid estimated liquidation zone',
    );
  }

  const reasons = value.reasons;

  if (
    !Array.isArray(reasons)
    || !reasons.every(
      (reason) =>
        typeof reason === 'string'
        && reason.length > 0,
    )
  ) {
    throw new Error(
      'Invalid liquidation heatmap: reasons',
    );
  }

  const leverageBand = readNullableNumber(
    value,
    'leverageBand',
  );

  const zone: LiquidationHeatmapEstimatedZone = {
    id: readString(value, 'id'),
    kind: readEnum(value, 'kind', ['estimated']),
    source: readEnum(value, 'source', ['nexus_model']),
    isEstimate: readBoolean(value, 'isEstimate') as true,
    modelVersion: readEnum(
      value,
      'modelVersion',
      [LIQUIDATION_HEATMAP_MODEL_VERSION],
    ),
    symbol: normalizeMarketScannerSymbol(
      readString(value, 'symbol'),
    ),
    liquidatedPositionSide: readEnum(
      value,
      'liquidatedPositionSide',
      ['long', 'short'],
    ),
    priceLow: readNumber(value, 'priceLow'),
    priceHigh: readNumber(value, 'priceHigh'),
    centerPrice: readNumber(value, 'centerPrice'),
    estimatedNotional: readNumber(
      value,
      'estimatedNotional',
    ),
    intensity: readNumber(value, 'intensity'),
    confidence: readNumber(value, 'confidence'),
    leverageBand,
    startedAt: readTimestamp(value, 'startedAt'),
    updatedAt: readTimestamp(value, 'updatedAt'),
    reasons: [...reasons] as string[],
  };

  if (
    !zone.isEstimate
    || zone.priceLow <= 0
    || zone.priceHigh < zone.priceLow
    || zone.centerPrice < zone.priceLow
    || zone.centerPrice > zone.priceHigh
    || zone.estimatedNotional < 0
    || zone.intensity < 0
    || zone.intensity > 1
    || zone.confidence < 0
    || zone.confidence > 0.72
    || (
      leverageBand !== null
      && leverageBand <= 0
    )
  ) {
    throw new Error(
      'Invalid estimated liquidation values',
    );
  }

  return zone;
}

function parseInputState(
  value: unknown,
): LiquidationHeatmapInputState {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid liquidation heatmap inputs',
    );
  }

  return {
    forceOrder: readInputStatus(value, 'forceOrder'),
    openInterest: readInputStatus(value, 'openInterest'),
    marketDepth: readInputStatus(value, 'marketDepth'),
    candles: readInputStatus(value, 'candles'),
    markPrice: readInputStatus(value, 'markPrice'),
  };
}

function parseTimeBucket(
  value: unknown,
): LiquidationHeatmapTimeBucket {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid liquidation heatmap history bucket',
    );
  }

  const observedEvents = value.observedEvents;
  const estimatedZones = value.estimatedZones;

  if (
    !Array.isArray(observedEvents)
    || !Array.isArray(estimatedZones)
  ) {
    throw new Error(
      'Invalid liquidation heatmap history structure',
    );
  }

  const bucket: LiquidationHeatmapTimeBucket = {
    historyVersion: readEnum(
      value,
      'historyVersion',
      [LIQUIDATION_HEATMAP_HISTORY_VERSION],
    ),
    symbol: normalizeMarketScannerSymbol(
      readString(value, 'symbol'),
    ),
    timeframe: readString(value, 'timeframe'),
    bucketStart: readTimestamp(value, 'bucketStart'),
    bucketEnd: readTimestamp(value, 'bucketEnd'),
    generatedAt: readTimestamp(value, 'generatedAt'),
    status: readEnum(
      value,
      'status',
      ['collecting', 'ready', 'degraded'],
    ),
    marketPrice: readNullableNumber(value, 'marketPrice'),
    inputs: parseInputState(value.inputs),
    observedEvents: observedEvents.map(parseObservedEvent),
    estimatedZones: estimatedZones.map(parseEstimatedZone),
  };

  if (
    Date.parse(bucket.bucketEnd)
      <= Date.parse(bucket.bucketStart)
    || (
      bucket.marketPrice !== null
      && bucket.marketPrice <= 0
    )
  ) {
    throw new Error(
      'Invalid liquidation heatmap history values',
    );
  }

  return bucket;
}

export function parseLiquidationHeatmapSnapshot(
  value: unknown,
): LiquidationHeatmapSnapshot {
  if (!isRecord(value)) {
    throw new Error(
      'Invalid liquidation heatmap response',
    );
  }

  const inputs = value.inputs;
  const disclosure = value.disclosure;
  const observedEvents = value.observedEvents;
  const estimatedZones = value.estimatedZones;
  const historyBuckets = value.historyBuckets;

  if (
    !isRecord(inputs)
    || !isRecord(disclosure)
    || !Array.isArray(observedEvents)
    || !Array.isArray(estimatedZones)
    || !Array.isArray(historyBuckets)
  ) {
    throw new Error(
      'Invalid liquidation heatmap response structure',
    );
  }

  const snapshot: LiquidationHeatmapSnapshot = {
    contractVersion: readEnum(
      value,
      'contractVersion',
      [LIQUIDATION_HEATMAP_CONTRACT_VERSION],
    ),
    modelVersion: readEnum(
      value,
      'modelVersion',
      [LIQUIDATION_HEATMAP_MODEL_VERSION],
    ),
    symbol: normalizeMarketScannerSymbol(
      readString(value, 'symbol'),
    ),
    timeframe: readString(value, 'timeframe'),
    status: readEnum(
      value,
      'status',
      ['collecting', 'ready', 'degraded'],
    ),
    marketPrice: readNullableNumber(value, 'marketPrice'),
    generatedAt: readTimestamp(value, 'generatedAt'),
    inputs: parseInputState(inputs),
    observedEvents: observedEvents.map(parseObservedEvent),
    estimatedZones: estimatedZones.map(parseEstimatedZone),
    historyBuckets: historyBuckets.map(parseTimeBucket),
    disclosure: {
      observed: readEnum(
        disclosure,
        'observed',
        ['BINANCE_FORCE_ORDER_EXECUTED'],
      ),
      estimated: readEnum(
        disclosure,
        'estimated',
        ['NEXUS_MODEL_NOT_EXCHANGE_FACT'],
      ),
    },
  };

  if (
    snapshot.marketPrice !== null
    && snapshot.marketPrice <= 0
  ) {
    throw new Error(
      'Invalid liquidation heatmap market price',
    );
  }

  return snapshot;
}

function normalizeLimit(
  limit: number | undefined,
): number {
  const normalized = limit ?? 250;

  if (
    !Number.isInteger(normalized)
    || normalized < 1
    || normalized > 1_000
  ) {
    throw new Error(
      'Liquidation heatmap limit must be an integer from 1 to 1000',
    );
  }

  return normalized;
}

function normalizeHistoryLimit(
  limit: number | undefined,
): number {
  const normalized = limit ?? 360;

  if (
    !Number.isInteger(normalized)
    || normalized < 1
    || normalized > 1_440
  ) {
    throw new Error(
      'Liquidation heatmap history limit must be an integer from 1 to 1440',
    );
  }

  return normalized;
}

export function buildLiquidationHeatmapUrl(
  options: Pick<
    FetchLiquidationHeatmapOptions,
    | 'baseUrl'
    | 'symbol'
    | 'scannerWindow'
    | 'limit'
    | 'historyLimit'
  >,
): string {
  const symbol = normalizeMarketScannerSymbol(
    options.symbol,
  );

  if (symbol.length === 0) {
    throw new Error(
      'Liquidation heatmap symbol is required',
    );
  }

  const params = new URLSearchParams({
    symbol,
    scannerWindow: options.scannerWindow ?? '1m',
    limit: String(normalizeLimit(options.limit)),
    historyLimit: String(
      normalizeHistoryLimit(options.historyLimit),
    ),
  });

  const baseUrl = options.baseUrl
    ?.trim()
    .replace(/\/+$/, '')
    ?? '';

  return `${baseUrl}${LIQUIDATION_HEATMAP_PATH}?${params.toString()}`;
}

const defaultFetch: MarketScannerFetch = (
  input,
  init,
) => globalThis.fetch(input, init);

export async function fetchLiquidationHeatmap(
  options: FetchLiquidationHeatmapOptions,
): Promise<LiquidationHeatmapSnapshot> {
  const response = await (
    options.fetcher
    ?? defaultFetch
  )(
    buildLiquidationHeatmapUrl(options),
    {
      headers: {
        accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Liquidation heatmap request failed: ${response.status}`,
    );
  }

  return parseLiquidationHeatmapSnapshot(
    await response.json(),
  );
}

export function resolveLiquidationHeatColor(
  intensity: number,
): string {
  const normalized = Math.min(
    1,
    Math.max(0, intensity),
  );

  if (normalized >= 0.78) {
    return '#f7df3f';
  }

  if (normalized >= 0.5) {
    return '#17d6a3';
  }

  if (normalized >= 0.25) {
    return '#147aa8';
  }

  return '#512e91';
}
