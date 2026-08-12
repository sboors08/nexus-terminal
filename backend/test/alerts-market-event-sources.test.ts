import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApp,
} from '../src/app.js';
import type {
  AppEnv,
} from '../src/config/env.js';
import {
  AlertsRuntimeService,
} from '../src/modules/alerts/alerts-runtime.service.js';
import {
  BtcMarketModeAlertEventSource,
  type BtcMarketModeChange,
  type BtcMarketModeChangeListener,
  type BtcMarketModeSourceContract,
} from '../src/modules/alerts/btc-market-mode-alert-event-source.js';
import {
  mapMarketVolumeSpikeToAlerts,
  MarketWideAlertEventSource,
  type MarketWideComputedAlertSource,
} from '../src/modules/alerts/market-wide-alert-event-source.js';
import type {
  AlertTriggerEvent,
} from '../src/modules/alerts/alerts.types.js';
import type {
  MarketVolumeSpike,
} from '../src/modules/realtime-market-data/market-volume-spikes.js';
import type {
  MarketWideKlineChange,
  MarketWideKlineChangeListener,
  MarketWideRealtimeService,
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

function volumeSpike(
  overrides:
    Partial<MarketVolumeSpike> = {},
): MarketVolumeSpike {
  return {
    symbol: 'SOLUSDT',
    status: 'new',
    periodMinutes: 5,
    baselinePeriods: 12,
    currentQuoteVolume:
      240_000,
    previousQuoteVolume:
      100_000,
    baselineQuoteVolume:
      80_000,
    volumeRatio: 3,
    previousVolumeRatio: 1.25,
    currentTradesCount: 900,
    previousTradesCount: 320,
    baselineTradesCount: 300,
    tradesRatio: 3,
    priceChangePct: 1.75,
    periodStartedAt:
      '2026-08-12T12:00:00.000Z',
    updatedAt:
      '2026-08-12T12:04:59.999Z',
    ...overrides,
  };
}

class TestMarketSource
implements MarketWideComputedAlertSource {
  private readonly listeners =
    new Set<MarketWideKlineChangeListener>();

  private readonly snapshots =
    new Map<
      string,
      MarketVolumeSpike[]
    >();

  private readonly errors =
    new Map<string, Error>();

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

  getVolumeSpikes(
    symbol?: string,
  ): MarketVolumeSpike[] {
    const normalized =
      symbol?.toUpperCase()
      ?? '';

    const error =
      this.errors.get(normalized);

    if (error) {
      throw error;
    }

    return (
      this.snapshots.get(normalized)
      ?? []
    ).map((spike) => ({
      ...spike,
    }));
  }

  setSnapshots(
    symbol: string,
    snapshots:
      readonly MarketVolumeSpike[],
  ): void {
    this.errors.delete(
      symbol.toUpperCase(),
    );

    this.snapshots.set(
      symbol.toUpperCase(),
      snapshots.map((snapshot) => ({
        ...snapshot,
      })),
    );
  }

  setError(
    symbol: string,
    error: Error,
  ): void {
    this.errors.set(
      symbol.toUpperCase(),
      error,
    );
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

class TestBtcModeSource
implements BtcMarketModeSourceContract {
  private readonly listeners =
    new Set<BtcMarketModeChangeListener>();

  get listenersCount(): number {
    return this.listeners.size;
  }

  subscribeBtcMarketModeChanges(
    listener: BtcMarketModeChangeListener,
  ): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(
    event: BtcMarketModeChange,
  ): void {
    for (const listener of this.listeners) {
      listener({
        ...event,
        payload: {
          ...event.payload,
        },
      });
    }
  }
}

function modeChange(
  sourceEventId: string,
  mode: string,
  previousMode: string | null,
): BtcMarketModeChange {
  return {
    sourceEventId,
    occurredAt:
      '2026-08-12T12:00:00.000Z',
    mode,
    previousMode,
    payload: {
      confidence: 0.8,
    },
  };
}

test(
  'maps the existing Volume Spike classification without recalculating it',
  () => {
    const spike =
      volumeSpike();

    const events =
      mapMarketVolumeSpikeToAlerts(
        spike,
        'live',
      );

    assert.deepEqual(
      events.map(
        (event) =>
          event.eventType,
      ),
      [
        'volume_spike',
        'trades_anomaly',
      ],
    );

    assert.equal(
      events[0]?.payload.anomalyRatio,
      spike.volumeRatio,
    );

    assert.equal(
      events[1]?.payload.anomalyRatio,
      spike.tradesRatio,
    );

    assert.equal(
      events[0]?.payload.status,
      spike.status,
    );

    assert.equal(
      events[0]?.timeframe,
      '5m',
    );

    assert.match(
      events[0]?.sourceEventId
      ?? '',
      /^[A-Za-z0-9._:-]{1,300}$/,
    );
  },
);

test(
  'emits market state changes once for repeated snapshot and poll events',
  () => {
    const source =
      new TestMarketSource();

    const adapter =
      new MarketWideAlertEventSource(
        source,
      );

    const events:
      AlertTriggerEvent[] = [];

    const unsubscribe =
      adapter.subscribeAlertEvents(
        (event) => {
          events.push(event);
        },
      );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike(),
      ],
    );

    source.emit({
      source: 'history',
      symbols: [
        'SOLUSDT',
        'SOLUSDT',
      ],
    });

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike({
          updatedAt:
            '2026-08-12T12:05:30.000Z',
        }),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      events.length,
      2,
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike({
          status: 'growing',
          updatedAt:
            '2026-08-12T12:06:30.000Z',
        }),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      events.length,
      4,
    );

    assert.notEqual(
      events[0]?.sourceEventId,
      events[2]?.sourceEventId,
    );

    assert.deepEqual(
      adapter.getStatus(),
      {
        state: 'subscribed',
        changesCount: 3,
        snapshotsCount: 3,
        duplicateSnapshotsCount: 1,
        emittedEventsCount: 4,
        sourceErrorsCount: 0,
        listenerErrorsCount: 0,
        lastEventAt:
          '2026-08-12T12:06:30.000Z',
        lastError: null,
      },
    );

    unsubscribe();
    unsubscribe();

    assert.equal(
      source.listenersCount,
      0,
    );

    assert.equal(
      adapter.getStatus().state,
      'idle',
    );
  },
);

