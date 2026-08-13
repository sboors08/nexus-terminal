import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  MarketImpulseAlertEventSource,
  mapMarketImpulseSignalToAlert,
  type MarketImpulseSignal,
  type MarketImpulseSignalListener,
  type MarketImpulseSourceContract,
} from '../src/modules/alerts/market-impulse-alert-event-source.js';
import {
  MarketImpulseProducer,
  type MarketImpulseMetricsSource,
} from '../src/modules/alerts/market-impulse-producer.js';
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

const fixedNow = () =>
  new Date('2026-08-12T12:00:30.000Z');

function impulseMetric(
  overrides:
    Partial<MarketScannerMetrics> = {},
): MarketScannerMetrics {
  return {
    symbol: 'SOLUSDT',
    scannerWindow: '5m',
    windowMs: 300_000,
    price: 150,
    priceChangePct: 0.2,
    btcCorrelation: null,
    relativeStrengthPct: null,
    volumeAnomaly: 1.1,
    tradesAnomaly: 1.1,
    volatilityPct: 0.3,
    spreadPct: null,
    topBookQuoteValue: null,
    orderBookImbalancePct: null,
    liquidityScore: null,
    activityScore: null,
    quoteVolume: 100_000,
    tradesCount: 1_000,
    tradesPerMinute: 200,
    buyTradesCount: 0,
    sellTradesCount: 0,
    buyQuoteVolume: 55_000,
    sellQuoteVolume: 45_000,
    windowStartedAt:
      '2026-08-12T11:55:00.000Z',
    updatedAt:
      '2026-08-12T12:00:00.000Z',
    ...overrides,
  };
}

class TestMarketImpulseMetricsSource
implements MarketImpulseMetricsSource {
  private readonly listeners =
    new Set<MarketWideKlineChangeListener>();

  private readonly metrics =
    new Map<string, MarketScannerMetrics>();

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
    symbol?: string,
    scannerWindow:
      MarketScannerWindowId = '1m',
  ): MarketScannerMetrics[] {
    assert.equal(
      scannerWindow,
      '5m',
    );

    const normalizedSymbol =
      symbol?.trim().toUpperCase();

    return [...this.metrics.values()]
      .filter(
        (metric) =>
          !normalizedSymbol
          || metric.symbol === normalizedSymbol,
      )
      .map((metric) => ({
        ...metric,
      }));
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
        this.metrics.size,
      streamCount:
        this.metrics.size * 2,
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

  setMetric(
    metric: MarketScannerMetrics,
  ): void {
    this.metrics.set(
      metric.symbol.trim().toUpperCase(),
      {
        ...metric,
        symbol:
          metric.symbol.trim().toUpperCase(),
      },
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
        symbols: [...event.symbols],
      });
    }
  }
}

