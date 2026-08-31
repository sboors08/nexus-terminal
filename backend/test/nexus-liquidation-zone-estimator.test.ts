import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import {
  estimateNexusLiquidationHeatmap,
} from '../src/modules/realtime-market-data/nexus-liquidation-zone-estimator.js';
import type {
  RealtimeLiquidation,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

const GENERATED_AT =
  '2026-08-30T12:00:00.000Z';

function metrics(
  overrides:
    Partial<MarketScannerMetrics> = {},
): MarketScannerMetrics {
  return {
    symbol: 'BTCUSDT',
    scannerWindow: '15m',
    windowMs: 15 * 60 * 1_000,
    price: 80_000,
    priceChangePct: 0.2,
    openInterest: 10_000,
    openInterestUpdatedAt:
      '2026-08-30T11:59:30.000Z',
    btcCorrelation: 1,
    relativeStrengthPct: 0,
    volumeAnomaly: 1,
    tradesAnomaly: 1,
    volatilityPct: 1.2,
    spreadPct: 0.01,
    topBookQuoteValue: 1_000_000,
    orderBookImbalancePct: 20,
    liquidityScore: 9,
    activityScore: 90,
    quoteVolume: 15_000_000,
    tradesCount: 20_000,
    tradesPerMinute: 1_000,
    buyTradesCount: 12_000,
    sellTradesCount: 8_000,
    buyQuoteVolume: 9_000_000,
    sellQuoteVolume: 6_000_000,
    windowStartedAt:
      '2026-08-30T11:45:00.000Z',
    updatedAt:
      '2026-08-30T11:59:45.000Z',
    ...overrides,
  };
}

function liquidation():
RealtimeLiquidation {
  return {
    symbol: 'BTCUSDT',
    pairSymbol: 'BTCUSDT',
    side: 'sell',
    orderType: 'LIMIT',
    timeInForce: 'IOC',
    originalQuantity: 1,
    price: 79_900,
    averagePrice: 79_900,
    orderStatus: 'FILLED',
    lastFilledQuantity: 1,
    filledQuantity: 1,
    tradeAt:
      '2026-08-30T11:59:00.000Z',
    updatedAt:
      '2026-08-30T11:59:00.100Z',
  };
}

test(
  'returns collecting without Open Interest and does not invent zones',
  () => {
    const result =
      estimateNexusLiquidationHeatmap({
        metrics: metrics({
          openInterest: null,
          openInterestUpdatedAt: null,
        }),
        liquidations: [
          liquidation(),
        ],
        generatedAt: GENERATED_AT,
        forceOrderStatus: 'live',
      });

    assert.equal(
      result.status,
      'collecting',
    );
    assert.equal(
      result.estimatedZones.length,
      0,
    );
    assert.equal(
      result.observedEvents.length,
      1,
    );
    assert.equal(
      result.observedEvents[0]
        ?.isEstimate,
      false,
    );
  },
);

test(
  'creates bounded long and short NEXUS estimates around market price',
  () => {
    const result =
      estimateNexusLiquidationHeatmap({
        metrics: metrics(),
        liquidations: [],
        generatedAt: GENERATED_AT,
        forceOrderStatus: 'live',
      });

    assert.equal(
      result.status,
      'ready',
    );
    assert.equal(
      result.estimatedZones.length,
      10,
    );

    const longZones =
      result.estimatedZones.filter(
        (zone) =>
          zone.liquidatedPositionSide
          === 'long',
      );

    const shortZones =
      result.estimatedZones.filter(
        (zone) =>
          zone.liquidatedPositionSide
          === 'short',
      );

    assert.equal(
      longZones.length,
      5,
    );
    assert.equal(
      shortZones.length,
      5,
    );

    assert.ok(
      longZones.every(
        (zone) =>
          zone.centerPrice < 80_000,
      ),
    );
    assert.ok(
      shortZones.every(
        (zone) =>
          zone.centerPrice > 80_000,
      ),
    );

    assert.ok(
      result.estimatedZones.every(
        (zone) =>
          zone.kind === 'estimated'
          && zone.source === 'nexus_model'
          && zone.isEstimate
          && zone.intensity >= 0
          && zone.intensity <= 1
          && zone.confidence >= 0
          && zone.confidence <= 0.72,
      ),
    );
  },
);

test(
  'trade flow and depth bias affect allocation without claiming exchange truth',
  () => {
    const result =
      estimateNexusLiquidationHeatmap({
        metrics: metrics(),
        liquidations: [],
        generatedAt: GENERATED_AT,
        forceOrderStatus: 'live',
      });

    const longNotional =
      result.estimatedZones
        .filter(
          (zone) =>
            zone.liquidatedPositionSide
            === 'long',
        )
        .reduce(
          (total, zone) =>
            total
            + zone.estimatedNotional,
          0,
        );

    const shortNotional =
      result.estimatedZones
        .filter(
          (zone) =>
            zone.liquidatedPositionSide
            === 'short',
        )
        .reduce(
          (total, zone) =>
            total
            + zone.estimatedNotional,
          0,
        );

    assert.ok(
      longNotional > shortNotional,
    );
    assert.equal(
      result.disclosure.estimated,
      'NEXUS_MODEL_NOT_EXCHANGE_FACT',
    );
  },
);

test(
  'keeps estimates but marks stale inputs as degraded',
  () => {
    const result =
      estimateNexusLiquidationHeatmap({
        metrics: metrics({
          openInterestUpdatedAt:
            '2026-08-30T11:00:00.000Z',
          updatedAt:
            '2026-08-30T11:00:00.000Z',
        }),
        liquidations: [],
        generatedAt: GENERATED_AT,
        forceOrderStatus: 'stale',
      });

    assert.equal(
      result.status,
      'degraded',
    );
    assert.equal(
      result.inputs.openInterest,
      'stale',
    );
    assert.equal(
      result.inputs.candles,
      'stale',
    );
    assert.equal(
      result.estimatedZones.length,
      10,
    );
  },
);

test(
  'rejects invalid generation time',
  () => {
    assert.throws(
      () =>
        estimateNexusLiquidationHeatmap({
          metrics: metrics(),
          liquidations: [],
          generatedAt: 'not-a-date',
          forceOrderStatus: 'live',
        }),
      /generation time/,
    );
  },
);
