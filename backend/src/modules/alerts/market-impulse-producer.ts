import type {
  MarketScannerMetrics,
} from '../realtime-market-data/market-scanner-metrics.js';
import type {
  MarketWideKlineChange,
  MarketWideKlineChangeListener,
  MarketWideRealtimeState,
  MarketWideRealtimeStatus,
} from '../realtime-market-data/market-wide-realtime.service.js';
import {
  getMarketScannerWindowMs,
  isMarketScannerWindowId,
  type MarketScannerWindowId,
} from '../realtime-market-data/scanner-windows.js';
import type {
  AlertParameters,
} from './alerts.types.js';
import type {
  MarketImpulseDirection,
  MarketImpulseSignal,
  MarketImpulseSignalListener,
  MarketImpulseSourceContract,
} from './market-impulse-alert-event-source.js';

export interface MarketImpulseMetricsSource {
  subscribeKlineChanges(
    listener: MarketWideKlineChangeListener,
  ): () => void;

  getMetrics(
    symbol?: string,
    scannerWindow?: MarketScannerWindowId,
  ): MarketScannerMetrics[];

  getStatus(): MarketWideRealtimeStatus;
}

export interface MarketImpulseProducerOptions {
  scannerWindow: MarketScannerWindowId;
  freshnessMs: number;
  maximumFutureSkewMs: number;
  priceChangeThresholdPct: number;
  volumeAnomalyThreshold: number;
  tradesAnomalyThreshold: number;
  volatilityThresholdPct: number;
  minimumQuoteVolume: number;
  now: () => Date;
}

export type MarketImpulseAvailability =
  | 'idle'
  | 'collecting'
  | 'ready'
  | 'degraded'
  | 'unavailable'
  | 'stale'
  | 'error';

export interface MarketImpulseProducerStatus {
  state: 'idle' | 'subscribed';
  availability: MarketImpulseAvailability;
  scannerWindow: MarketScannerWindowId;
  sourceState: MarketWideRealtimeState | null;
  activeSignalsCount: number;
  klineChangesCount: number;
  evaluatedSymbolsCount: number;
  historicalSnapshotsCount: number;
  baselineSnapshotsCount: number;
  silentHistoricalChangesCount: number;
  duplicateSnapshotsCount: number;
  clearedSignalsCount: number;
  emittedSignalsCount: number;
  unavailableSnapshotsCount: number;
  incompleteSnapshotsCount: number;
  staleSnapshotsCount: number;
  outOfOrderSnapshotsCount: number;
  sourceErrorsCount: number;
  listenerErrorsCount: number;
  lastEvidenceSymbol: string | null;
  lastDirection: MarketImpulseDirection | null;
  lastEvidenceAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
}

interface CompleteImpulseMetric
extends MarketScannerMetrics {
  price: number;
  priceChangePct: number;
  volumeAnomaly: number;
  tradesAnomaly: number;
  volatilityPct: number;
  windowStartedAt: string;
  updatedAt: string;
}

interface MarketImpulseEvidence {
  direction: MarketImpulseDirection | null;
  occurredAt: string;
  windowStartedAt: string;
  payload: AlertParameters;
}

export const DEFAULT_MARKET_IMPULSE_PRODUCER_OPTIONS:
MarketImpulseProducerOptions = {
  scannerWindow: '5m',
  freshnessMs: 90_000,
  maximumFutureSkewMs: 5_000,
  priceChangeThresholdPct: 0.5,
  volumeAnomalyThreshold: 1.5,
  tradesAnomalyThreshold: 1.5,
  volatilityThresholdPct: 0.6,
  minimumQuoteVolume: 50_000,
  now: () => new Date(),
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

function validatePositiveFinite(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `${name} must be greater than zero`,
    );
  }
}

function validateOptions(
  options: MarketImpulseProducerOptions,
): void {
  if (!isMarketScannerWindowId(options.scannerWindow)) {
    throw new Error(
      `Invalid market impulse scannerWindow: ${options.scannerWindow}`,
    );
  }

  if (
    !Number.isSafeInteger(options.freshnessMs)
    || options.freshnessMs < 1_000
  ) {
    throw new Error(
      'freshnessMs must be an integer greater than or equal to 1000',
    );
  }

  if (
    !Number.isSafeInteger(options.maximumFutureSkewMs)
    || options.maximumFutureSkewMs < 0
  ) {
    throw new Error(
      'maximumFutureSkewMs must be a non-negative integer',
    );
  }

  validatePositiveFinite(
    options.priceChangeThresholdPct,
    'priceChangeThresholdPct',
  );
  validatePositiveFinite(
    options.volumeAnomalyThreshold,
    'volumeAnomalyThreshold',
  );
  validatePositiveFinite(
    options.tradesAnomalyThreshold,
    'tradesAnomalyThreshold',
  );
  validatePositiveFinite(
    options.volatilityThresholdPct,
    'volatilityThresholdPct',
  );
  validatePositiveFinite(
    options.minimumQuoteVolume,
    'minimumQuoteVolume',
  );

  if (typeof options.now !== 'function') {
    throw new Error(
      'Market impulse now must be a function',
    );
  }
}

