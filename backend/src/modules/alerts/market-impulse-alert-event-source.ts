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

export const MARKET_IMPULSE_DIRECTIONS = [
  'long',
  'short',
] as const;

export type MarketImpulseDirection =
  typeof MARKET_IMPULSE_DIRECTIONS[number];

export interface MarketImpulseSignal {
  sourceEventId: string;
  occurredAt: string;
  symbol: string;
  timeframe: MarketScannerWindowId;
  direction: MarketImpulseDirection;
  previousDirection: MarketImpulseDirection | null;
  payload: AlertParameters;
}

export type MarketImpulseSignalListener =
  (signal: MarketImpulseSignal) => void;

export interface MarketImpulseSourceContract {
  subscribeImpulseSignals(
    listener: MarketImpulseSignalListener,
  ): () => void;
}

export interface MarketImpulseAlertEventSourceOptions {
  maxDedupeKeys: number;
}

export interface MarketImpulseAlertEventSourceStatus {
  state: 'idle' | 'subscribed';
  signalsCount: number;
  duplicateSignalsCount: number;
  emittedEventsCount: number;
  sourceErrorsCount: number;
  listenerErrorsCount: number;
  dedupeKeysCount: number;
  lastEventAt: string | null;
  lastError: string | null;
}

export const DEFAULT_MARKET_IMPULSE_ALERT_EVENT_SOURCE_OPTIONS:
MarketImpulseAlertEventSourceOptions = {
  maxDedupeKeys: 10_000,
};

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid market impulse symbol: ${value}`,
    );
  }

  return symbol;
}

function normalizeTimestamp(
  value: string,
): string {
  const timestampMs =
    Date.parse(value);

  if (!Number.isFinite(timestampMs)) {
    throw new Error(
      `Invalid market impulse timestamp: ${value}`,
    );
  }

  return new Date(timestampMs).toISOString();
}

function normalizeDirection(
  value: string,
): MarketImpulseDirection {
  const direction =
    value.trim().toLowerCase();

  if (
    !MARKET_IMPULSE_DIRECTIONS.includes(
      direction as MarketImpulseDirection,
    )
  ) {
    throw new Error(
      `Invalid market impulse direction: ${value}`,
    );
  }

  return direction as MarketImpulseDirection;
}

function validateOptions(
  options: MarketImpulseAlertEventSourceOptions,
): void {
  if (
    !Number.isSafeInteger(options.maxDedupeKeys)
    || options.maxDedupeKeys < 1
  ) {
    throw new Error(
      'maxDedupeKeys must be a positive integer',
    );
  }
}

export function mapMarketImpulseSignalToAlert(
  signal: MarketImpulseSignal,
): AlertTriggerEvent {
  if (!isMarketScannerWindowId(signal.timeframe)) {
    throw new Error(
      `Invalid market impulse timeframe: ${signal.timeframe}`,
    );
  }

  const symbol =
    normalizeSymbol(signal.symbol);

  const direction =
    normalizeDirection(signal.direction);

  const previousDirection =
    signal.previousDirection === null
      ? null
      : normalizeDirection(
          signal.previousDirection,
        );

  return {
    sourceEventId:
      signal.sourceEventId,
    source: 'market_scanner',
    eventType: 'impulse',
    occurredAt:
      normalizeTimestamp(
        signal.occurredAt,
      ),
    symbol,
    timeframe:
      signal.timeframe,
    entityId: [
      'market-impulse',
      symbol,
      signal.timeframe,
    ].join(':'),
    payload: {
      ...signal.payload,
      direction,
      previousDirection,
    },
  };
}

export class MarketImpulseAlertEventSource
implements AlertEventSourceContract {
  private readonly options:
    MarketImpulseAlertEventSourceOptions;

  private readonly listeners =
    new Set<AlertEventListener>();

  private readonly seenSourceEventIds =
    new Set<string>();

  private readonly sourceEventIdOrder:
    string[] = [];

  private unsubscribeSource:
    (() => void) | null = null;

  private signalsCount = 0;
  private duplicateSignalsCount = 0;
  private emittedEventsCount = 0;
  private sourceErrorsCount = 0;
  private listenerErrorsCount = 0;
  private lastEventAt:
    string | null = null;
  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      MarketImpulseSourceContract,
    options:
      Partial<
        MarketImpulseAlertEventSourceOptions
      > = {},
  ) {
    this.options = {
      ...DEFAULT_MARKET_IMPULSE_ALERT_EVENT_SOURCE_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
  }

  subscribeAlertEvents(
    listener: AlertEventListener,
  ): () => void {
    this.listeners.add(listener);

    if (!this.unsubscribeSource) {
      try {
        this.unsubscribeSource =
          this.source.subscribeImpulseSignals(
            (signal) => {
              this.handleSignal(signal);
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
        this.seenSourceEventIds.clear();
        this.sourceEventIdOrder.splice(0);
      }
    };
  }

  getStatus():
  MarketImpulseAlertEventSourceStatus {
    return {
      state:
        this.unsubscribeSource
          ? 'subscribed'
          : 'idle',
      signalsCount:
        this.signalsCount,
      duplicateSignalsCount:
        this.duplicateSignalsCount,
      emittedEventsCount:
        this.emittedEventsCount,
      sourceErrorsCount:
        this.sourceErrorsCount,
      listenerErrorsCount:
        this.listenerErrorsCount,
      dedupeKeysCount:
        this.seenSourceEventIds.size,
      lastEventAt:
        this.lastEventAt,
      lastError:
        this.lastError,
    };
  }

  private handleSignal(
    signal: MarketImpulseSignal,
  ): void {
    this.signalsCount += 1;

    try {
      const event =
        mapMarketImpulseSignalToAlert(
          signal,
        );

      if (
        this.seenSourceEventIds.has(
          event.sourceEventId,
        )
      ) {
        this.duplicateSignalsCount += 1;
        return;
      }

      this.rememberSourceEventId(
        event.sourceEventId,
      );
      this.publish(event);
    } catch (error) {
      this.recordSourceError(error);
    }
  }

  private rememberSourceEventId(
    sourceEventId: string,
  ): void {
    this.seenSourceEventIds.add(
      sourceEventId,
    );
    this.sourceEventIdOrder.push(
      sourceEventId,
    );

    while (
      this.sourceEventIdOrder.length
      > this.options.maxDedupeKeys
    ) {
      const removed =
        this.sourceEventIdOrder.shift();

      if (removed) {
        this.seenSourceEventIds.delete(
          removed,
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
    this.lastError = null;

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
            : 'Unable to deliver market impulse alert event';
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
        : 'Unable to read market impulse source';
  }
}
