import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIQUIDATION_HEATMAP_CONTRACT_VERSION,
  LIQUIDATION_HEATMAP_HISTORY_VERSION,
  LIQUIDATION_HEATMAP_MODEL_VERSION,
  resolveLiquidatedPositionSide,
  toLiquidationHeatmapObservedEvent,
} from '../src/modules/realtime-market-data/liquidation-heatmap-contract.js';
import type {
  RealtimeLiquidation,
} from '../src/modules/realtime-market-data/realtime-market-data.types.js';

function liquidation(
  overrides:
    Partial<RealtimeLiquidation> = {},
): RealtimeLiquidation {
  return {
    symbol: 'BTCUSDT',
    pairSymbol: 'BTCUSDT',
    side: 'sell',
    orderType: 'LIMIT',
    timeInForce: 'IOC',
    originalQuantity: 2,
    price: 80_000,
    averagePrice: 79_990,
    orderStatus: 'FILLED',
    lastFilledQuantity: 0.5,
    filledQuantity: 1.5,
    tradeAt: '2026-08-30T10:00:00.000Z',
    updatedAt: '2026-08-30T10:00:00.100Z',
    ...overrides,
  };
}

test(
  'contract versions explicitly distinguish observation from estimation',
  () => {
    assert.equal(
      LIQUIDATION_HEATMAP_CONTRACT_VERSION,
      'liquidation-heatmap-v0.1',
    );
    assert.equal(
      LIQUIDATION_HEATMAP_MODEL_VERSION,
      'nexus-liquidation-zones-v0.1',
    );
    assert.equal(
      LIQUIDATION_HEATMAP_HISTORY_VERSION,
      'liquidation-heatmap-history-v0.1',
    );
  },
);

test(
  'SELL force order is an observed long liquidation',
  () => {
    const event =
      toLiquidationHeatmapObservedEvent(
        liquidation(),
      );

    assert.deepEqual(
      event,
      {
        id:
          'binance-force-order:BTCUSDT:2026-08-30T10:00:00.000Z:sell:79990:1.5',
        kind: 'observed',
        source: 'binance_force_order',
        isEstimate: false,
        symbol: 'BTCUSDT',
        liquidatedPositionSide: 'long',
        executionSide: 'sell',
        price: 79_990,
        quantity: 1.5,
        notional: 119_985,
        eventAt: '2026-08-30T10:00:00.000Z',
        receivedAt: '2026-08-30T10:00:00.100Z',
      },
    );
  },
);

test(
  'BUY force order is an observed short liquidation',
  () => {
    assert.equal(
      resolveLiquidatedPositionSide(
        'buy',
      ),
      'short',
    );
  },
);

test(
  'observed event uses documented price and quantity fallbacks',
  () => {
    const event =
      toLiquidationHeatmapObservedEvent(
        liquidation({
          averagePrice: 0,
          price: 80_010,
          filledQuantity: 0,
          lastFilledQuantity: 0.25,
        }),
      );

    assert.equal(
      event.price,
      80_010,
    );
    assert.equal(
      event.quantity,
      0.25,
    );
    assert.equal(
      event.notional,
      20_002.5,
    );
  },
);

test(
  'observed event rejects missing executable price or quantity',
  () => {
    assert.throws(
      () =>
        toLiquidationHeatmapObservedEvent(
          liquidation({
            averagePrice: 0,
            price: 0,
          }),
        ),
      /price is unavailable/,
    );

    assert.throws(
      () =>
        toLiquidationHeatmapObservedEvent(
          liquidation({
            filledQuantity: 0,
            lastFilledQuantity: 0,
            originalQuantity: 0,
          }),
        ),
      /quantity is unavailable/,
    );
  },
);
