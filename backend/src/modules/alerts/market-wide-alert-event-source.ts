import type {
  MarketVolumeSpike,
} from '../realtime-market-data/market-volume-spikes.js';
import type {
  MarketWideKlineChange,
  MarketWideKlineChangeListener,
} from '../realtime-market-data/market-wide-realtime.service.js';
import type {
  AlertEventListener,
  AlertEventSourceContract,
  AlertParameters,
  AlertTriggerEvent,
} from './alerts.types.js';

export interface MarketWideComputedAlertSource {
  subscribeKlineChanges(
    listener: MarketWideKlineChangeListener,
  ): () => void;

  getVolumeSpikes(
    symbol?: string,
  ): MarketVolumeSpike[];
}

export interface MarketWideAlertEventSourceStatus {
  state: 'idle' | 'subscribed';
  changesCount: number;
  snapshotsCount: number;
  duplicateSnapshotsCount: number;
  emittedEventsCount: number;
  sourceErrorsCount: number;
  listenerErrorsCount: number;
  lastEventAt: string | null;
  lastError: string | null;
}

function normalizeTimestamp(
  value: string,
): string {
  const timestampMs =
    Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    throw new Error(
      `Invalid market alert timestamp: ${value}`,
    );
  }

  return new Date(
    timestampMs,
  ).toISOString();
}

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!/^[A-Z0-9]{5,30}$/.test(symbol)) {
    throw new Error(
      `Invalid market alert symbol: ${value}`,
    );
  }

  return symbol;
}

function buildStateKey(
  spike: MarketVolumeSpike,
): string {
  return [
    normalizeSymbol(spike.symbol),
    spike.periodMinutes,
  ].join(':');
}

function buildStateFingerprint(
  spike: MarketVolumeSpike,
): string {
  return [
    normalizeTimestamp(
      spike.periodStartedAt,
    ),
    spike.status,
  ].join(':');
}

function buildEventToken(
  spike: MarketVolumeSpike,
): string {
  return [
    normalizeSymbol(spike.symbol),
    `${spike.periodMinutes}m`,
    normalizeTimestamp(
      spike.periodStartedAt,
    ),
    spike.status,
  ].join(':');
}

function buildPayload(
  spike: MarketVolumeSpike,
  changeSource:
    MarketWideKlineChange['source'],
): AlertParameters {
  return {
    signal: 'market_volume_spike',
    status: spike.status,
    changeSource,
    periodMinutes:
      spike.periodMinutes,
    baselinePeriods:
      spike.baselinePeriods,
    currentQuoteVolume:
      spike.currentQuoteVolume,
    previousQuoteVolume:
      spike.previousQuoteVolume,
    baselineQuoteVolume:
      spike.baselineQuoteVolume,
    volumeRatio:
      spike.volumeRatio,
    previousVolumeRatio:
      spike.previousVolumeRatio,
    currentTradesCount:
      spike.currentTradesCount,
    previousTradesCount:
      spike.previousTradesCount,
    baselineTradesCount:
      spike.baselineTradesCount,
    tradesRatio:
      spike.tradesRatio,
    priceChangePct:
      spike.priceChangePct,
    periodStartedAt:
      normalizeTimestamp(
        spike.periodStartedAt,
      ),
  };
}

export function mapMarketVolumeSpikeToAlerts(
  spike: MarketVolumeSpike,
  changeSource:
    MarketWideKlineChange['source'],
): AlertTriggerEvent[] {
  const symbol =
    normalizeSymbol(spike.symbol);

  const occurredAt =
    normalizeTimestamp(
      spike.updatedAt,
    );

  const eventToken =
    buildEventToken(spike);

  const entityId =
    `market-activity:${eventToken}`;

  const payload =
    buildPayload(
      spike,
      changeSource,
    );

  return [
    {
      sourceEventId:
        `volume-spike:${eventToken}`,
      source: 'market_scanner',
      eventType: 'volume_spike',
      occurredAt,
      symbol,
      timeframe:
        `${spike.periodMinutes}m`,
      entityId,
      payload: {
        ...payload,
        anomalyRatio:
          spike.volumeRatio,
      },
    },
    {
      sourceEventId:
        `trades-anomaly:${eventToken}`,
      source: 'market_scanner',
      eventType: 'trades_anomaly',
      occurredAt,
      symbol,
      timeframe:
        `${spike.periodMinutes}m`,
      entityId,
      payload: {
        ...payload,
        anomalyRatio:
          spike.tradesRatio,
      },
    },
  ];
}

