import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  BtcMarketModeAlertEventSource,
  type BtcMarketModeChange,
} from '../src/modules/alerts/btc-market-mode-alert-event-source.js';
import {
  BtcMarketModeProducer,
  type BtcMarketModeMetricsSource,
} from '../src/modules/alerts/btc-market-mode-producer.js';
import type {
  MarketScannerMetrics,
} from '../src/modules/realtime-market-data/market-scanner-metrics.js';
import type {
  MarketVolumeSpike,
} from '../src/modules/realtime-market-data/market-volume-spikes.js';
import type {
  MarketScannerWindowId,
} from '../src/modules/realtime-market-data/scanner-windows.js';
import type {
  MarketWideKlineChange,
  MarketWideKlineChangeListener,
  MarketWideRealtimeService,
  MarketWideRealtimeState,
  MarketWideRealtimeStatus,
} from '../src/modules/realtime-market-data/market-wide-realtime.service.js';

const testEnv: AppEnv = {
  nodeEnv: 'test',
  host: '127.0.0.1',
  port: 4100,
  apiPrefix: '/api/v1',
  corsOrigins: [
    'http://localhost:5173',
  ],
  logLevel: 'silent',
};

function metric(
  symbol: string,
  priceChangePct: number | null,
  updatedAt: string | null,
): MarketScannerMetrics {
  return {
    symbol,
    scannerWindow: '5m',
    windowMs: 300_000,
    price: 100,
    priceChangePct,
    btcCorrelation: null,
    relativeStrengthPct: null,
    volumeAnomaly: null,
    tradesAnomaly: null,
    volatilityPct: 0.2,
    spreadPct: null,
    topBookQuoteValue: null,
    orderBookImbalancePct: null,
    liquidityScore: null,
    activityScore: null,
    quoteVolume: 1_000,
    tradesCount: 100,
    tradesPerMinute: 20,
    buyTradesCount: 55,
    sellTradesCount: 45,
    buyQuoteVolume: 550,
    sellQuoteVolume: 450,
    windowStartedAt:
      '2026-08-12T11:55:00.000Z',
    updatedAt,
  };
}

function marketSnapshot(
  options: {
    btcChangePct: number;
    advancing: number;
    declining: number;
    total?: number;
    updatedAt?: string;
  },
): MarketScannerMetrics[] {
  const total =
    options.total ?? 20;

  const updatedAt =
    options.updatedAt
    ?? '2026-08-12T12:00:00.000Z';

  const metrics = [
    metric(
      'BTCUSDT',
      options.btcChangePct,
      updatedAt,
    ),
  ];

  for (
    let index = 0;
    index < total;
    index += 1
  ) {
    const change =
      index < options.advancing
        ? 0.4
        : index
          < options.advancing
            + options.declining
          ? -0.4
          : 0;

    metrics.push(
      metric(
        `ALT${String(index).padStart(2, '0')}USDT`,
        change,
        updatedAt,
      ),
    );
  }

  return metrics;
}

