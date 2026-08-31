import type {
  RealtimeLiquidation,
} from './realtime-market-data.types.js';

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

function resolvePositiveValue(
  values: number[],
  label: string,
): number {
  const value = values.find(
    (candidate) =>
      Number.isFinite(candidate)
      && candidate > 0,
  );

  if (value === undefined) {
    throw new Error(
      `Liquidation ${label} is unavailable`,
    );
  }

  return value;
}

export function resolveLiquidatedPositionSide(
  executionSide: 'buy' | 'sell',
): LiquidatedPositionSide {
  return executionSide === 'sell'
    ? 'long'
    : 'short';
}

export function toLiquidationHeatmapObservedEvent(
  value: RealtimeLiquidation,
): LiquidationHeatmapObservedEvent {
  const price = resolvePositiveValue(
    [
      value.averagePrice,
      value.price,
    ],
    'price',
  );

  const quantity = resolvePositiveValue(
    [
      value.filledQuantity,
      value.lastFilledQuantity,
      value.originalQuantity,
    ],
    'quantity',
  );

  const eventKey = [
    value.symbol,
    value.tradeAt,
    value.side,
    price,
    quantity,
  ].join(':');

  return {
    id: `binance-force-order:${eventKey}`,
    kind: 'observed',
    source: 'binance_force_order',
    isEstimate: false,
    symbol: value.symbol,
    liquidatedPositionSide:
      resolveLiquidatedPositionSide(
        value.side,
      ),
    executionSide: value.side,
    price,
    quantity,
    notional: price * quantity,
    eventAt: value.tradeAt,
    receivedAt: value.updatedAt,
  };
}