class ManualImpulseSource
implements MarketImpulseSourceContract {
  private readonly listeners =
    new Set<MarketImpulseSignalListener>();

  subscribeImpulseSignals(
    listener: MarketImpulseSignalListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(signal: MarketImpulseSignal): void {
    for (const listener of this.listeners) {
      listener({
        ...signal,
        payload: {
          ...signal.payload,
        },
      });
    }
  }
}

function exactLongMetric(
  updatedAt =
    '2026-08-12T12:00:01.000Z',
): MarketScannerMetrics {
  return impulseMetric({
    priceChangePct: 0.5,
    volumeAnomaly: 1.5,
    tradesAnomaly: 1.5,
    volatilityPct: 0.6,
    quoteVolume: 50_000,
    tradesCount: 1,
    updatedAt,
  });
}

test(
  'emits the canonical impulse contract at exact thresholds',
  () => {
    const source =
      new TestMarketImpulseMetricsSource();

    const producer =
      new MarketImpulseProducer(
        source,
        { now: fixedNow },
      );

    const signals:
      MarketImpulseSignal[] = [];

    producer.subscribeImpulseSignals(
      (signal) => {
        signals.push(signal);
      },
    );

    source.setMetric(
      impulseMetric(),
    );
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      exactLongMetric(),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    assert.equal(signals.length, 1);

    const signal = signals[0];

    assert.ok(signal);
    assert.equal(signal.direction, 'long');
    assert.equal(signal.previousDirection, null);
    assert.equal(signal.symbol, 'SOLUSDT');
    assert.equal(signal.timeframe, '5m');
    assert.equal(
      signal.occurredAt,
      '2026-08-12T12:00:01.000Z',
    );
    assert.deepEqual(
      {
        methodVersion:
          signal.payload.methodVersion,
        priceChangePct:
          signal.payload.priceChangePct,
        volumeRatio:
          signal.payload.volumeRatio,
        tradesRatio:
          signal.payload.tradesRatio,
        volatilityPct:
          signal.payload.volatilityPct,
        minimumQuoteVolume:
          signal.payload.minimumQuoteVolume,
      },
      {
        methodVersion:
          'market_impulse_v0_1',
        priceChangePct: 0.5,
        volumeRatio: 1.5,
        tradesRatio: 1.5,
        volatilityPct: 0.6,
        minimumQuoteVolume: 50_000,
      },
    );

    assert.equal(
      producer.getStatus()
        .baselineSnapshotsCount,
      1,
    );
    assert.equal(
      producer.getStatus()
        .emittedSignalsCount,
      1,
    );
  },
);

test(
  'deduplicates active state and emits reactivation and reversal',
  () => {
    const source =
      new TestMarketImpulseMetricsSource();
    let currentNow =
      fixedNow();

    const producer =
      new MarketImpulseProducer(
        source,
        {
          now: () =>
            currentNow,
        },
      );

    const signals:
      MarketImpulseSignal[] = [];

    producer.subscribeImpulseSignals(
      (signal) => signals.push(signal),
    );

    source.setMetric(impulseMetric());
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      exactLongMetric(
        '2026-08-12T12:00:01.000Z',
      ),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT', 'solusdt'],
    });

    source.setMetric(
      exactLongMetric(
        '2026-08-12T12:00:02.000Z',
      ),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      impulseMetric({
        priceChangePct: -0.8,
        volumeAnomaly: 2,
        tradesAnomaly: 1.8,
        volatilityPct: 0.9,
        updatedAt:
          '2026-08-12T11:59:59.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      impulseMetric({
        updatedAt:
          '2026-08-12T12:00:03.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      exactLongMetric(
        '2026-08-12T12:00:04.000Z',
      ),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      impulseMetric({
        priceChangePct: -0.8,
        volumeAnomaly: 2,
        tradesAnomaly: 1.8,
        volatilityPct: 0.9,
        updatedAt:
          '2026-08-12T12:00:05.000Z',
      }),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    assert.deepEqual(
      signals.map((signal) => ({
        direction: signal.direction,
        previousDirection:
          signal.previousDirection,
      })),
      [
        {
          direction: 'long',
          previousDirection: null,
        },
        {
          direction: 'long',
          previousDirection: null,
        },
        {
          direction: 'short',
          previousDirection: 'long',
        },
      ],
    );

    const status =
      producer.getStatus();

    assert.equal(status.evaluatedSymbolsCount, 7);
    assert.equal(status.duplicateSnapshotsCount, 1);
    assert.equal(status.outOfOrderSnapshotsCount, 1);
    assert.equal(status.clearedSignalsCount, 1);
    assert.equal(status.emittedSignalsCount, 3);
    assert.equal(status.activeSignalsCount, 1);
    assert.deepEqual(
      producer.getCurrentSnapshot(
        'solusdt',
      ),
      {
        symbol: 'SOLUSDT',
        availability: 'ready',
        scannerWindow: '5m',
        direction: 'short',
        observedAt:
          '2026-08-12T12:00:05.000Z',
      },
    );
    currentNow =
      new Date(
        '2026-08-12T12:02:00.000Z',
      );
    assert.deepEqual(
      producer.getCurrentSnapshot(
        'solusdt',
      ),
      {
        symbol: 'SOLUSDT',
        availability: 'stale',
        scannerWindow: '5m',
        direction: 'short',
        observedAt:
          '2026-08-12T12:00:05.000Z',
      },
    );
  },
);

test(
  'keeps warm-up silent and enforces incomplete stale unavailable and degraded boundaries',
  () => {
    const source =
      new TestMarketImpulseMetricsSource();

    const producer =
      new MarketImpulseProducer(
        source,
        { now: fixedNow },
      );

    const signals:
      MarketImpulseSignal[] = [];

    producer.subscribeImpulseSignals(
      (signal) => signals.push(signal),
    );

    source.setMetric(
      impulseMetric({
        volumeAnomaly: null,
      }),
    );
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });
    assert.equal(
      producer.getStatus().availability,
      'collecting',
    );

    source.setMetric(
      exactLongMetric(
        '2026-08-12T11:58:00.000Z',
      ),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });
    assert.equal(
      producer.getStatus().availability,
      'stale',
    );

    source.setState('reconnecting');
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });
    assert.equal(
      producer.getStatus().availability,
      'unavailable',
    );

    source.setState('degraded');
    source.setMetric(impulseMetric());
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      exactLongMetric(),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    assert.equal(signals.length, 1);
    assert.equal(
      signals[0]?.payload.dataQuality,
      'degraded',
    );

    const status =
      producer.getStatus();

    assert.equal(status.incompleteSnapshotsCount, 1);
    assert.equal(status.staleSnapshotsCount, 1);
    assert.equal(status.unavailableSnapshotsCount, 1);
    assert.equal(status.historicalSnapshotsCount, 2);
  },
);