class TestBtcMarketMetricsSource
implements BtcMarketModeMetricsSource {
  private readonly listeners =
    new Set<MarketWideKlineChangeListener>();

  private metrics:
    MarketScannerMetrics[] = [];

  private state:
    MarketWideRealtimeState = 'connected';

  get listenersCount(): number {
    return this.listeners.size;
  }

  subscribeKlineChanges(
    listener: MarketWideKlineChangeListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getMetrics(
    _symbol?: string,
    scannerWindow:
      MarketScannerWindowId = '1m',
  ): MarketScannerMetrics[] {
    assert.equal(
      scannerWindow,
      '5m',
    );

    return this.metrics.map(
      (entry) => ({
        ...entry,
      }),
    );
  }

  getVolumeSpikes():
  MarketVolumeSpike[] {
    return [];
  }

  getStatus():
  MarketWideRealtimeStatus {
    return {
      state: this.state,
      symbolsCount:
        this.metrics.length,
      streamCount:
        this.metrics.length * 2,
      socketCount: 1,
      connectedSockets:
        this.state === 'connected'
        || this.state === 'degraded'
          ? 1
          : 0,
      lastMessageAt:
        '2026-08-12T12:00:00.000Z',
      reconnectAttempts: 0,
      lastError: null,
    };
  }

  setSnapshot(
    metrics:
      readonly MarketScannerMetrics[],
  ): void {
    this.metrics =
      metrics.map(
        (entry) => ({
          ...entry,
        }),
      );
  }

  setState(
    state: MarketWideRealtimeState,
  ): void {
    this.state = state;
  }

  emit(
    event: MarketWideKlineChange,
  ): void {
    for (const listener of this.listeners) {
      listener({
        source: event.source,
        symbols: [
          ...event.symbols,
        ],
      });
    }
  }
}

test(
  'derives canonical BTC mode changes from fresh 5m metrics without warm-up alerts',
  () => {
    const source =
      new TestBtcMarketMetricsSource();
    let currentNow =
      new Date(
        '2026-08-12T12:00:30.000Z',
      );

    const producer =
      new BtcMarketModeProducer(
        source,
        {
          now: () =>
            currentNow,
        },
      );

    const changes:
      BtcMarketModeChange[] = [];

    producer.subscribeBtcMarketModeChanges(
      (change) => {
        changes.push(change);
      },
    );

    source.emit({
      source: 'live',
      symbols: ['ALT00USDT'],
    });

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.25,
        advancing: 12,
        declining: 8,
      }),
    );

    source.emit({
      source: 'history',
      symbols: ['BTCUSDT'],
    });

    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.05,
        advancing: 10,
        declining: 10,
        updatedAt:
          '2026-08-12T12:00:10.000Z',
      }),
    );

    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    source.setState('degraded');
    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
        updatedAt:
          '2026-08-12T12:00:20.000Z',
      }),
    );

    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.deepEqual(
      changes.map((change) => ({
        mode: change.mode,
        previousMode:
          change.previousMode,
        occurredAt:
          change.occurredAt,
        timeframe:
          change.timeframe,
        quality:
          change.payload.dataQuality,
      })),
      [
        {
          mode: 'neutral',
          previousMode: 'risk_on',
          occurredAt:
            '2026-08-12T12:00:10.000Z',
          timeframe: '5m',
          quality: 'ready',
        },
        {
          mode: 'risk_off',
          previousMode: 'neutral',
          occurredAt:
            '2026-08-12T12:00:20.000Z',
          timeframe: '5m',
          quality: 'degraded',
        },
      ],
    );

    assert.deepEqual(
      producer.getStatus(),
      {
        state: 'subscribed',
        availability: 'degraded',
        scannerWindow: '5m',
        sourceState: 'degraded',
        currentMode: 'risk_off',
        ignoredKlineChangesCount: 1,
        evaluationsCount: 4,
        historicalEvaluationsCount: 1,
        baselineSnapshotsCount: 1,
        silentHistoricalChangesCount: 0,
        duplicateSnapshotsCount: 1,
        emittedChangesCount: 2,
        unavailableSnapshotsCount: 0,
        insufficientSnapshotsCount: 0,
        staleSnapshotsCount: 0,
        sourceErrorsCount: 0,
        listenerErrorsCount: 0,
        totalMarketSymbolsCount: 20,
        usableMarketSymbolsCount: 20,
        btcPriceChangePct: -0.2,
        advancingSymbolsPct: 40,
        decliningSymbolsPct: 60,
        lastEvidenceAt:
          '2026-08-12T12:00:20.000Z',
        lastEventAt:
          '2026-08-12T12:00:20.000Z',
        lastError: null,
      },
    );

    assert.deepEqual(
      producer.getCurrentSnapshot(),
      {
        availability: 'degraded',
        scannerWindow: '5m',
        mode: 'risk_off',
        observedAt:
          '2026-08-12T12:00:20.000Z',
      },
    );

    currentNow =
      new Date(
        '2026-08-12T12:02:00.000Z',
      );
    assert.deepEqual(
      producer.getCurrentSnapshot(),
      {
        availability: 'stale',
        scannerWindow: '5m',
        mode: 'risk_off',
        observedAt:
          '2026-08-12T12:00:20.000Z',
      },
    );
  },
);

test(
  'suppresses unavailable, stale and incomplete snapshots while preserving the last causal mode',
  () => {
    const source =
      new TestBtcMarketMetricsSource();

    const producer =
      new BtcMarketModeProducer(
        source,
        {
          now: () =>
            new Date(
              '2026-08-12T12:01:00.000Z',
            ),
        },
      );

    const changes:
      BtcMarketModeChange[] = [];

    producer.subscribeBtcMarketModeChanges(
      (change) => {
        changes.push(change);
      },
    );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.2,
        advancing: 12,
        declining: 8,
        updatedAt:
          '2026-08-12T12:00:30.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    source.setState('reconnecting');
    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
        updatedAt:
          '2026-08-12T12:00:40.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(
      producer.getStatus().availability,
      'unavailable',
    );

    source.setState('connected');
    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
        updatedAt:
          '2026-08-12T11:55:00.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(
      producer.getStatus().availability,
      'stale',
    );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 3,
        declining: 2,
        total: 5,
        updatedAt:
          '2026-08-12T12:00:50.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(
      producer.getStatus().availability,
      'collecting',
    );

    source.setState('degraded');
    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
        updatedAt:
          '2026-08-12T12:00:55.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.mode, 'risk_off');
    assert.equal(
      changes[0]?.previousMode,
      'risk_on',
    );
    assert.equal(
      producer.getStatus()
        .unavailableSnapshotsCount,
      1,
    );
    assert.equal(
      producer.getStatus()
        .staleSnapshotsCount,
      1,
    );
    assert.equal(
      producer.getStatus()
        .insufficientSnapshotsCount,
      1,
    );
  },
);