function isCompleteMetric(
  metric: MarketScannerMetrics,
  scannerWindow: MarketScannerWindowId,
): metric is CompleteImpulseMetric {
  return (
    metric.scannerWindow === scannerWindow
    && metric.windowMs
      === getMarketScannerWindowMs(scannerWindow)
    && Number.isFinite(metric.price)
    && (metric.price ?? 0) > 0
    && Number.isFinite(metric.priceChangePct)
    && Number.isFinite(metric.volumeAnomaly)
    && (metric.volumeAnomaly ?? -1) >= 0
    && Number.isFinite(metric.tradesAnomaly)
    && (metric.tradesAnomaly ?? -1) >= 0
    && Number.isFinite(metric.volatilityPct)
    && (metric.volatilityPct ?? -1) >= 0
    && Number.isFinite(metric.quoteVolume)
    && metric.quoteVolume >= 0
    && Number.isSafeInteger(metric.tradesCount)
    && metric.tradesCount >= 0
    && typeof metric.windowStartedAt === 'string'
    && Number.isFinite(Date.parse(metric.windowStartedAt))
    && typeof metric.updatedAt === 'string'
    && Number.isFinite(Date.parse(metric.updatedAt))
  );
}

function selectLatestMetric(
  metrics: readonly MarketScannerMetrics[],
  symbol: string,
): MarketScannerMetrics | null {
  let selected:
    MarketScannerMetrics | null = null;
  let selectedTimestampMs =
    Number.NEGATIVE_INFINITY;

  for (const metric of metrics) {
    if (normalizeSymbol(metric.symbol) !== symbol) {
      continue;
    }

    const timestampMs =
      Date.parse(metric.updatedAt ?? '');

    if (
      !selected
      || (
        Number.isFinite(timestampMs)
        && timestampMs >= selectedTimestampMs
      )
    ) {
      selected = metric;
      selectedTimestampMs = timestampMs;
    }
  }

  return selected;
}

function classifyDirection(
  metric: CompleteImpulseMetric,
  options: MarketImpulseProducerOptions,
): MarketImpulseDirection | null {
  const hasImpulseEvidence =
    Math.abs(metric.priceChangePct)
      >= options.priceChangeThresholdPct
    && metric.volumeAnomaly
      >= options.volumeAnomalyThreshold
    && metric.tradesAnomaly
      >= options.tradesAnomalyThreshold
    && metric.volatilityPct
      >= options.volatilityThresholdPct
    && metric.quoteVolume
      >= options.minimumQuoteVolume
    && metric.tradesCount > 0;

  if (!hasImpulseEvidence) {
    return null;
  }

  return metric.priceChangePct > 0
    ? 'long'
    : 'short';
}

