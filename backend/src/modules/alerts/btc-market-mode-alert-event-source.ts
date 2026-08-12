import {
  isMarketScannerWindowId,
  type MarketScannerWindowId,
} from '../realtime-market-data/scanner-windows.js';
import type {
  AlertEventListener,
  AlertEventSourceContract,
  AlertParameters,
  AlertTriggerEvent,
} from './alerts.types.js';

export const BTC_MARKET_MODES = [
  'risk_on',
  'neutral',
  'risk_off',
] as const;

export type BtcMarketMode =
  typeof BTC_MARKET_MODES[number];

export interface BtcMarketModeChange {
  sourceEventId: string;
  occurredAt: string;
  timeframe: MarketScannerWindowId;
  mode: BtcMarketMode;
  previousMode: BtcMarketMode | null;
  payload: AlertParameters;
}

export type BtcMarketModeChangeListener =
  (event: BtcMarketModeChange) => void;

export interface BtcMarketModeSourceContract {
  subscribeBtcMarketModeChanges(
    listener: BtcMarketModeChangeListener,
  ): () => void;
}

export interface BtcMarketModeAlertEventSourceStatus {
  state: 'idle' | 'subscribed';
  changesCount: number;
  duplicateSnapshotsCount: number;
  emittedEventsCount: number;
  sourceErrorsCount: number;
  listenerErrorsCount: number;
  currentMode: BtcMarketMode | null;
  lastEventAt: string | null;
  lastError: string | null;
}

function normalizeMode(
  value: string,
): BtcMarketMode {
  const mode =
    value.trim().toLowerCase();

  if (
    !BTC_MARKET_MODES.includes(
      mode as BtcMarketMode,
    )
  ) {
    throw new Error(
      `Invalid BTC market mode: ${value}`,
    );
  }

  return mode as BtcMarketMode;
}

function normalizeTimestamp(
  value: string,
): string {
  const timestampMs =
    Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    throw new Error(
      `Invalid BTC market mode timestamp: ${value}`,
    );
  }

  return new Date(
    timestampMs,
  ).toISOString();
}

export function mapBtcMarketModeChangeToAlert(
  change: BtcMarketModeChange,
): AlertTriggerEvent {
  if (
    !isMarketScannerWindowId(
      change.timeframe,
    )
  ) {
    throw new Error(
      `Invalid BTC market mode timeframe: ${change.timeframe}`,
    );
  }

  const mode =
    normalizeMode(change.mode);

  const previousMode =
    change.previousMode === null
      ? null
      : normalizeMode(
          change.previousMode,
        );

  return {
    sourceEventId:
      change.sourceEventId,
    source: 'btc_market_mode',
    eventType:
      'btc_market_mode_changed',
    occurredAt:
      normalizeTimestamp(
        change.occurredAt,
      ),
    symbol: 'BTCUSDT',
    timeframe: change.timeframe,
    entityId:
      `btc-market-mode:${change.timeframe}`,
    payload: {
      ...change.payload,
      mode,
      previousMode,
    },
  };
}

export class BtcMarketModeAlertEventSource
implements AlertEventSourceContract {
  private readonly listeners =
    new Set<AlertEventListener>();

  private unsubscribeSource:
    (() => void) | null = null;

  private changesCount = 0;
  private duplicateSnapshotsCount = 0;
  private emittedEventsCount = 0;
  private sourceErrorsCount = 0;
  private listenerErrorsCount = 0;
  private currentMode:
    BtcMarketMode | null = null;
  private hasCurrentMode = false;
  private lastEventAt:
    string | null = null;
  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      BtcMarketModeSourceContract,
  ) {}

  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void {
    this.listeners.add(listener);

    if (!this.unsubscribeSource) {
      try {
        this.unsubscribeSource =
          this.source
            .subscribeBtcMarketModeChanges(
              (change) => {
                this.handleChange(change);
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
        this.currentMode = null;
        this.hasCurrentMode = false;
      }
    };
  }

  getStatus():
  BtcMarketModeAlertEventSourceStatus {
    return {
      state:
        this.unsubscribeSource
          ? 'subscribed'
          : 'idle',
      changesCount:
        this.changesCount,
      duplicateSnapshotsCount:
        this.duplicateSnapshotsCount,
      emittedEventsCount:
        this.emittedEventsCount,
      sourceErrorsCount:
        this.sourceErrorsCount,
      listenerErrorsCount:
        this.listenerErrorsCount,
      currentMode:
        this.currentMode,
      lastEventAt:
        this.lastEventAt,
      lastError:
        this.lastError,
    };
  }

  private handleChange(
    change: BtcMarketModeChange,
  ): void {
    this.changesCount += 1;

    try {
      const event =
        mapBtcMarketModeChangeToAlert(
          change,
        );

      const modeValue =
        event.payload.mode;

      if (
        typeof modeValue !== 'string'
      ) {
        throw new Error(
          'BTC market mode adapter produced an invalid mode',
        );
      }

      const mode =
        normalizeMode(modeValue);

      if (
        this.hasCurrentMode
        && this.currentMode === mode
      ) {
        this.duplicateSnapshotsCount += 1;
        return;
      }

      this.currentMode = mode;
      this.hasCurrentMode = true;
      this.publish(event);
    } catch (error) {
      this.recordSourceError(error);
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
            : 'Unable to deliver BTC market mode alert event';
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
        : 'Unable to read BTC market mode source';
  }
}
