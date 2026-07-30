import {
  buildLevelV2Foundation,
  DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS,
} from './level-v2-foundation.js';
import {
  DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
  LevelV2LifecycleRegistry,
} from './level-v2-lifecycle.js';
import {
  resolveLevelV2LifecycleCollisions,
} from './level-v2-lifecycle-collisions.js';
import {
  buildLevelV2ZonesScore,
  DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
} from './level-v2-zones-score.js';
import {
  cloneLevelV2ShadowEvaluation,
  DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS,
  evaluateLevelV2ShadowComparison,
} from './level-v2-shadow-evaluation.js';
import {
  DEFAULT_LEVEL_V2_SHADOW_HISTORY_OPTIONS,
  LevelV2ShadowHistoryStore,
} from './level-v2-shadow-history.js';
import type {
  LevelV2ShadowHistoryEntry,
  LevelV2ShadowHistoryStatus,
} from './level-v2-shadow-history.types.js';
import type {
  LevelV2Candle,
  LevelV2TouchEvent,
} from './level-v2.types.js';
import type {
  LevelV2LifecycleEvent,
  LevelV2LifecycleObservation,
  LevelV2LifecycleState,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2DetectedZone,
  LevelV2ZoneRejectionCode,
} from './level-v2-zones-score.types.js';
import type {
  SetupDetectionTriggerSource,
} from '../setup-detection-runtime.types.js';
import type {
  LevelV2ShadowRejectionCounts,
  LevelV2ShadowRuntimeOptions,
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowRuntimeSource,
  LevelV2ShadowRuntimeState,
  LevelV2ShadowRuntimeStatus,
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

export const DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS:
LevelV2ShadowRuntimeOptions = {
  maxCandles: 1_000,
  foundationOptions: {
    ...DEFAULT_LEVEL_V2_FOUNDATION_OPTIONS,
  },
  zonesScoreOptions: {
    ...DEFAULT_LEVEL_V2_ZONES_SCORE_OPTIONS,
  },
  lifecycleOptions: {
    ...DEFAULT_LEVEL_V2_LIFECYCLE_OPTIONS,
  },
  historyOptions: {
    ...DEFAULT_LEVEL_V2_SHADOW_HISTORY_OPTIONS,
  },
  evaluationOptions: {
    ...DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS,
    v1DetectorOptions: {
      ...DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS
        .v1DetectorOptions,
    },
  },
  now: () =>
    new Date(),
};

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Level v2 shadow runtime symbol: ${value}`,
    );
  }

  return symbol;
}

function validateOptions(
  options: LevelV2ShadowRuntimeOptions,
): void {
  if (
    !Number.isInteger(options.maxCandles)
    || options.maxCandles <= 0
  ) {
    throw new Error(
      'Level v2 shadow runtime maxCandles must be a positive integer',
    );
  }

  const now =
    options.now();

  if (
    !(now instanceof Date)
    || !Number.isFinite(now.getTime())
  ) {
    throw new Error(
      'Level v2 shadow runtime now must return a valid Date',
    );
  }
}

function cloneTouch(
  touch: LevelV2TouchEvent,
): LevelV2TouchEvent {
  return {
    ...touch,
    extremumIds: [
      ...touch.extremumIds,
    ],
  };
}

function cloneLevel(
  level: LevelV2DetectedZone,
): LevelV2DetectedZone {
  return {
    ...level,
    zone: {
      ...level.zone,
    },
    touches:
      level.touches.map(
        cloneTouch,
      ),
    cleanliness: {
      ...level.cleanliness,
    },
    score: {
      ...level.score,
    },
  };
}

function cloneState(
  state: LevelV2LifecycleState,
): LevelV2LifecycleState {
  return {
    ...state,
    level:
      cloneLevel(
        state.level,
      ),
  };
}

function cloneEvent(
  event: LevelV2LifecycleEvent,
): LevelV2LifecycleEvent {
  return {
    ...event,
  };
}

function cloneSnapshot(
  snapshot: LevelV2ShadowSnapshot,
): LevelV2ShadowSnapshot {
  return {
    ...snapshot,
    rejectionCounts: {
      ...snapshot.rejectionCounts,
    },
    evaluation:
      cloneLevelV2ShadowEvaluation(
        snapshot.evaluation,
      ),
    levels:
      snapshot.levels.map(
        cloneState,
      ),
    lifecycleEvents:
      snapshot.lifecycleEvents.map(
        cloneEvent,
      ),
  };
}

function toLevelV2Candle(
  candle:
    ReturnType<
      LevelV2ShadowRuntimeSource['getKlines']
    >[number],
): LevelV2Candle {
  return {
    openTime:
      candle.openTime,
    closeTime:
      candle.closeTime,
    open:
      candle.open,
    high:
      candle.high,
    low:
      candle.low,
    close:
      candle.close,
    baseVolume:
      null,
    quoteVolume:
      candle.quoteVolume,
    tradesCount:
      candle.tradesCount,
    isClosed:
      candle.isClosed,
  };
}

function toObservation(
  symbol: string,
  candle: LevelV2Candle,
  candleIndex: number,
): LevelV2LifecycleObservation {
  return {
    symbol,
    timeframe:
      '1m',
    candleIndex,
    openTime:
      candle.openTime,
    closeTime:
      candle.closeTime,
    open:
      candle.open,
    high:
      candle.high,
    low:
      candle.low,
    close:
      candle.close,
    isClosed:
      candle.isClosed,
  };
}

function emptyRejectionCounts():
LevelV2ShadowRejectionCounts {
  return {
    insufficientTouches: 0,
    acceptanceZone: 0,
    structureMidrange: 0,
    scoreBelowThreshold: 0,
  };
}

function incrementRejection(
  counts: LevelV2ShadowRejectionCounts,
  reason: LevelV2ZoneRejectionCode,
): void {
  switch (reason) {
    case 'insufficient_touches':
      counts.insufficientTouches += 1;
      return;

    case 'acceptance_zone':
      counts.acceptanceZone += 1;
      return;

    case 'structure_midrange':
      counts.structureMidrange += 1;
      return;

    case 'score_below_threshold':
      counts.scoreBelowThreshold += 1;
      return;
  }
}

export class LevelV2ShadowRuntimeService
implements LevelV2ShadowRuntimeReader {
  private readonly snapshots =
    new Map<
      string,
      LevelV2ShadowSnapshot
    >();

  private readonly historyStore:
    LevelV2ShadowHistoryStore;

  private state:
    LevelV2ShadowRuntimeState =
      'idle';

  private unsubscribe:
    (() => void)
    | null = null;

  private scansCount = 0;
  private failedScans = 0;

  private lastScanAt:
    string | null = null;

  private lastTriggerSource:
    SetupDetectionTriggerSource
    | null = null;

  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      LevelV2ShadowRuntimeSource,

    private readonly options:
      LevelV2ShadowRuntimeOptions =
        DEFAULT_LEVEL_V2_SHADOW_RUNTIME_OPTIONS,
  ) {
    validateOptions(options);

    this.historyStore =
      new LevelV2ShadowHistoryStore(
        options.historyOptions
        ?? DEFAULT_LEVEL_V2_SHADOW_HISTORY_OPTIONS,
      );
  }

  start(): void {
    if (
      this.state === 'running'
    ) {
      return;
    }

    this.state =
      'running';

    this.lastError =
      null;

    this.unsubscribe =
      this.source
        .subscribeKlineChanges(
          (event) => {
            if (
              this.state !== 'running'
            ) {
              return;
            }

            this.processSymbols(
              event.symbols,
              event.source,
            );
          },
        );

    this.processSymbols(
      this.source.getSymbols(),
      'initial',
    );
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe =
      null;

    this.state =
      'stopped';
  }

  getStatus():
  LevelV2ShadowRuntimeStatus {
    const snapshots = [
      ...this.snapshots.values(),
    ];

    return {
      state:
        this.state,
      snapshotsCount:
        snapshots.length,
      levelsCount:
        snapshots.reduce(
          (
            total,
            snapshot,
          ) =>
            total
            + snapshot.levels.length,
          0,
        ),
      eligibleLevelsCount:
        snapshots.reduce(
          (
            total,
            snapshot,
          ) =>
            total
            + snapshot.levels.filter(
              (level) =>
                level.eligibleForSetups,
            ).length,
          0,
        ),
      scansCount:
        this.scansCount,
      failedScans:
        this.failedScans,
      lastScanAt:
        this.lastScanAt,
      lastTriggerSource:
        this.lastTriggerSource,
      lastError:
        this.lastError,
    };
  }

  getSnapshots():
  LevelV2ShadowSnapshot[] {
    return [
      ...this.snapshots.values(),
    ]
      .sort(
        (
          left,
          right,
        ) =>
          left.symbol.localeCompare(
            right.symbol,
          ),
      )
      .map(
        cloneSnapshot,
      );
  }

  getSnapshot(
    symbolValue: string,
  ): LevelV2ShadowSnapshot | null {
    const symbol =
      normalizeSymbol(
        symbolValue,
      );

    const snapshot =
      this.snapshots.get(
        symbol,
      );

    return snapshot
      ? cloneSnapshot(
          snapshot,
        )
      : null;
  }

  getEvaluationHistory(
    symbol?: string,
    limit?: number,
  ):
  LevelV2ShadowHistoryEntry[] {
    return this.historyStore
      .getHistory(
        symbol,
        limit,
      );
  }

  getEvaluationHistoryStatus():
  LevelV2ShadowHistoryStatus {
    return this.historyStore
      .getStatus();
  }

  private processSymbols(
    symbolValues:
      readonly string[],

    triggerSource:
      SetupDetectionTriggerSource,
  ): void {
    this.lastTriggerSource =
      triggerSource;

    const symbols = [
      ...new Set(
        symbolValues.map(
          (value) =>
            value.trim().toUpperCase(),
        ),
      ),
    ];

    for (
      const symbolValue
      of symbols
    ) {
      try {
        const symbol =
          normalizeSymbol(
            symbolValue,
          );

        const snapshot =
          this.scanSymbol(
            symbol,
            triggerSource,
          );

        this.snapshots.set(
          symbol,
          cloneSnapshot(
            snapshot,
          ),
        );

        this.historyStore.record(
          snapshot,
        );

        this.scansCount += 1;
        this.lastScanAt =
          snapshot.generatedAt;
        this.lastError =
          null;
      } catch (error) {
        this.failedScans += 1;
        this.lastError =
          error instanceof Error
            ? error.message
            : String(error);
      }
    }
  }

  private scanSymbol(
    symbol: string,
    triggerSource:
      SetupDetectionTriggerSource,
  ): LevelV2ShadowSnapshot {
    const sourceKlines =
      this.source.getKlines(
        symbol,
        this.options.maxCandles,
      );

    const candles =
      sourceKlines.map(
        toLevelV2Candle,
      );

    const foundation =
      buildLevelV2Foundation(
        symbol,
        '1m',
        candles,
        this.options
          .foundationOptions,
      );

    const zones =
      buildLevelV2ZonesScore(
        symbol,
        '1m',
        candles,
        foundation,
        this.options
          .zonesScoreOptions,
      );

    const closedCandles =
      candles.filter(
        (candle) =>
          candle.isClosed,
      );

    const lifecycleStates:
      LevelV2LifecycleState[] = [];

    const lifecycleEvents:
      LevelV2LifecycleEvent[] = [];

    for (
      const level
      of zones.levels
    ) {
      const registry =
        new LevelV2LifecycleRegistry(
          this.options
            .lifecycleOptions,
        );

      registry.register(
        level,
        level.lastTouchCandleIndex,
        level.lastTouchAt,
      );

      for (
        let candleIndex =
          level.lastTouchCandleIndex + 1;
        candleIndex
          < closedCandles.length;
        candleIndex += 1
      ) {
        const candle =
          closedCandles[
            candleIndex
          ];

        if (!candle) {
          continue;
        }

        registry.observe(
          level.id,
          toObservation(
            symbol,
            candle,
            candleIndex,
          ),
        );
      }

      const state =
        registry.get(
          level.id,
        );

      if (state) {
        lifecycleStates.push(
          state,
        );
      }

      lifecycleEvents.push(
        ...registry.events(
          level.id,
        ),
      );
    }

    const rejectionCounts =
      emptyRejectionCounts();

    for (
      const rejected
      of zones.rejected
    ) {
      for (
        const reason
        of rejected.reasons
      ) {
        incrementRejection(
          rejectionCounts,
          reason,
        );
      }
    }

    const sortedLifecycleStates =
      resolveLevelV2LifecycleCollisions(
        lifecycleStates,
      ).sort(
        (
          left,
          right,
        ) =>
          right.level.score.total
          - left.level.score.total
          || right.level
            .lastTouchCandleIndex
          - left.level
            .lastTouchCandleIndex,
      );

    const evaluation =
      evaluateLevelV2ShadowComparison(
        symbol,
        '1m',
        candles,
        sortedLifecycleStates.map(
          (state) => ({
            id:
              state.level.id,
            symbol:
              state.level.symbol,
            timeframe:
              state.level.timeframe,
            kind:
              state.currentKind,
            referencePrice:
              state.level.zone
                .referencePrice,
            zoneLow:
              state.level.zone
                .outerLow,
            zoneHigh:
              state.level.zone
                .outerHigh,
            touchesCount:
              state.level
                .touchesCount,
            status:
              state.status,
            eligibleForSetups:
              state
                .eligibleForSetups,
            score:
              state.level.score.total,
          }),
        ),
        this.options
          .evaluationOptions
        ?? DEFAULT_LEVEL_V2_SHADOW_EVALUATION_OPTIONS,
      );

    const generatedAt =
      this.readNow()
        .toISOString();

    return {
      symbol,
      timeframe:
        '1m',
      generatedAt,
      triggerSource,
      sourceCandlesCount:
        candles.length,
      closedCandlesCount:
        closedCandles.length,
      detectedZonesCount:
        zones.levels.length,
      rejectedZonesCount:
        zones.rejected.length,
      rejectionCounts,
      evaluation,
      levels:
        sortedLifecycleStates,
      lifecycleEvents:
        lifecycleEvents.sort(
          (
            left,
            right,
          ) =>
            left.candleIndex
            - right.candleIndex
            || left.sequence
            - right.sequence,
        ),
    };
  }

  private readNow():
  Date {
    const now =
      this.options.now();

    if (
      !(now instanceof Date)
      || !Number.isFinite(
        now.getTime(),
      )
    ) {
      throw new Error(
        'Level v2 shadow runtime now must return a valid Date',
      );
    }

    return now;
  }
}
