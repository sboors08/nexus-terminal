import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import type {
  MarketVolumeSpike,
} from '../src/modules/realtime-market-data/market-volume-spikes.js';
import {
  marketWideRealtimeRoutes,
  type MarketWideRealtimeRouteService,
} from '../src/modules/realtime-market-data/market-wide-realtime.routes.js';

function createSpike(
  symbol: string,
  volumeRatio: number,
  currentQuoteVolume: number,
): MarketVolumeSpike {
  return {
    symbol,
    status: 'new',
    periodMinutes: 5,
    baselinePeriods: 12,
    currentQuoteVolume,
    previousQuoteVolume: 100_000,
    baselineQuoteVolume: 100_000,
    volumeRatio,
    previousVolumeRatio: 1,
    currentTradesCount: 200,
    previousTradesCount: 100,
    baselineTradesCount: 100,
    tradesRatio: 2,
    priceChangePct: 1.5,
    periodStartedAt:
      '2026-07-23T12:00:00.000Z',
    updatedAt:
      '2026-07-23T12:04:59.999Z',
  };
}

class TestVolumeSpikesService
implements MarketWideRealtimeRouteService {
  private readonly spikes = [
    createSpike(
      'SOLUSDT',
      3.2,
      320_000,
    ),
    createSpike(
      'ETHUSDT',
      2.8,
      800_000,
    ),
    createSpike(
      'XRPUSDT',
      2.3,
      230_000,
    ),
  ];

  getStatus() {
    return {
      state:
        'connected' as const,
      symbolsCount: 3,
      streamCount: 6,
      socketCount: 1,
      connectedSockets: 1,
      lastMessageAt:
        '2026-07-23T12:05:00.000Z',
      reconnectAttempts: 0,
      lastError: null,
    };
  }

  getMetrics(): MarketScannerMetrics[] {
    return [];
  }

  getVolumeSpikes(
    symbol?: string,
  ): MarketVolumeSpike[] {
    return symbol
      ? this.spikes.filter(
          (spike) =>
            spike.symbol === symbol,
        )
      : this.spikes;
  }
}

async function createApp() {
  const app = Fastify({
    logger: false,
  });

  await app.register(
    marketWideRealtimeRoutes,
    {
      prefix: '/api/v1',
      marketWideRealtimeService:
        new TestVolumeSpikesService(),
    },
  );

  return app;
}

test(
  'volume spikes route returns ranked signals',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      3,
    );

    assert.equal(
      payload[0].symbol,
      'SOLUSDT',
    );

    assert.equal(
      payload[0].volumeRatio,
      3.2,
    );

    await app.close();
  },
);

test(
  'volume spikes route applies limit',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?limit=2',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json().length,
      2,
    );

    await app.close();
  },
);

test(
  'volume spikes route filters one symbol',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?symbol=ethusdt',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const payload =
      response.json();

    assert.equal(
      payload.length,
      1,
    );

    assert.equal(
      payload[0].symbol,
      'ETHUSDT',
    );

    await app.close();
  },
);

test(
  'volume spikes route validates limit',
  async () => {
    const app =
      await createApp();

    for (
      const limit
      of ['0', '101', '1.5', 'wrong']
    ) {
      const response =
        await app.inject({
          method: 'GET',
          url:
            `/api/v1/market/realtime/market-wide/volume-spikes?limit=${limit}`,
        });

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        response.json().error,
        'invalid_volume_spike_limit',
      );
    }

    await app.close();
  },
);

test(
  'volume spikes route validates symbol format',
  async () => {
    const app =
      await createApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?symbol=bad!',
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json().error,
      'invalid_symbol',
    );

    await app.close();
  },
);
