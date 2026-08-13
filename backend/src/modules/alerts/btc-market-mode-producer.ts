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
  isMarketScannerWindowId,
  type MarketScannerWindowId,
} from '../realtime-market-data/scanner-windows.js';
import type {
  AlertParameters,
} from './alerts.types.js';
import type {
  BtcMarketMode,
  BtcMarketModeChange,
  BtcMarketModeChangeListener,
  BtcMarketModeSourceContract,
} from './btc-market-mode-alert-event-source.js';

export interface BtcMarketModeMetricsSource {
  subscribeKlineChanges(
    listener: MarketWideKlineChangeListener,
  ): () => void;

  getMetrics(
    symbol?: string,
    scannerWindow?: MarketScannerWindowId,
  ): MarketScannerMetrics[];

  getStatus(): MarketWideRealtimeStatus;
}

export interface BtcMarketModeProducerOptions {
  scannerWindow: MarketScannerWindowId;
  btcSymbol: string;
  minimumMarketSymbols: number;
  freshnessMs: number;
  maximumFutureSkewMs: number;
  btcMoveThresholdPct: number;
  directionalBreadthThresholdPct: number;
  now: () => Date;
}

export type BtcMarketModeAvailability =
  | 'idle'
  | 'collecting'
  | 'ready'
  | 'degraded'
  | 'unavailable'
  | 'stale'
  | 'error';

export interface BtcMarketModeProducerStatus {
  state: 'idle' | 'subscribed';
  availability: BtcMarketModeAvailability;
  scannerWindow: MarketScannerWindowId;
  sourceState: MarketWideRealtimeState | null;
  currentMode: BtcMarketMode | null;
  ignoredKlineChangesCount: number;
  evaluationsCount: number;
  historicalEvaluationsCount: number;
  baselineSnapshotsCount: number;
  silentHistoricalChangesCount: number;
  duplicateSnapshotsCount: number;
  emittedChangesCount: number;
  unavailableSnapshotsCount: number;
  insufficientSnapshotsCount: number;
  staleSnapshotsCount: number;
  sourceErrorsCount: number;
  listenerErrorsCount: number;
  totalMarketSymbolsCount: number;
  usableMarketSymbolsCount: number;
  btcPriceChangePct: number | null;
  advancingSymbolsPct: number | null;
  decliningSymbolsPct: number | null;
  lastEvidenceAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
}

export interface BtcMarketModeCurrentSnapshot {
  readonly availability:
    BtcMarketModeAvailability;
  readonly scannerWindow:
    MarketScannerWindowId;
  readonly mode:
    BtcMarketMode | null;
  readonly observedAt: string | null;
}

interface TimedMetric {
  metric: MarketScannerMetrics;
  timestampMs: number;
}

interface BtcMarketModeEvidence {
  mode: BtcMarketMode;
  occurredAt: string;
  payload: AlertParameters;
  totalMarketSymbolsCount: number;
  usableMarketSymbolsCount: number;
  btcPriceChangePct: number;
  advancingSymbolsPct: number;
  decliningSymbolsPct: number;
}

export const DEFAULT_BTC_MARKET_MODE_PRODUCER_OPTIONS:
BtcMarketModeProducerOptions = {
  scannerWindow: '5m',
  btcSymbol: 'BTCUSDT',
  minimumMarketSymbols: 20,
  freshnessMs: 90_000,
  maximumFutureSkewMs: 5_000,
  btcMoveThresholdPct: 0.15,
  directionalBreadthThresholdPct: 60,
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
      `Invalid BTC market mode symbol: ${value}`,
    );
  }

  return symbol;
}