test(
  'isolates one market source error and one alert listener error',
  () => {
    const source =
      new TestMarketSource();

    const adapter =
      new MarketWideAlertEventSource(
        source,
      );

    const delivered:
      AlertTriggerEvent[] = [];

    adapter.subscribeAlertEvents(
      () => {
        throw new Error(
          'listener unavailable',
        );
      },
    );

    adapter.subscribeAlertEvents(
      (event) => {
        delivered.push(event);
      },
    );

    source.setError(
      'BADUSDT',
      new Error(
        'snapshot unavailable',
      ),
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike(),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'BADUSDT',
        'SOLUSDT',
      ],
    });

    assert.equal(
      delivered.length,
      2,
    );

    assert.equal(
      adapter.getStatus()
        .sourceErrorsCount,
      1,
    );

    assert.equal(
      adapter.getStatus()
        .listenerErrorsCount,
      2,
    );

    assert.equal(
      adapter.getStatus().lastError,
      'listener unavailable',
    );
  },
);

test(
  'defines a canonical BTC Market Mode state-change adapter without market math',
  () => {
    const source =
      new TestBtcModeSource();

    const adapter =
      new BtcMarketModeAlertEventSource(
        source,
      );

    const events:
      AlertTriggerEvent[] = [];

    const unsubscribe =
      adapter.subscribeAlertEvents(
        (event) => {
          events.push(event);
        },
      );

    source.emit(
      modeChange(
        'btc-mode-1',
        'risk_on',
        null,
      ),
    );

    source.emit(
      modeChange(
        'btc-mode-poll-2',
        'risk_on',
        'risk_on',
      ),
    );

    source.emit({
      ...modeChange(
        'btc-mode-3',
        'risk_off',
        'risk_on',
      ),
      occurredAt:
        '2026-08-12T12:05:00.000Z',
    });

    assert.equal(
      events.length,
      2,
    );

    assert.deepEqual(
      events.map((event) => ({
        source: event.source,
        eventType: event.eventType,
        symbol: event.symbol,
        mode: event.payload.mode,
      })),
      [
        {
          source: 'btc_market_mode',
          eventType:
            'btc_market_mode_changed',
          symbol: 'BTCUSDT',
          mode: 'risk_on',
        },
        {
          source: 'btc_market_mode',
          eventType:
            'btc_market_mode_changed',
          symbol: 'BTCUSDT',
          mode: 'risk_off',
        },
      ],
    );

    assert.equal(
      adapter.getStatus()
        .duplicateSnapshotsCount,
      1,
    );

    assert.equal(
      adapter.getStatus().currentMode,
      'risk_off',
    );

    unsubscribe();

    assert.equal(
      source.listenersCount,
      0,
    );
  },
);

