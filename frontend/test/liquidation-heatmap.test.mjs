import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLiquidationHeatmapUrl,
  fetchLiquidationHeatmap,
  parseLiquidationHeatmapSnapshot,
  resolveLiquidationHeatColor,
} from '../node_modules/.tmp/realtime-test/realtime/liquidationHeatmap.js';

function createSnapshot() {
  const snapshot = {
    contractVersion: 'liquidation-heatmap-v0.1',
    modelVersion: 'nexus-liquidation-zones-v0.1',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    status: 'ready',
    marketPrice: 80_000,
    generatedAt: '2026-08-30T10:00:00.000Z',
    inputs: {
      forceOrder: 'live',
      openInterest: 'live',
      marketDepth: 'live',
      candles: 'live',
      markPrice: 'live',
    },
    observedEvents: [
      {
        id: 'binance-force-order:1',
        kind: 'observed',
        source: 'binance_force_order',
        isEstimate: false,
        symbol: 'BTCUSDT',
        liquidatedPositionSide: 'long',
        executionSide: 'sell',
        price: 79_500,
        quantity: 2,
        notional: 159_000,
        eventAt: '2026-08-30T09:59:00.000Z',
        receivedAt: '2026-08-30T09:59:01.000Z',
      },
    ],
    estimatedZones: [
      {
        id: 'nexus-zone:short:25x',
        kind: 'estimated',
        source: 'nexus_model',
        isEstimate: true,
        modelVersion: 'nexus-liquidation-zones-v0.1',
        symbol: 'BTCUSDT',
        liquidatedPositionSide: 'short',
        priceLow: 82_800,
        priceHigh: 83_200,
        centerPrice: 83_000,
        estimatedNotional: 2_500_000,
        intensity: 0.8,
        confidence: 0.65,
        leverageBand: 25,
        startedAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
        reasons: [
          'open_interest_distribution',
          'market_depth_bias',
        ],
      },
    ],
    historyBuckets: [],
    disclosure: {
      observed: 'BINANCE_FORCE_ORDER_EXECUTED',
      estimated: 'NEXUS_MODEL_NOT_EXCHANGE_FACT',
    },
  };

  snapshot.historyBuckets.push({
    historyVersion: 'liquidation-heatmap-history-v0.1',
    symbol: snapshot.symbol,
    timeframe: snapshot.timeframe,
    bucketStart: '2026-08-30T10:00:00.000Z',
    bucketEnd: '2026-08-30T10:01:00.000Z',
    generatedAt: snapshot.generatedAt,
    status: snapshot.status,
    marketPrice: snapshot.marketPrice,
    inputs: { ...snapshot.inputs },
    observedEvents: [],
    estimatedZones: snapshot.estimatedZones,
  });

  return snapshot;
}

test(
  'builds the symbol-scoped heatmap endpoint URL',
  () => {
    assert.equal(
      buildLiquidationHeatmapUrl({
        baseUrl: 'http://localhost:4100/',
        symbol: ' btc/usdt ',
        scannerWindow: '15m',
        limit: 250,
      }),
      'http://localhost:4100/api/v1/market/realtime/market-wide/liquidation-heatmap?symbol=BTCUSDT&scannerWindow=15m&limit=250&historyLimit=360',
    );
  },
);

test(
  'parses observed Binance events and estimated NEXUS zones separately',
  () => {
    const snapshot = parseLiquidationHeatmapSnapshot(
      createSnapshot(),
    );

    assert.equal(
      snapshot.observedEvents[0]?.isEstimate,
      false,
    );
    assert.equal(
      snapshot.observedEvents[0]?.liquidatedPositionSide,
      'long',
    );
    assert.equal(
      snapshot.estimatedZones[0]?.isEstimate,
      true,
    );
    assert.equal(
      snapshot.estimatedZones[0]?.confidence,
      0.65,
    );
    assert.equal(
      snapshot.disclosure.estimated,
      'NEXUS_MODEL_NOT_EXCHANGE_FACT',
    );
    assert.equal(
      snapshot.historyBuckets[0]?.historyVersion,
      'liquidation-heatmap-history-v0.1',
    );
  },
);

test(
  'rejects mislabeled observed events and overconfident estimates',
  () => {
    const wrongSide = createSnapshot();
    wrongSide.observedEvents[0].liquidatedPositionSide = 'short';

    assert.throws(
      () => parseLiquidationHeatmapSnapshot(wrongSide),
      /Invalid observed liquidation values/u,
    );

    const overconfident = createSnapshot();
    overconfident.estimatedZones[0].confidence = 0.9;

    assert.throws(
      () => parseLiquidationHeatmapSnapshot(overconfident),
      /Invalid estimated liquidation values/u,
    );
  },
);

test(
  'fetches the heatmap and keeps the NEXUS disclosure',
  async () => {
    let requestedUrl = '';
    const snapshot = await fetchLiquidationHeatmap({
      symbol: 'BTCUSDT',
      fetcher: async (url) => {
        requestedUrl = url;
        return new Response(
          JSON.stringify(createSnapshot()),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    });

    assert.match(
      requestedUrl,
      /liquidation-heatmap\?symbol=BTCUSDT/u,
    );
    assert.equal(
      snapshot.modelVersion,
      'nexus-liquidation-zones-v0.1',
    );
  },
);

test(
  'uses bounded heat colors without fabricated randomness',
  () => {
    assert.equal(resolveLiquidationHeatColor(0), '#512e91');
    assert.equal(resolveLiquidationHeatColor(0.6), '#17d6a3');
    assert.equal(resolveLiquidationHeatColor(1), '#f7df3f');
  },
);