function validateOptions(
  options: BtcMarketModeProducerOptions,
): void {
  if (
    !isMarketScannerWindowId(
      options.scannerWindow,
    )
  ) {
    throw new Error(
      `Invalid BTC market mode scannerWindow: ${options.scannerWindow}`,
    );
  }

  if (
    !Number.isSafeInteger(
      options.minimumMarketSymbols,
    )
    || options.minimumMarketSymbols < 1
  ) {
    throw new Error(
      'minimumMarketSymbols must be a positive integer',
    );
  }

  if (
    !Number.isSafeInteger(
      options.freshnessMs,
    )
    || options.freshnessMs < 1_000
  ) {
    throw new Error(
      'freshnessMs must be an integer greater than or equal to 1000',
    );
  }

  if (
    !Number.isSafeInteger(
      options.maximumFutureSkewMs,
    )
    || options.maximumFutureSkewMs < 0
  ) {
    throw new Error(
      'maximumFutureSkewMs must be a non-negative integer',
    );
  }

  if (
    !Number.isFinite(
      options.btcMoveThresholdPct,
    )
    || options.btcMoveThresholdPct <= 0
  ) {
    throw new Error(
      'btcMoveThresholdPct must be greater than zero',
    );
  }

  if (
    !Number.isFinite(
      options.directionalBreadthThresholdPct,
    )
    || options.directionalBreadthThresholdPct <= 50
    || options.directionalBreadthThresholdPct > 100
  ) {
    throw new Error(
      'directionalBreadthThresholdPct must be greater than 50 and at most 100',
    );
  }

  normalizeSymbol(
    options.btcSymbol,
  );

  if (typeof options.now !== 'function') {
    throw new Error(
      'BTC market mode now must be a function',
    );
  }
}