export class MarketImpulseProducer
implements MarketImpulseSourceContract {
  private readonly options:
    MarketImpulseProducerOptions;

  private readonly listeners =
    new Set<MarketImpulseSignalListener>();

  private readonly directionsBySymbol =
    new Map<
      string,
      MarketImpulseDirection | null
    >();

  private readonly evidenceTimestampsBySymbol =
    new Map<string, number>();

  private unsubscribeSource:
    (() => void) | null = null;

  private availability:
    MarketImpulseAvailability = 'idle';
  private sourceState:
    MarketWideRealtimeState | null = null;
  private klineChangesCount = 0;
  private evaluatedSymbolsCount = 0;
  private historicalSnapshotsCount = 0;
  private baselineSnapshotsCount = 0;
  private silentHistoricalChangesCount = 0;
  private duplicateSnapshotsCount = 0;
  private clearedSignalsCount = 0;
  private emittedSignalsCount = 0;
  private unavailableSnapshotsCount = 0;
  private incompleteSnapshotsCount = 0;
  private staleSnapshotsCount = 0;
  private outOfOrderSnapshotsCount = 0;
  private sourceErrorsCount = 0;
  private listenerErrorsCount = 0;
  private lastEvidenceSymbol:
    string | null = null;
  private lastDirection:
    MarketImpulseDirection | null = null;
  private lastEvidenceAt:
    string | null = null;
  private lastEventAt:
    string | null = null;
  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      MarketImpulseMetricsSource,
    options:
      Partial<
        MarketImpulseProducerOptions
      > = {},
  ) {
    this.options = {
      ...DEFAULT_MARKET_IMPULSE_PRODUCER_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
  }

  subscribeImpulseSignals(
    listener: MarketImpulseSignalListener,
  ): () => void {
    this.listeners.add(listener);

    if (!this.unsubscribeSource) {
      this.availability = 'collecting';

      try {
        this.unsubscribeSource =
          this.source.subscribeKlineChanges(
            (event) => {
              this.evaluate(event);
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

      if (this.listeners.size === 0) {
        if (this.unsubscribeSource) {
          try {
            this.unsubscribeSource();
          } catch (error) {
            this.recordSourceError(error);
          }
        }

        this.unsubscribeSource = null;
        this.availability = 'idle';
        this.sourceState = null;
        this.directionsBySymbol.clear();
        this.evidenceTimestampsBySymbol.clear();
        this.clearEvidenceSnapshot();
      }
    };
  }

  getStatus(): MarketImpulseProducerStatus {
    return {
      state:
        this.unsubscribeSource
          ? 'subscribed'
          : 'idle',
      availability:
        this.availability,
      scannerWindow:
        this.options.scannerWindow,
      sourceState:
        this.sourceState,
      activeSignalsCount:
        [...this.directionsBySymbol.values()]
          .filter((direction) => direction !== null)
          .length,
      klineChangesCount:
        this.klineChangesCount,
      evaluatedSymbolsCount:
        this.evaluatedSymbolsCount,
      historicalSnapshotsCount:
        this.historicalSnapshotsCount,
      baselineSnapshotsCount:
        this.baselineSnapshotsCount,
      silentHistoricalChangesCount:
        this.silentHistoricalChangesCount,
      duplicateSnapshotsCount:
        this.duplicateSnapshotsCount,
      clearedSignalsCount:
        this.clearedSignalsCount,
      emittedSignalsCount:
        this.emittedSignalsCount,
      unavailableSnapshotsCount:
        this.unavailableSnapshotsCount,
      incompleteSnapshotsCount:
        this.incompleteSnapshotsCount,
      staleSnapshotsCount:
        this.staleSnapshotsCount,
      outOfOrderSnapshotsCount:
        this.outOfOrderSnapshotsCount,
      sourceErrorsCount:
        this.sourceErrorsCount,
      listenerErrorsCount:
        this.listenerErrorsCount,
      lastEvidenceSymbol:
        this.lastEvidenceSymbol,
      lastDirection:
        this.lastDirection,
      lastEvidenceAt:
        this.lastEvidenceAt,
      lastEventAt:
        this.lastEventAt,
      lastError:
        this.lastError,
    };
  }

  private evaluate(
    event: MarketWideKlineChange,
  ): void {
    this.klineChangesCount += 1;

    try {
      const symbols = [
        ...new Set(
          event.symbols.map(
            normalizeSymbol,
          ),
        ),
      ];

      if (symbols.length === 0) {
        return;
      }

      const nowMs =
        this.options.now().getTime();

      if (!Number.isFinite(nowMs)) {
        throw new Error(
          'Market impulse clock returned an invalid date',
        );
      }

      const sourceStatus =
        this.source.getStatus();

      this.sourceState =
        sourceStatus.state;

      if (
        sourceStatus.state !== 'connected'
        && sourceStatus.state !== 'degraded'
      ) {
        this.availability = 'unavailable';
        this.unavailableSnapshotsCount +=
          symbols.length;
        this.clearEvidenceSnapshot();
        return;
      }

      for (const symbol of symbols) {
        try {
          this.evaluateSymbol(
            symbol,
            event,
            nowMs,
            sourceStatus.state,
          );
        } catch (error) {
          this.recordSourceError(error);
        }
      }
    } catch (error) {
      this.recordSourceError(error);
    }
  }

  private evaluateSymbol(
    symbol: string,
    event: MarketWideKlineChange,
    nowMs: number,
    sourceState: 'connected' | 'degraded',
  ): void {
    this.evaluatedSymbolsCount += 1;

    if (event.source === 'history') {
      this.historicalSnapshotsCount += 1;
    }

    const metrics =
      this.source.getMetrics(
        symbol,
        this.options.scannerWindow,
      );

    const metric =
      selectLatestMetric(
        metrics,
        symbol,
      );

    if (
      !metric
      || !isCompleteMetric(
        metric,
        this.options.scannerWindow,
      )
    ) {
      this.availability = 'collecting';
      this.incompleteSnapshotsCount += 1;
      this.clearEvidenceSnapshot();
      return;
    }

    const updatedAtMs =
      Date.parse(metric.updatedAt);

    const windowStartedAtMs =
      Date.parse(metric.windowStartedAt);

    const ageMs =
      nowMs - updatedAtMs;

    if (
      ageMs > this.options.freshnessMs
      || ageMs < -this.options.maximumFutureSkewMs
      || windowStartedAtMs > updatedAtMs
    ) {
      this.availability = 'stale';
      this.staleSnapshotsCount += 1;
      this.clearEvidenceSnapshot();
      return;
    }

    const previousEvidenceTimestampMs =
      this.evidenceTimestampsBySymbol.get(
        symbol,
      );

    if (
      previousEvidenceTimestampMs !== undefined
      && updatedAtMs < previousEvidenceTimestampMs
    ) {
      this.outOfOrderSnapshotsCount += 1;
      return;
    }

    this.evidenceTimestampsBySymbol.set(
      symbol,
      updatedAtMs,
    );

    const evidence =
      this.buildEvidence(
        metric,
        event,
        sourceState,
      );

    this.availability =
      sourceState === 'degraded'
        ? 'degraded'
        : 'ready';
    this.lastEvidenceSymbol = symbol;
    this.lastDirection =
      evidence.direction;
    this.lastEvidenceAt =
      evidence.occurredAt;
    this.lastError = null;

    const hasBaseline =
      this.directionsBySymbol.has(symbol);

    const previousDirection =
      this.directionsBySymbol.get(symbol)
      ?? null;

    if (!hasBaseline) {
      this.directionsBySymbol.set(
        symbol,
        evidence.direction,
      );
      this.baselineSnapshotsCount += 1;
      return;
    }

    if (previousDirection === evidence.direction) {
      this.duplicateSnapshotsCount += 1;
      return;
    }

    this.directionsBySymbol.set(
      symbol,
      evidence.direction,
    );

    if (event.source === 'history') {
      this.silentHistoricalChangesCount += 1;
      return;
    }

    if (evidence.direction === null) {
      this.clearedSignalsCount += 1;
      return;
    }

    this.publish({
      sourceEventId: [
        'market-impulse',
        symbol,
        this.options.scannerWindow,
        evidence.windowStartedAt,
        evidence.occurredAt,
        evidence.direction,
      ].join(':'),
      occurredAt:
        evidence.occurredAt,
      symbol,
      timeframe:
        this.options.scannerWindow,
      direction:
        evidence.direction,
      previousDirection,
      payload:
        evidence.payload,
    });
  }

  private buildEvidence(
    metric: CompleteImpulseMetric,
    event: MarketWideKlineChange,
    sourceState: 'connected' | 'degraded',
  ): MarketImpulseEvidence {
    const occurredAt =
      new Date(
        Date.parse(metric.updatedAt),
      ).toISOString();

    const windowStartedAt =
      new Date(
        Date.parse(metric.windowStartedAt),
      ).toISOString();

    const direction =
      classifyDirection(
        metric,
        this.options,
      );

    return {
      direction,
      occurredAt,
      windowStartedAt,
      payload: {
        signal: 'market_impulse',
        methodVersion:
          'market_impulse_v0_1',
        direction,
        scannerWindow:
          this.options.scannerWindow,
        changeSource:
          event.source,
        dataQuality:
          sourceState === 'degraded'
            ? 'degraded'
            : 'ready',
        marketSourceState:
          sourceState,
        currentPrice:
          metric.price,
        priceChangePct:
          metric.priceChangePct,
        volumeRatio:
          metric.volumeAnomaly,
        tradesRatio:
          metric.tradesAnomaly,
        anomalyRatio:
          metric.volumeAnomaly,
        volatilityPct:
          metric.volatilityPct,
        currentQuoteVolume:
          metric.quoteVolume,
        currentTradesCount:
          metric.tradesCount,
        priceChangeThresholdPct:
          this.options.priceChangeThresholdPct,
        volumeAnomalyThreshold:
          this.options.volumeAnomalyThreshold,
        tradesAnomalyThreshold:
          this.options.tradesAnomalyThreshold,
        volatilityThresholdPct:
          this.options.volatilityThresholdPct,
        minimumQuoteVolume:
          this.options.minimumQuoteVolume,
        freshnessMs:
          this.options.freshnessMs,
        windowStartedAt,
        evidenceUpdatedAt:
          occurredAt,
      },
    };
  }

  private publish(
    signal: MarketImpulseSignal,
  ): void {
    this.emittedSignalsCount += 1;
    this.lastEventAt =
      signal.occurredAt;

    for (const listener of this.listeners) {
      try {
        listener({
          ...signal,
          payload: {
            ...signal.payload,
          },
        });
      } catch (error) {
        this.listenerErrorsCount += 1;
        this.lastError =
          error instanceof Error
            ? error.message
            : 'Unable to deliver market impulse signal';
      }
    }
  }

  private recordSourceError(
    error: unknown,
  ): void {
    this.availability = 'error';
    this.sourceErrorsCount += 1;
    this.lastError =
      error instanceof Error
        ? error.message
        : 'Unable to evaluate market impulse';
  }

  private clearEvidenceSnapshot(): void {
    this.lastEvidenceSymbol = null;
    this.lastDirection = null;
    this.lastEvidenceAt = null;
  }
}
