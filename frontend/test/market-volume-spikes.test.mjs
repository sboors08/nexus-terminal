import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMarketVolumeSpikesUrl,
  fetchMarketVolumeSpikes,
  parseMarketVolumeSpike,
} from '../node_modules/.tmp/realtime-test/realtime/marketVolumeSpikes.js';

function createSpike(
  status = 'growing',
) {
  return {
    symbol: 'SOLUSDT',
    status,
    periodMinutes: 5,
    baselinePeriods: 12,
    currentQuoteVolume: 4_250_000,
    previousQuoteVolume: 3_100_000,
    baselineQuoteVolume: 1_500_000,
    volumeRatio: 2.8333,
    previousVolumeRatio: 2.0667,
    currentTradesCount: 8_420,
    previousTradesCount: 6_100,
    baselineTradesCount: 3_300,
    tradesRatio: 2.5515,
    priceChangePct: 1.42,
    periodStartedAt:
      '2026-07-23T18:00:00.000Z',
    updatedAt:
      '2026-07-23T18:04:59.999Z',
  };
}

test(
  'builds the default market volume spikes URL',
  () => {
    assert.equal(
      buildMarketVolumeSpikesUrl({
        baseUrl:
          'http://localhost:4100/',
      }),
      'http://localhost:4100/api/v1/market/realtime/market-wide/volume-spikes?limit=20',
    );
  },
);

test(
  'builds a normalized symbol and limit URL',
  () => {
    assert.equal(
      buildMarketVolumeSpikesUrl({
        symbol:
          ' sol/usdt ',
        limit: 5,
      }),
      '/api/v1/market/realtime/market-wide/volume-spikes?symbol=SOLUSDT&limit=5',
    );
  },
);

test(
  'builds a URL with volume spike filters',
  () => {
    assert.equal(
      buildMarketVolumeSpikesUrl({
        symbol: 'eth/usdt',
        limit: 12,
        periodMinutes: 15,
        baselinePeriods: 24,
        minVolumeRatio: 3.5,
        minTradesRatio: 2.25,
        minCurrentQuoteVolume: 250_000,
        statuses: [
          'new',
          'growing',
          'new',
        ],
      }),
      '/api/v1/market/realtime/market-wide/volume-spikes'
        + '?symbol=ETHUSDT'
        + '&limit=12'
        + '&periodMinutes=15'
        + '&baselinePeriods=24'
        + '&minVolumeRatio=3.5'
        + '&minTradesRatio=2.25'
        + '&minCurrentQuoteVolume=250000'
        + '&statuses=new%2Cgrowing',
    );
  },
);

test(
  'fetches and validates volume spikes',
  async () => {
    let requestedUrl = '';

    const spikes =
      await fetchMarketVolumeSpikes({
        limit: 4,
        fetcher:
          async (url) => {
            requestedUrl = url;

            return new Response(
              JSON.stringify([
                createSpike('new'),
                {
                  ...createSpike(
                    'fading',
                  ),
                  symbol:
                    'ETHUSDT',
                  priceChangePct:
                    null,
                },
              ]),
              {
                status: 200,
                headers: {
                  'content-type':
                    'application/json',
                },
              },
            );
          },
      });

    assert.match(
      requestedUrl,
      /volume-spikes\?limit=4$/,
    );

    assert.equal(
      spikes.length,
      2,
    );

    assert.equal(
      spikes[0]?.status,
      'new',
    );

    assert.equal(
      spikes[1]?.symbol,
      'ETHUSDT',
    );

    assert.equal(
      spikes[1]?.priceChangePct,
      null,
    );
  },
);

test(
  'supports all four volume spike statuses',
  () => {
    for (
      const status of [
        'new',
        'growing',
        'stable',
        'fading',
      ]
    ) {
      assert.equal(
        parseMarketVolumeSpike(
          createSpike(status),
        ).status,
        status,
      );
    }
  },
);

test(
  'rejects invalid limits and responses',
  async () => {
    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          limit: 101,
        }),
      /integer from 1 to 100/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          periodMinutes: 2,
        }),
      /periodMinutes/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          baselinePeriods: 2,
        }),
      /baselinePeriods/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          minVolumeRatio: 0.5,
        }),
      /minVolumeRatio/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          minTradesRatio: 0,
        }),
      /minTradesRatio/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          minCurrentQuoteVolume: -1,
        }),
      /minCurrentQuoteVolume/,
    );

    assert.throws(
      () =>
        buildMarketVolumeSpikesUrl({
          statuses: [],
        }),
      /statuses/,
    );

    await assert.rejects(
      () =>
        fetchMarketVolumeSpikes({
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  symbol:
                    'SOLUSDT',
                }),
                {
                  status: 200,
                },
              ),
        }),
      /Invalid market volume spikes response/,
    );

    await assert.rejects(
      () =>
        fetchMarketVolumeSpikes({
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  error:
                    'unavailable',
                }),
                {
                  status: 503,
                },
              ),
        }),
      /request failed: 503/,
    );

    assert.throws(
      () =>
        parseMarketVolumeSpike({
          ...createSpike(),
          status:
            'unknown',
        }),
      /status/,
    );
  },
);