test(
  'restarts with a silent baseline and isolates listener failures',
  () => {
    const source =
      new TestBtcMarketMetricsSource();

    const producer =
      new BtcMarketModeProducer(
        source,
        {
          now: () =>
            new Date(
              '2026-08-12T12:00:30.000Z',
            ),
        },
      );

    const firstChanges:
      BtcMarketModeChange[] = [];

    const unsubscribe =
      producer.subscribeBtcMarketModeChanges(
        (change) => {
          firstChanges.push(change);
        },
      );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.2,
        advancing: 12,
        declining: 8,
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    unsubscribe();
    unsubscribe();

    assert.equal(source.listenersCount, 0);
    assert.equal(producer.getStatus().state, 'idle');
    assert.equal(
      producer.getStatus().currentMode,
      null,
    );

    const delivered:
      BtcMarketModeChange[] = [];

    producer.subscribeBtcMarketModeChanges(
      () => {
        throw new Error(
          'listener unavailable',
        );
      },
    );
    producer.subscribeBtcMarketModeChanges(
      (change) => {
        delivered.push(change);
      },
    );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(delivered.length, 0);

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.2,
        advancing: 12,
        declining: 8,
        updatedAt:
          '2026-08-12T12:00:10.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.equal(delivered.length, 1);
    assert.equal(
      producer.getStatus()
        .listenerErrorsCount,
      1,
    );
    assert.equal(
      producer.getStatus().lastError,
      'listener unavailable',
    );
    assert.equal(firstChanges.length, 0);
  },
);

test(
  'wires the producer through buildApp and emits only a real live state change',
  async () => {
    const baselineUpdatedAt =
      new Date(
        Date.now() - 1_000,
      ).toISOString();

    const changedUpdatedAt =
      new Date(
        Date.now() - 500,
      ).toISOString();

    const source =
      new TestBtcMarketMetricsSource();

    const app =
      await buildApp({
        env: testEnv,
        realtimeMarketDataService:
          null,
        orderBookDepthService:
          null,
        binanceSymbolUniverseService:
          null,
        marketWideRealtimeService:
          source as unknown as
            MarketWideRealtimeService,
        marketWideHistoryWarmupService:
          null,
        setupDetectionRuntimeService:
          null,
        setupDetectionRuntimeReader:
          null,
        setupDetectionRuntimeEventSource:
          null,
        levelV2ShadowRuntimeService:
          null,
        levelV2ShadowRuntimeReader:
          null,
      });

    await app.ready();

    assert.equal(
      source.listenersCount,
      3,
    );

    const created =
      await app.inject({
        method: 'POST',
        url: '/api/v1/alerts/rules',
        payload: {
          name: 'BTC mode change',
          eventType:
            'btc_market_mode_changed',
          symbol: 'BTCUSDT',
          timeframe: '5m',
          cooldownMs: 0,
        },
      });

    assert.equal(
      created.statusCode,
      201,
    );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.2,
        advancing: 12,
        declining: 8,
        updatedAt:
          baselineUpdatedAt,
      }),
    );
    source.emit({
      source: 'history',
      symbols: ['BTCUSDT'],
    });

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.05,
        advancing: 10,
        declining: 10,
        updatedAt:
          changedUpdatedAt,
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    const triggers =
      await app.inject({
        method: 'GET',
        url: '/api/v1/alerts/triggers',
      });

    assert.equal(
      triggers.statusCode,
      200,
    );
    assert.equal(
      triggers.json().length,
      1,
    );
    assert.equal(
      triggers.json()[0].payload.mode,
      'neutral',
    );
    assert.equal(
      triggers.json()[0]
        .payload.previousMode,
      'risk_on',
    );
    assert.equal(
      triggers.json()[0].timeframe,
      '5m',
    );

    await app.close();

    assert.equal(
      source.listenersCount,
      0,
    );
  },
);

test(
  'validates producer boundaries',
  () => {
    const source =
      new TestBtcMarketMetricsSource();

    assert.throws(
      () =>
        new BtcMarketModeProducer(
          source,
          {
            minimumMarketSymbols: 0,
          },
        ),
      /minimumMarketSymbols/,
    );

    assert.throws(
      () =>
        new BtcMarketModeProducer(
          source,
          {
            directionalBreadthThresholdPct:
              50,
          },
        ),
      /directionalBreadthThresholdPct/,
    );
  },
);

test(
  'maps producer output through the existing alert adapter',
  () => {
    const source =
      new TestBtcMarketMetricsSource();

    const producer =
      new BtcMarketModeProducer(
        source,
        {
          now: () =>
            new Date(
              '2026-08-12T12:00:30.000Z',
            ),
        },
      );

    const adapter =
      new BtcMarketModeAlertEventSource(
        producer,
      );

    const events:
      Array<{
        source: string;
        timeframe: string | null;
        entityId: string | null;
      }> = [];

    adapter.subscribeAlertEvents(
      (event) => {
        events.push({
          source: event.source,
          timeframe: event.timeframe,
          entityId: event.entityId,
        });
      },
    );

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: 0.2,
        advancing: 12,
        declining: 8,
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    source.setSnapshot(
      marketSnapshot({
        btcChangePct: -0.2,
        advancing: 8,
        declining: 12,
        updatedAt:
          '2026-08-12T12:00:10.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['BTCUSDT'],
    });

    assert.deepEqual(
      events,
      [
        {
          source: 'btc_market_mode',
          timeframe: '5m',
          entityId:
            'btc-market-mode:5m',
        },
      ],
    );
  },
);
