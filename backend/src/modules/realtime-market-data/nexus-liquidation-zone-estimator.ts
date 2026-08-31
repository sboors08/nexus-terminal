import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import {
  LIQUIDATION_HEATMAP_CONTRACT_VERSION,
  LIQUIDATION_HEATMAP_MODEL_VERSION,
  toLiquidationHeatmapObservedEvent,
  type LiquidatedPositionSide,
  type LiquidationHeatmapEstimatedZone,
  type LiquidationHeatmapInputStatus,
  type LiquidationHeatmapSnapshot,
} from './liquidation-heatmap-contract.js';
import type {
  RealtimeLiquidation,
} from './realtime-market-data.types.js';

const LIVE_INPUT_AGE_MS =
  2 * 60 * 1_000;

const LEVERAGE_BANDS = [
  {
    leverage: 5,
    weight: 0.08,
    confidenceFactor: 0.60,
  },
  {
    leverage: 10,
    weight: 0.16,
    confidenceFactor: 0.72,
  },
  {
    leverage: 25,
    weight: 0.28,
    confidenceFactor: 0.88,
  },
  {
    leverage: 50,
    weight: 0.28,
    confidenceFactor: 0.90,
  },
  {
    leverage: 100,
    weight: 0.20,
    confidenceFactor: 0.78,
  },
] as const;

export interface NexusLiquidationZoneEstimatorInput {
  metrics: MarketScannerMetrics;
  liquidations: RealtimeLiquidation[];
  generatedAt: string;
  forceOrderStatus:
    LiquidationHeatmapInputStatus;
  markPrice?: number | null;
  markPriceUpdatedAt?: string | null;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 8,
): number {
  const factor = 10 ** decimals;

  return Math.round(
    value * factor,
  ) / factor;
}