test(
  'does not replay historical impulses and resets baseline on restart',
  () => {
    const source =
      new TestMarketImpulseMetricsSource();

    const producer =
      new MarketImpulseProducer(
        source,
        { now: fixedNow },
      );

    const signals:
      MarketImpulseSignal[] = [];

    const subscribe = () =>
      producer.subscribeImpulseSignals(
        (signal) => signals.push(signal),
      );

    const unsubscribe = subscribe();

    source.setMetric(impulseMetric());
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(exactLongMetric());
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    assert.equal(signals.length, 0);
    assert.equal(source.listenersCount, 1);

    unsubscribe();
    assert.equal(source.listenersCount, 0);
    assert.equal(producer.getStatus().state, 'idle');
    assert.equal(producer.getStatus().activeSignalsCount, 0);

    const unsubscribeRestart = subscribe();

    source.setMetric(impulseMetric());
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });
    source.setMetric(
      exactLongMetric(
        '2026-08-12T12:00:02.000Z',
      ),
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    assert.equal(signals.length, 1);

    unsubscribeRestart();
  },
);

test(
  'maps and defensively deduplicates source signals while isolating listeners',
  () => {
    const source =
      new ManualImpulseSource();

    const adapter =
      new MarketImpulseAlertEventSource(
        source,
        { maxDedupeKeys: 2 },
      );

    const signal:
      MarketImpulseSignal = {
        sourceEventId:
          'market-impulse:SOLUSDT:5m:1',
        occurredAt:
          '2026-08-12T12:00:01.000Z',
        symbol: 'solusdt',
        timeframe: '5m',
        direction: 'long',
        previousDirection: null,
        payload: {
          signal: 'market_impulse',
          volumeRatio: 1.5,
        },
      };

    const mapped =
      mapMarketImpulseSignalToAlert(
        signal,
      );

    assert.deepEqual(
      {
        source: mapped.source,
        eventType: mapped.eventType,
        symbol: mapped.symbol,
        timeframe: mapped.timeframe,
        entityId: mapped.entityId,
      },
      {
        source: 'market_scanner',
        eventType: 'impulse',
        symbol: 'SOLUSDT',
        timeframe: '5m',
        entityId:
          'market-impulse:SOLUSDT:5m',
      },
    );

    const delivered:
      string[] = [];

    adapter.subscribeAlertEvents(
      () => {
        throw new Error('listener failed');
      },
    );
    adapter.subscribeAlertEvents(
      (event) => {
        delivered.push(
          event.sourceEventId,
        );
      },
    );

    source.emit(signal);
    source.emit(signal);

    assert.deepEqual(
      delivered,
      [signal.sourceEventId],
    );

    const status =
      adapter.getStatus();

    assert.equal(status.signalsCount, 2);
    assert.equal(status.duplicateSignalsCount, 1);
    assert.equal(status.emittedEventsCount, 1);
    assert.equal(status.listenerErrorsCount, 1);
  },
);

