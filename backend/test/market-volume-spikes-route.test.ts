import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import {
  DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
  type MarketVolumeSpike,
  type MarketVolumeSpikeOptions,
  type MarketVolumeSpikeStatus,
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


function createFilterSpike(
  symbol: string,
  status:
    MarketVolumeSpikeStatus,
  volumeRatio: number,
  previousVolumeRatio: number,
  currentQuoteVolume: number,
  tradesRatio: number,
): MarketVolumeSpike {
  return {
    ...createSpike(
      symbol,
      volumeRatio,
      currentQuoteVolume,
    ),
    status,
    previousVolumeRatio,
    tradesRatio,
  };
}

class FilterAwareVolumeSpikesService
implements MarketWideRealtimeRouteService {
  readonly calls: Array<{
    symbol: string | undefined;
    options:
      MarketVolumeSpikeOptions;
  }> = [];

  constructor(
    private readonly spikes:
      MarketVolumeSpike[] = [
        createFilterSpike(
          'SOLUSDT',
          'stable',
          4.2,
          4,
          900_000,
          3,
        ),
        createFilterSpike(
          'ETHUSDT',
          'new',
          3.4,
          1,
          800_000,
          2.4,
        ),
        createFilterSpike(
          'XRPUSDT',
          'growing',
          2.8,
          2.2,
          200_000,
          1.8,
        ),
        createFilterSpike(
          'ADAUSDT',
          'fading',
          1.6,
          2.4,
          120_000,
          1.7,
        ),
        createFilterSpike(
          'DOGEUSDT',
          'new',
          1.4,
          1,
          40_000,
          1.1,
        ),
      ],
  ) {}

  getStatus() {
    return {
      state:
        'connected' as const,
      symbolsCount:
        this.spikes.length,
      streamCount:
        this.spikes.length * 2,
      socketCount: 1,
      connectedSockets: 1,
      lastMessageAt:
        '2026-07-23T12:05:00.000Z',
      reconnectAttempts: 0,
      lastError: null,
    };
  }

  getMetrics():
  MarketScannerMetrics[] {
    return [];
  }

  getVolumeSpikes(
    symbol?: string,
    options:
      MarketVolumeSpikeOptions =
        DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
  ): MarketVolumeSpike[] {
    const requestOptions = {
      ...options,
    };

    this.calls.push({
      symbol,
      options:
        requestOptions,
    });

    return this.spikes
      .filter(
        (spike) =>
          symbol === undefined
          || spike.symbol === symbol,
      )
      .filter(
        (spike) => {
          const hasMinimumActivity =
            spike.currentQuoteVolume
              >= requestOptions
                .minCurrentQuoteVolume
            && spike.tradesRatio
              >= requestOptions
                .minTradesRatio;

          const isCurrentSpike =
            hasMinimumActivity
            && spike.volumeRatio
              >= requestOptions
                .minVolumeRatio;

          const isFadingSpike =
            hasMinimumActivity
            && spike.previousVolumeRatio
              >= requestOptions
                .minVolumeRatio
            && spike.volumeRatio
              >= requestOptions
                .fadingVolumeRatio;

          return isCurrentSpike
            || isFadingSpike;
        },
      )
      .map(
        (spike) => ({
          ...spike,
          periodMinutes:
            requestOptions
              .periodMinutes,
          baselinePeriods:
            requestOptions
              .baselinePeriods,
        }),
      );
  }
}

async function createFilterApp(
  service =
    new FilterAwareVolumeSpikesService(),
) {
  const app = Fastify({
    logger: false,
  });

  await app.register(
    marketWideRealtimeRoutes,
    {
      prefix: '/api/v1',
      marketWideRealtimeService:
        service,
    },
  );

  return {
    app,
    service,
  };
}

test(
  'volume spikes route keeps default filter options',
  async () => {
    const {
      app,
      service,
    } = await createFilterApp();

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

    assert.deepEqual(
      service.calls[0]?.options,
      DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS,
    );

    await app.close();
  },
);

test(
  'volume spikes route forwards period and baseline filters',
  async () => {
    const {
      app,
      service,
    } = await createFilterApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?periodMinutes=3&baselinePeriods=24',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      service.calls[0]
        ?.options.periodMinutes,
      3,
    );

    assert.equal(
      service.calls[0]
        ?.options.baselinePeriods,
      24,
    );

    for (
      const spike
      of response.json()
    ) {
      assert.equal(
        spike.periodMinutes,
        3,
      );

      assert.equal(
        spike.baselinePeriods,
        24,
      );
    }

    await app.close();
  },
);

test(
  'volume spikes route applies numeric activity filters',
  async () => {
    const cases = [
      {
        query:
          'minVolumeRatio=3.5',
        symbols: [
          'SOLUSDT',
        ],
      },
      {
        query:
          'minTradesRatio=2.5',
        symbols: [
          'SOLUSDT',
        ],
      },
      {
        query:
          'minCurrentQuoteVolume=850000',
        symbols: [
          'SOLUSDT',
        ],
      },
    ];

    for (const item of cases) {
      const {
        app,
      } = await createFilterApp();

      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/v1/market/realtime/market-wide/volume-spikes?'
            + item.query,
        });

      assert.equal(
        response.statusCode,
        200,
      );

      assert.deepEqual(
        response
          .json()
          .map(
            (
              spike:
              MarketVolumeSpike,
            ) =>
              spike.symbol,
          ),
        item.symbols,
      );

      await app.close();
    }
  },
);

test(
  'volume spikes route filters one status',
  async () => {
    const {
      app,
    } = await createFilterApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?statuses=growing',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response
        .json()
        .map(
          (
            spike:
            MarketVolumeSpike,
          ) =>
            spike.symbol,
        ),
      [
        'XRPUSDT',
      ],
    );

    await app.close();
  },
);