function round(
  value: number,
  digits = 6,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function isMetricUsable(
  metric: MarketScannerMetrics,
): metric is MarketScannerMetrics & {
  priceChangePct: number;
  updatedAt: string;
} {
  return (
    Number.isFinite(
      metric.priceChangePct,
    )
    && typeof metric.updatedAt === 'string'
    && Number.isFinite(
      Date.parse(metric.updatedAt),
    )
  );
}

function isMetricFresh(
  metric: TimedMetric,
  nowMs: number,
  options: BtcMarketModeProducerOptions,
): boolean {
  const ageMs =
    nowMs - metric.timestampMs;

  return (
    ageMs <= options.freshnessMs
    && ageMs >= -options.maximumFutureSkewMs
  );
}

function classifyMode(
  btcPriceChangePct: number,
  advancingSymbolsPct: number,
  decliningSymbolsPct: number,
  options: BtcMarketModeProducerOptions,
): BtcMarketMode {
  if (
    btcPriceChangePct
      >= options.btcMoveThresholdPct
    && advancingSymbolsPct
      >= options.directionalBreadthThresholdPct
  ) {
    return 'risk_on';
  }

  if (
    btcPriceChangePct
      <= -options.btcMoveThresholdPct
    && decliningSymbolsPct
      >= options.directionalBreadthThresholdPct
  ) {
    return 'risk_off';
  }

  return 'neutral';
}

export class BtcMarketModeProducer
implements BtcMarketModeSourceContract {
  private readonly options:
    BtcMarketModeProducerOptions;

  private readonly listeners =
    new Set<BtcMarketModeChangeListener>();

  private unsubscribeSource:
    (() => void) | null = null;

  private availability:
    BtcMarketModeAvailability = 'idle';

  private sourceState:
    MarketWideRealtimeState | null = null;

  private currentMode:
    BtcMarketMode | null = null;

  private ignoredKlineChangesCount = 0;
  private evaluationsCount = 0;
  private historicalEvaluationsCount = 0;
  private baselineSnapshotsCount = 0;
  private silentHistoricalChangesCount = 0;
  private duplicateSnapshotsCount = 0;
  private emittedChangesCount = 0;
  private unavailableSnapshotsCount = 0;
  private insufficientSnapshotsCount = 0;
  private staleSnapshotsCount = 0;
  private sourceErrorsCount = 0;
  private listenerErrorsCount = 0;
  private totalMarketSymbolsCount = 0;
  private usableMarketSymbolsCount = 0;
  private btcPriceChangePct:
    number | null = null;
  private advancingSymbolsPct:
    number | null = null;
  private decliningSymbolsPct:
    number | null = null;
  private lastEvidenceAt:
    string | null = null;
  private lastEventAt:
    string | null = null;
  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      BtcMarketModeMetricsSource,
    options:
      Partial<
        BtcMarketModeProducerOptions
      > = {},
  ) {
    this.options = {
      ...DEFAULT_BTC_MARKET_MODE_PRODUCER_OPTIONS,
      ...options,
    };

    validateOptions(this.options);
  }

  subscribeBtcMarketModeChanges(
    listener: BtcMarketModeChangeListener,
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
        this.currentMode = null;
        this.clearEvidenceSnapshot();
      }
    };
  }

  getStatus():
  BtcMarketModeProducerStatus {
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
      currentMode:
        this.currentMode,
      ignoredKlineChangesCount:
        this.ignoredKlineChangesCount,
      evaluationsCount:
        this.evaluationsCount,
      historicalEvaluationsCount:
        this.historicalEvaluationsCount,
      baselineSnapshotsCount:
        this.baselineSnapshotsCount,
      silentHistoricalChangesCount:
        this.silentHistoricalChangesCount,
      duplicateSnapshotsCount:
        this.duplicateSnapshotsCount,
      emittedChangesCount:
        this.emittedChangesCount,
      unavailableSnapshotsCount:
        this.unavailableSnapshotsCount,
      insufficientSnapshotsCount:
        this.insufficientSnapshotsCount,
      staleSnapshotsCount:
        this.staleSnapshotsCount,
      sourceErrorsCount:
        this.sourceErrorsCount,
      listenerErrorsCount:
        this.listenerErrorsCount,
      totalMarketSymbolsCount:
        this.totalMarketSymbolsCount,
      usableMarketSymbolsCount:
        this.usableMarketSymbolsCount,
      btcPriceChangePct:
        this.btcPriceChangePct,
      advancingSymbolsPct:
        this.advancingSymbolsPct,
      decliningSymbolsPct:
        this.decliningSymbolsPct,
      lastEvidenceAt:
        this.lastEvidenceAt,
      lastEventAt:
        this.lastEventAt,
      lastError:
        this.lastError,
    };
  }

  getCurrentSnapshot():
  BtcMarketModeCurrentSnapshot {
    const observedAt =
      this.lastEvidenceAt;
    const observedAtMs =
      Date.parse(observedAt ?? '');
    const nowMs =
      this.options.now().getTime();
    const ageMs =
      nowMs - observedAtMs;
    const fresh =
      Number.isFinite(nowMs)
      && Number.isFinite(observedAtMs)
      && ageMs <= this.options.freshnessMs
      && ageMs
        >= -this.options.maximumFutureSkewMs;
    const availability =
      (
        this.availability === 'ready'
        || this.availability === 'degraded'
      )
      && !fresh
        ? 'stale'
        : this.availability;

    return Object.freeze({
      availability,
      scannerWindow:
        this.options.scannerWindow,
      mode:
        this.currentMode,
      observedAt,
    });
  }

  private evaluate(
    event: MarketWideKlineChange,
  ): void {
    const btcSymbol =
      normalizeSymbol(
        this.options.btcSymbol,
      );

    const hasBtcChange =
      event.symbols.some(
        (symbol) =>
          symbol.trim().toUpperCase()
            === btcSymbol,
      );

    if (!hasBtcChange) {
      this.ignoredKlineChangesCount += 1;
      return;
    }

    this.evaluationsCount += 1;

    if (event.source === 'history') {
      this.historicalEvaluationsCount += 1;
    }

    try {
      const now =
        this.options.now();

      const nowMs =
        now.getTime();

      if (!Number.isFinite(nowMs)) {
        throw new Error(
          'BTC market mode clock returned an invalid date',
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
        this.unavailableSnapshotsCount += 1;
        this.clearEvidenceSnapshot();
        return;
      }

      const evidence =
        this.readEvidence(
          event,
          nowMs,
          sourceStatus.state,
        );

      if (!evidence) {
        return;
      }

      this.totalMarketSymbolsCount =
        evidence.totalMarketSymbolsCount;
      this.usableMarketSymbolsCount =
        evidence.usableMarketSymbolsCount;
      this.btcPriceChangePct =
        evidence.btcPriceChangePct;
      this.advancingSymbolsPct =
        evidence.advancingSymbolsPct;
      this.decliningSymbolsPct =
        evidence.decliningSymbolsPct;
      this.lastEvidenceAt =
        evidence.occurredAt;
      this.lastError = null;

      if (this.currentMode === null) {
        this.currentMode = evidence.mode;
        this.baselineSnapshotsCount += 1;
        return;
      }

      if (this.currentMode === evidence.mode) {
        this.duplicateSnapshotsCount += 1;
        return;
      }

      if (event.source === 'history') {
        this.currentMode = evidence.mode;
        this.silentHistoricalChangesCount += 1;
        return;
      }

      const previousMode =
        this.currentMode;

      this.currentMode = evidence.mode;

      this.publish({
        sourceEventId: [
          'btc-market-mode',
          this.options.scannerWindow,
          evidence.occurredAt,
          previousMode,
          evidence.mode,
        ].join(':'),
        occurredAt:
          evidence.occurredAt,
        timeframe:
          this.options.scannerWindow,
        mode:
          evidence.mode,
        previousMode,
        payload:
          evidence.payload,
      });
    } catch (error) {
      this.recordSourceError(error);
    }
  }

  private readEvidence(
    event: MarketWideKlineChange,
    nowMs: number,
    sourceState:
      'connected' | 'degraded',
  ): BtcMarketModeEvidence | null {
    const metrics =
      this.source.getMetrics(
        undefined,
        this.options.scannerWindow,
      );

    const bySymbol =
      new Map<string, MarketScannerMetrics>();

    for (const metric of metrics) {
      if (
        metric.scannerWindow
          !== this.options.scannerWindow
      ) {
        throw new Error(
          `BTC market mode source returned ${metric.scannerWindow} metrics for ${this.options.scannerWindow}`,
        );
      }

      const symbol =
        normalizeSymbol(metric.symbol);

      const existing =
        bySymbol.get(symbol);

      const timestampMs =
        Date.parse(
          metric.updatedAt ?? '',
        );

      const existingTimestampMs =
        Date.parse(
          existing?.updatedAt ?? '',
        );

      if (
        !existing
        || (
          Number.isFinite(timestampMs)
          && (
            !Number.isFinite(
              existingTimestampMs,
            )
            || timestampMs
              >= existingTimestampMs
          )
        )
      ) {
        bySymbol.set(
          symbol,
          metric,
        );
      }
    }

    const btcSymbol =
      normalizeSymbol(
        this.options.btcSymbol,
      );

    const btcMetric =
      bySymbol.get(btcSymbol);

    const marketMetrics =
      [...bySymbol.entries()]
        .filter(
          ([symbol]) =>
            symbol !== btcSymbol,
        )
        .map(
          ([, metric]) => metric,
        );

    this.totalMarketSymbolsCount =
      marketMetrics.length;

    const usableMarketMetrics:
      TimedMetric[] =
      marketMetrics
        .filter(isMetricUsable)
        .map((metric) => ({
          metric,
          timestampMs:
            Date.parse(metric.updatedAt),
        }));

    if (
      !btcMetric
      || !isMetricUsable(btcMetric)
      || usableMarketMetrics.length
        < this.options.minimumMarketSymbols
    ) {
      this.availability = 'collecting';
      this.insufficientSnapshotsCount += 1;
      this.usableMarketSymbolsCount =
        usableMarketMetrics.length;
      this.btcPriceChangePct = null;
      this.advancingSymbolsPct = null;
      this.decliningSymbolsPct = null;
      this.lastEvidenceAt = null;
      return null;
    }

    const timedBtcMetric:
      TimedMetric = {
        metric: btcMetric,
        timestampMs:
          Date.parse(btcMetric.updatedAt),
      };

    const freshMarketMetrics =
      usableMarketMetrics.filter(
        (metric) =>
          isMetricFresh(
            metric,
            nowMs,
            this.options,
          ),
      );

    if (
      !isMetricFresh(
        timedBtcMetric,
        nowMs,
        this.options,
      )
      || freshMarketMetrics.length
        < this.options.minimumMarketSymbols
    ) {
      this.availability = 'stale';
      this.staleSnapshotsCount += 1;
      this.usableMarketSymbolsCount =
        freshMarketMetrics.length;
      this.btcPriceChangePct = null;
      this.advancingSymbolsPct = null;
      this.decliningSymbolsPct = null;
      this.lastEvidenceAt = null;
      return null;
    }

    const advancingSymbolsCount =
      freshMarketMetrics.filter(
        ({ metric }) =>
          (metric.priceChangePct ?? 0) > 0,
      ).length;

    const decliningSymbolsCount =
      freshMarketMetrics.filter(
        ({ metric }) =>
          (metric.priceChangePct ?? 0) < 0,
      ).length;

    const unchangedSymbolsCount =
      freshMarketMetrics.length
      - advancingSymbolsCount
      - decliningSymbolsCount;

    const advancingSymbolsPct =
      round(
        advancingSymbolsCount
        / freshMarketMetrics.length
        * 100,
      );

    const decliningSymbolsPct =
      round(
        decliningSymbolsCount
        / freshMarketMetrics.length
        * 100,
      );

    const btcPriceChangePct =
      round(
        btcMetric.priceChangePct,
      );

    const evidenceTimestampMs =
      Math.max(
        timedBtcMetric.timestampMs,
        ...freshMarketMetrics.map(
          (metric) =>
            metric.timestampMs,
        ),
      );

    const occurredAt =
      new Date(
        evidenceTimestampMs,
      ).toISOString();

    const mode =
      classifyMode(
        btcPriceChangePct,
        advancingSymbolsPct,
        decliningSymbolsPct,
        this.options,
      );

    this.availability =
      sourceState === 'degraded'
        ? 'degraded'
        : 'ready';

    return {
      mode,
      occurredAt,
      totalMarketSymbolsCount:
        marketMetrics.length,
      usableMarketSymbolsCount:
        freshMarketMetrics.length,
      btcPriceChangePct,
      advancingSymbolsPct,
      decliningSymbolsPct,
      payload: {
        signal: 'btc_market_mode',
        methodVersion:
          'btc_market_mode_v0_1',
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
        btcPriceChangePct,
        advancingSymbolsCount,
        decliningSymbolsCount,
        unchangedSymbolsCount,
        advancingSymbolsPct,
        decliningSymbolsPct,
        usableMarketSymbolsCount:
          freshMarketMetrics.length,
        totalMarketSymbolsCount:
          marketMetrics.length,
        btcMoveThresholdPct:
          this.options.btcMoveThresholdPct,
        directionalBreadthThresholdPct:
          this.options.directionalBreadthThresholdPct,
        freshnessMs:
          this.options.freshnessMs,
        evidenceUpdatedAt:
          occurredAt,
      },
    };
  }

  private publish(
    event: BtcMarketModeChange,
  ): void {
    this.emittedChangesCount += 1;
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
            : 'Unable to deliver BTC market mode change';
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
        : 'Unable to evaluate BTC market mode';
  }

  private clearEvidenceSnapshot(): void {
    this.totalMarketSymbolsCount = 0;
    this.usableMarketSymbolsCount = 0;
    this.btcPriceChangePct = null;
    this.advancingSymbolsPct = null;
    this.decliningSymbolsPct = null;
    this.lastEvidenceAt = null;
  }
}