test(
  'wires impulse production into the Alerts HTTP runtime',
  async () => {
    const nowMs =
      Date.now();

    const windowStartedAt =
      new Date(
        nowMs - 300_000,
      ).toISOString();

    const baselineUpdatedAt =
      new Date(
        nowMs - 1_000,
      ).toISOString();

    const changedUpdatedAt =
      new Date(
        nowMs - 500,
      ).toISOString();

    const source =
      new TestMarketImpulseMetricsSource();

    const app =
      await buildApp({
        env: testEnv,
        realtimeMarketDataService: null,
        orderBookDepthService: null,
        binanceSymbolUniverseService: null,
        marketWideRealtimeService:
          source as unknown as
            MarketWideRealtimeService,
        marketWideHistoryWarmupService: null,
        setupDetectionRuntimeService: null,
        setupDetectionRuntimeReader: null,
        setupDetectionRuntimeEventSource: null,
        levelV2ShadowRuntimeService: null,
        levelV2ShadowRuntimeReader: null,
      });

    await app.ready();

    assert.equal(source.listenersCount, 3);

    const created =
      await app.inject({
        method: 'POST',
        url: '/api/v1/alerts/rules',
        payload: {
          name: 'SOL impulse',
          eventType: 'impulse',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          cooldownMs: 0,
        },
      });

    assert.equal(created.statusCode, 201);

    source.setMetric(
      impulseMetric({
        windowStartedAt,
        updatedAt:
          baselineUpdatedAt,
      }),
    );
    source.emit({
      source: 'history',
      symbols: ['SOLUSDT'],
    });

    source.setMetric(
      {
        ...exactLongMetric(
          changedUpdatedAt,
        ),
        windowStartedAt,
      },
    );
    source.emit({
      source: 'live',
      symbols: ['SOLUSDT'],
    });

    const triggers =
      await app.inject({
        method: 'GET',
        url: '/api/v1/alerts/triggers',
      });

    assert.equal(triggers.statusCode, 200);
    assert.equal(triggers.json().length, 1);
    assert.equal(
      triggers.json()[0].eventType,
      'impulse',
    );
    assert.equal(
      triggers.json()[0].payload.direction,
      'long',
    );
    assert.equal(
      triggers.json()[0].timeframe,
      '5m',
    );

    await app.close();

    assert.equal(source.listenersCount, 0);
  },
);

test(
  'validates producer and adapter boundaries',
  () => {
    const source =
      new TestMarketImpulseMetricsSource();

    assert.throws(
      () =>
        new MarketImpulseProducer(
          source,
          {
            priceChangeThresholdPct: 0,
          },
        ),
      /priceChangeThresholdPct/,
    );

    assert.throws(
      () =>
        new MarketImpulseProducer(
          source,
          {
            freshnessMs: 999,
          },
        ),
      /freshnessMs/,
    );

    assert.throws(
      () =>
        new MarketImpulseAlertEventSource(
          new ManualImpulseSource(),
          { maxDedupeKeys: 0 },
        ),
      /maxDedupeKeys/,
    );
  },
);