function parseTime(
  value: string,
  label: string,
): number {
  const timestamp = Date.parse(
    value,
  );

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid liquidation heatmap ${label}`,
    );
  }

  return timestamp;
}

function resolveInputStatus(
  updatedAt: string | null | undefined,
  generatedAtMs: number,
): LiquidationHeatmapInputStatus {
  if (!updatedAt) {
    return 'unavailable';
  }

  const updatedAtMs = Date.parse(
    updatedAt,
  );

  if (!Number.isFinite(updatedAtMs)) {
    return 'unavailable';
  }

  const ageMs = Math.max(
    0,
    generatedAtMs - updatedAtMs,
  );

  return ageMs <= LIVE_INPUT_AGE_MS
    ? 'live'
    : 'stale';
}

function resolveMarketPrice(
  input: NexusLiquidationZoneEstimatorInput,
): number | null {
  const candidates = [
    input.markPrice,
    input.metrics.price,
  ];

  const value = candidates.find(
    (candidate) =>
      candidate !== null
      && candidate !== undefined
      && Number.isFinite(candidate)
      && candidate > 0,
  );

  return value ?? null;
}

function resolveLongCrowdingShare(
  metrics: MarketScannerMetrics,
): number {
  const totalQuoteVolume =
    metrics.buyQuoteVolume
    + metrics.sellQuoteVolume;

  const tradeFlowBias =
    totalQuoteVolume > 0
      ? (
          metrics.buyQuoteVolume
          - metrics.sellQuoteVolume
        ) / totalQuoteVolume
      : 0;

  const depthBias =
    metrics.orderBookImbalancePct === null
      ? 0
      : clamp(
          metrics.orderBookImbalancePct
          / 100,
          -1,
          1,
        );

  return clamp(
    0.5
    + tradeFlowBias * 0.15
    + depthBias * 0.10,
    0.25,
    0.75,
  );
}

function resolveModelConfidence(
  inputStatuses:
    LiquidationHeatmapSnapshot['inputs'],
  metrics: MarketScannerMetrics,
): number {
  let confidence = 0.20;

  confidence +=
    inputStatuses.openInterest === 'live'
      ? 0.20
      : inputStatuses.openInterest === 'stale'
        ? 0.08
        : 0;

  confidence +=
    inputStatuses.candles === 'live'
      ? 0.12
      : inputStatuses.candles === 'stale'
        ? 0.04
        : 0;

  confidence +=
    inputStatuses.marketDepth === 'live'
      ? 0.10
      : 0;

  confidence +=
    inputStatuses.forceOrder === 'live'
      ? 0.05
      : 0;

  if (
    metrics.buyQuoteVolume
      + metrics.sellQuoteVolume
    > 0
  ) {
    confidence += 0.05;
  }

  return round(
    clamp(
      confidence,
      0.20,
      0.72,
    ),
    4,
  );
}

function createZone(
  symbol: string,
  marketPrice: number,
  openInterestNotional: number,
  positionSide: LiquidatedPositionSide,
  sideShare: number,
  volatilityPct: number,
  generatedAt: string,
  modelConfidence: number,
  band: typeof LEVERAGE_BANDS[number],
  maximumWeightedShare: number,
  metrics: MarketScannerMetrics,
): LiquidationHeatmapEstimatedZone {
  const liquidationDistanceFraction =
    0.9 / band.leverage;

  const centerPrice =
    positionSide === 'long'
      ? marketPrice
        * (1 - liquidationDistanceFraction)
      : marketPrice
        * (1 + liquidationDistanceFraction);

  const widthFraction = clamp(
    Math.max(
      volatilityPct,
      0,
    ) / 100 * 0.20
      + 0.001,
    0.001,
    0.01,
  );

  const weightedShare =
    sideShare * band.weight;

  const reasons = [
    'open_interest_distribution',
    `leverage_band_${band.leverage}x`,
    'volatility_zone_width',
  ];

  if (
    metrics.orderBookImbalancePct
    !== null
  ) {
    reasons.push(
      'market_depth_bias',
    );
  }

  if (
    metrics.buyQuoteVolume
      + metrics.sellQuoteVolume
    > 0
  ) {
    reasons.push(
      'trade_flow_bias',
    );
  }

  return {
    id: [
      LIQUIDATION_HEATMAP_MODEL_VERSION,
      symbol,
      positionSide,
      `${band.leverage}x`,
      generatedAt,
    ].join(':'),
    kind: 'estimated',
    source: 'nexus_model',
    isEstimate: true,
    modelVersion:
      LIQUIDATION_HEATMAP_MODEL_VERSION,
    symbol,
    liquidatedPositionSide:
      positionSide,
    priceLow: round(
      centerPrice
      * (1 - widthFraction / 2),
    ),
    priceHigh: round(
      centerPrice
      * (1 + widthFraction / 2),
    ),
    centerPrice: round(
      centerPrice,
    ),
    estimatedNotional: round(
      openInterestNotional
      * weightedShare,
      2,
    ),
    intensity: round(
      weightedShare
      / maximumWeightedShare,
      4,
    ),
    confidence: round(
      modelConfidence
      * band.confidenceFactor,
      4,
    ),
    leverageBand:
      band.leverage,
    startedAt: generatedAt,
    updatedAt: generatedAt,
    reasons,
  };
}

export function estimateNexusLiquidationHeatmap(
  input: NexusLiquidationZoneEstimatorInput,
): LiquidationHeatmapSnapshot {
  const generatedAtMs = parseTime(
    input.generatedAt,
    'generation time',
  );

  const symbol =
    input.metrics.symbol
      .trim()
      .toUpperCase();

  const marketPrice =
    resolveMarketPrice(
      input,
    );

  const candleStatus =
    resolveInputStatus(
      input.metrics.updatedAt,
      generatedAtMs,
    );

  const openInterestStatus =
    resolveInputStatus(
      input.metrics
        .openInterestUpdatedAt,
      generatedAtMs,
    );

  const depthStatus =
    input.metrics
      .orderBookImbalancePct
      === null
      ? 'unavailable'
      : candleStatus;

  const markPriceStatus =
    input.markPrice === null
      || input.markPrice === undefined
      ? 'unavailable'
      : resolveInputStatus(
          input.markPriceUpdatedAt,
          generatedAtMs,
        );

  const inputs:
    LiquidationHeatmapSnapshot['inputs'] = {
      forceOrder:
        input.forceOrderStatus,
      openInterest:
        openInterestStatus,
      marketDepth:
        depthStatus,
      candles:
        candleStatus,
      markPrice:
        markPriceStatus,
    };

  const observedEvents = input
    .liquidations
    .filter(
      (liquidation) =>
        liquidation.symbol === symbol,
    )
    .map(
      toLiquidationHeatmapObservedEvent,
    )
    .sort(
      (left, right) =>
        left.eventAt.localeCompare(
          right.eventAt,
        ),
    );

  const openInterest =
    input.metrics.openInterest;

  const hasRequiredModelInputs =
    marketPrice !== null
    && openInterest !== null
    && openInterest !== undefined
    && Number.isFinite(openInterest)
    && openInterest > 0;

  if (!hasRequiredModelInputs) {
    return {
      contractVersion:
        LIQUIDATION_HEATMAP_CONTRACT_VERSION,
      modelVersion:
        LIQUIDATION_HEATMAP_MODEL_VERSION,
      symbol,
      timeframe:
        input.metrics.scannerWindow,
      status: 'collecting',
      marketPrice,
      generatedAt: input.generatedAt,
      inputs,
      observedEvents,
      estimatedZones: [],
      historyBuckets: [],
      disclosure: {
        observed:
          'BINANCE_FORCE_ORDER_EXECUTED',
        estimated:
          'NEXUS_MODEL_NOT_EXCHANGE_FACT',
      },
    };
  }

  const longShare =
    resolveLongCrowdingShare(
      input.metrics,
    );

  const shortShare =
    1 - longShare;

  const maximumWeightedShare =
    Math.max(
      ...LEVERAGE_BANDS.flatMap(
        (band) => [
          longShare * band.weight,
          shortShare * band.weight,
        ],
      ),
    );

  const modelConfidence =
    resolveModelConfidence(
      inputs,
      input.metrics,
    );

  const openInterestNotional =
    openInterest * marketPrice;

  const volatilityPct =
    input.metrics.volatilityPct
    ?? 0;

  const estimatedZones =
    LEVERAGE_BANDS.flatMap(
      (band) => [
        createZone(
          symbol,
          marketPrice,
          openInterestNotional,
          'long',
          longShare,
          volatilityPct,
          input.generatedAt,
          modelConfidence,
          band,
          maximumWeightedShare,
          input.metrics,
        ),
        createZone(
          symbol,
          marketPrice,
          openInterestNotional,
          'short',
          shortShare,
          volatilityPct,
          input.generatedAt,
          modelConfidence,
          band,
          maximumWeightedShare,
          input.metrics,
        ),
      ],
    );

  const status =
    openInterestStatus === 'live'
    && candleStatus === 'live'
      ? 'ready'
      : 'degraded';

  return {
    contractVersion:
      LIQUIDATION_HEATMAP_CONTRACT_VERSION,
    modelVersion:
      LIQUIDATION_HEATMAP_MODEL_VERSION,
    symbol,
    timeframe:
      input.metrics.scannerWindow,
    status,
    marketPrice,
    generatedAt: input.generatedAt,
    inputs,
    observedEvents,
    estimatedZones,
    historyBuckets: [],
    disclosure: {
      observed:
        'BINANCE_FORCE_ORDER_EXECUTED',
      estimated:
        'NEXUS_MODEL_NOT_EXCHANGE_FACT',
    },
  };
}