test(
  'keeps market cooldown and bounded trigger history in Alerts runtime',
  () => {
    const source =
      new TestMarketSource();

    const adapter =
      new MarketWideAlertEventSource(
        source,
      );

    let now =
      new Date(
        '2026-08-12T12:00:00.000Z',
      );

    let sequence = 0;

    const runtime =
      new AlertsRuntimeService(
        [
          adapter,
        ],
        {
          maxTriggers: 2,
          defaultCooldownMs:
            60_000,
          now: () => now,
          createId: (kind) =>
            `${kind}-${++sequence}`,
        },
      );

    runtime.createRule({
      name: 'SOL volume spike',
      eventType: 'volume_spike',
      symbol: 'SOLUSDT',
      timeframe: '5m',
    });

    runtime.start();

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike(),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    now = new Date(
      '2026-08-12T12:00:30.000Z',
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike({
          status: 'growing',
          updatedAt:
            '2026-08-12T12:05:30.000Z',
        }),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    assert.equal(
      runtime.getTriggers().length,
      1,
    );

    now = new Date(
      '2026-08-12T12:01:01.000Z',
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike({
          periodStartedAt:
            '2026-08-12T12:05:00.000Z',
          updatedAt:
            '2026-08-12T12:09:59.999Z',
        }),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    now = new Date(
      '2026-08-12T12:02:02.000Z',
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike({
          periodStartedAt:
            '2026-08-12T12:10:00.000Z',
          updatedAt:
            '2026-08-12T12:14:59.999Z',
        }),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    const triggers =
      runtime.getTriggers();

    assert.equal(
      triggers.length,
      2,
    );

    assert.deepEqual(
      triggers
        .map(
          (trigger) =>
            trigger.sourceEventId,
        )
        .sort(),
      [
        'volume-spike:SOLUSDT:5m:2026-08-12T12:05:00.000Z:new',
        'volume-spike:SOLUSDT:5m:2026-08-12T12:10:00.000Z:new',
      ],
    );

    assert.equal(
      runtime.getStatus()
        .persistenceMode,
      'runtime_only',
    );

    runtime.stop();
  },
);

test(
  'buildApp subscribes the real market adapter before market events arrive',
  async () => {
    const source =
      new TestMarketSource();

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
      1,
    );

    const created =
      await app.inject({
        method: 'POST',
        url: '/api/v1/alerts/rules',
        payload: {
          name: 'Live SOL volume',
          eventType: 'volume_spike',
          symbol: 'SOLUSDT',
          timeframe: '5m',
          cooldownMs: 0,
        },
      });

    assert.equal(
      created.statusCode,
      201,
    );

    source.setSnapshots(
      'SOLUSDT',
      [
        volumeSpike(),
      ],
    );

    source.emit({
      source: 'live',
      symbols: [
        'SOLUSDT',
      ],
    });

    const response =
      await app.inject({
        method: 'GET',
        url:
          '/api/v1/alerts/triggers?eventType=volume_spike',
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json().length,
      1,
    );

    assert.equal(
      response.json()[0].payload
        .volumeRatio,
      3,
    );

    await app.close();

    assert.equal(
      source.listenersCount,
      0,
    );
  },
);