export class MarketWideAlertEventSource
implements AlertEventSourceContract {
  private readonly listeners =
    new Set<AlertEventListener>();

  private readonly stateFingerprints =
    new Map<string, string>();

  private unsubscribeSource:
    (() => void) | null = null;

  private changesCount = 0;
  private snapshotsCount = 0;
  private duplicateSnapshotsCount = 0;
  private emittedEventsCount = 0;
  private sourceErrorsCount = 0;
  private listenerErrorsCount = 0;
  private lastEventAt:
    string | null = null;
  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      MarketWideComputedAlertSource,
  ) {}

  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void {
    this.listeners.add(listener);

    if (!this.unsubscribeSource) {
      try {
        this.unsubscribeSource =
          this.source
            .subscribeKlineChanges(
              (event) => {
                this.handleChange(event);
              },
            );
      } catch (error) {
        this.recordSourceError(error);
      }
    }

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.listeners.delete(listener);

      if (
        this.listeners.size === 0
        && this.unsubscribeSource
      ) {
        try {
          this.unsubscribeSource();
        } catch (error) {
          this.recordSourceError(error);
        }

        this.unsubscribeSource = null;
        this.stateFingerprints.clear();
      }
    };
  }

  getStatus():
  MarketWideAlertEventSourceStatus {
    return {
      state:
        this.unsubscribeSource
          ? 'subscribed'
          : 'idle',
      changesCount:
        this.changesCount,
      snapshotsCount:
        this.snapshotsCount,
      duplicateSnapshotsCount:
        this.duplicateSnapshotsCount,
      emittedEventsCount:
        this.emittedEventsCount,
      sourceErrorsCount:
        this.sourceErrorsCount,
      listenerErrorsCount:
        this.listenerErrorsCount,
      lastEventAt:
        this.lastEventAt,
      lastError:
        this.lastError,
    };
  }

  private handleChange(
    event: MarketWideKlineChange,
  ): void {
    this.changesCount += 1;

    const symbols =
      [
        ...new Set(
          event.symbols.map(
            (symbol) =>
              normalizeSymbol(symbol),
          ),
        ),
      ].sort();

    for (const symbol of symbols) {
      try {
        const spikes =
          this.source
            .getVolumeSpikes(symbol);

        this.processSnapshots(
          symbol,
          spikes,
          event.source,
        );
      } catch (error) {
        this.recordSourceError(error);
      }
    }
  }

  private processSnapshots(
    symbol: string,
    spikes: readonly MarketVolumeSpike[],
    changeSource:
      MarketWideKlineChange['source'],
  ): void {
    const activeKeys =
      new Set<string>();

    for (const spike of spikes) {
      this.snapshotsCount += 1;

      const stateKey =
        buildStateKey(spike);

      const fingerprint =
        buildStateFingerprint(spike);

      activeKeys.add(stateKey);

      if (
        this.stateFingerprints
          .get(stateKey)
        === fingerprint
      ) {
        this.duplicateSnapshotsCount += 1;
        continue;
      }

      this.stateFingerprints.set(
        stateKey,
        fingerprint,
      );

      for (
        const event
        of mapMarketVolumeSpikeToAlerts(
          spike,
          changeSource,
        )
      ) {
        this.publish(event);
      }
    }

    const symbolPrefix =
      `${symbol}:`;

    for (
      const stateKey
      of this.stateFingerprints.keys()
    ) {
      if (
        stateKey.startsWith(
          symbolPrefix,
        )
        && !activeKeys.has(stateKey)
      ) {
        this.stateFingerprints.delete(
          stateKey,
        );
      }
    }
  }

  private publish(
    event: AlertTriggerEvent,
  ): void {
    this.emittedEventsCount += 1;
    this.lastEventAt =
      event.occurredAt;

    for (const listener of this.listeners) {
      try {
        listener({
          ...event,
          payload: {
            ...event.payload,
          },
        });
      } catch (error) {
        this.listenerErrorsCount += 1;
        this.lastError =
          error instanceof Error
            ? error.message
            : 'Unable to deliver market alert event';
      }
    }
  }

  private recordSourceError(
    error: unknown,
  ): void {
    this.sourceErrorsCount += 1;
    this.lastError =
      error instanceof Error
        ? error.message
        : 'Unable to read market alert source';
  }
}