test(
  'volume spikes route filters multiple statuses before limit',
  async () => {
    const {
      app,
    } = await createFilterApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?statuses=new,growing&limit=1',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response
        .json()
        .map(
          (
            spike:
            MarketVolumeSpike,
          ) =>
            spike.symbol,
        ),
      [
        'ETHUSDT',
      ],
    );

    await app.close();
  },
);

test(
  'volume spikes symbol works with custom filters',
  async () => {
    const {
      app,
      service,
    } = await createFilterApp();

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?symbol=ethusdt&periodMinutes=15&baselinePeriods=24&minVolumeRatio=3',
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

    assert.equal(
      payload[0].periodMinutes,
      15,
    );

    assert.equal(
      payload[0].baselinePeriods,
      24,
    );

    assert.equal(
      service.calls[0]?.symbol,
      'ETHUSDT',
    );

    await app.close();
  },
);

test(
  'volume spikes route validates numeric filters',
  async () => {
    const cases = [
      {
        query:
          'periodMinutes=2',
        error:
          'invalid_volume_spike_period_minutes',
      },
      {
        query:
          'periodMinutes=wrong',
        error:
          'invalid_volume_spike_period_minutes',
      },
      {
        query:
          'baselinePeriods=2',
        error:
          'invalid_volume_spike_baseline_periods',
      },
      {
        query:
          'baselinePeriods=49',
        error:
          'invalid_volume_spike_baseline_periods',
      },
      {
        query:
          'baselinePeriods=3.5',
        error:
          'invalid_volume_spike_baseline_periods',
      },
      {
        query:
          'minVolumeRatio=0.9',
        error:
          'invalid_volume_spike_min_volume_ratio',
      },
      {
        query:
          'minVolumeRatio=101',
        error:
          'invalid_volume_spike_min_volume_ratio',
      },
      {
        query:
          'minTradesRatio=0',
        error:
          'invalid_volume_spike_min_trades_ratio',
      },
      {
        query:
          'minTradesRatio=101',
        error:
          'invalid_volume_spike_min_trades_ratio',
      },
      {
        query:
          'minCurrentQuoteVolume=-1',
        error:
          'invalid_volume_spike_min_current_quote_volume',
      },
      {
        query:
          'minCurrentQuoteVolume=1000000000001',
        error:
          'invalid_volume_spike_min_current_quote_volume',
      },
    ];

    const {
      app,
    } = await createFilterApp();

    for (const item of cases) {
      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/v1/market/realtime/market-wide/volume-spikes?'
            + item.query,
        });

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        response.json().error,
        item.error,
      );
    }

    await app.close();
  },
);

test(
  'volume spikes route rejects invalid statuses',
  async () => {
    const {
      app,
    } = await createFilterApp();

    for (
      const query
      of [
        'statuses=unknown',
        'statuses=',
        'statuses=new,unknown',
        'statuses=new,',
      ]
    ) {
      const response =
        await app.inject({
          method: 'GET',
          url:
            '/api/v1/market/realtime/market-wide/volume-spikes?'
            + query,
        });

      assert.equal(
        response.statusCode,
        400,
      );

      assert.equal(
        response.json().error,
        'invalid_volume_spike_statuses',
      );
    }

    await app.close();
  },
);

test(
  'volume spikes route returns empty array when history is insufficient',
  async () => {
    const service =
      new FilterAwareVolumeSpikesService(
        [],
      );

    const {
      app,
    } = await createFilterApp(
      service,
    );

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?periodMinutes=15&baselinePeriods=48',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.deepEqual(
      response.json(),
      [],
    );

    await app.close();
  },
);

test(
  'volume spikes requests do not mutate each other or defaults',
  async () => {
    const {
      app,
      service,
    } = await createFilterApp();

    const strictResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?minVolumeRatio=99&periodMinutes=1',
      });

    const defaultResponse =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes',
      });

    assert.equal(
      strictResponse.statusCode,
      200,
    );

    assert.equal(
      defaultResponse.statusCode,
      200,
    );

    assert.equal(
      service.calls[0]
        ?.options.minVolumeRatio,
      99,
    );

    assert.equal(
      service.calls[0]
        ?.options.periodMinutes,
      1,
    );

    assert.equal(
      service.calls[1]
        ?.options.minVolumeRatio,
      2,
    );

    assert.equal(
      service.calls[1]
        ?.options.periodMinutes,
      5,
    );

    assert.equal(
      DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
        .minVolumeRatio,
      2,
    );

    assert.equal(
      DEFAULT_MARKET_VOLUME_SPIKE_OPTIONS
        .periodMinutes,
      5,
    );

    assert.equal(
      defaultResponse.json().length,
      4,
    );

    await app.close();
  },
);

test(
  'parallel volume spike requests keep independent filters',
  async () => {
    const {
      app,
      service,
    } = await createFilterApp();

    const [
      strictResponse,
      broadResponse,
    ] = await Promise.all([
      app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?minVolumeRatio=3.5',
      }),
      app.inject({
        method: 'GET',
        url:
          '/api/v1/market/realtime/market-wide/volume-spikes?minVolumeRatio=2',
      }),
    ]);

    assert.deepEqual(
      strictResponse
        .json()
        .map(
          (
            spike:
            MarketVolumeSpike,
          ) =>
            spike.symbol,
        ),
      [
        'SOLUSDT',
      ],
    );

    assert.equal(
      broadResponse.json().length,
      4,
    );

    assert.deepEqual(
      service.calls
        .map(
          (call) =>
            call.options
              .minVolumeRatio,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left - right,
        ),
      [
        2,
        3.5,
      ],
    );

    await app.close();
  },
);
