import {
  DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
  SetupDetectionPipeline,
} from './setup-detection-pipeline.js';
import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  RealtimeConfirmationEvidenceReaderOptions,
} from '../level-engine/realtime-confirmation-evidence.js';
import type {
  SetupCausalContext,
  SetupCausalUpdate,
} from './causal-setup-adapter.types.js';
import {
  advanceSetupEngineState,
} from './setup-engine.js';
import type {
  SetupEngineStage,
  SetupEngineState,
} from './setup-engine.types.js';
import type {
  SetupLifecycleEvent,
  SetupLifecycleEventListener,
  SetupLifecycleEventType,
} from './setup-lifecycle-events.types.js';
import {
  DEFAULT_SETUP_STAGE_EVALUATOR_OPTIONS,
  evaluateSetupStage,
} from './setup-stage-evaluator.js';
import type {
  SetupStageEvaluatorOptions,
  SetupStageMarketObservation,
} from './setup-stage-evaluator.types.js';
import type {
  SetupDetectionRuntimeOptions,
  SetupDetectionRuntimeSource,
  SetupDetectionRuntimeState,
  SetupDetectionRuntimeStatus,
  SetupDetectionTriggerSource,
} from './setup-detection-runtime.types.js';
import {
  SETUP_ENGINE_RUNTIME_TIMEFRAMES,
} from './setup-engine-multi-timeframe-runtime.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const TERMINAL_STAGES:
readonly SetupEngineStage[] = [
  'BREAKOUT_CONFIRMED',
  'REJECTION_CONFIRMED',
  'SETUP_EXPIRED',
];

export const DEFAULT_SETUP_DETECTION_RUNTIME_OPTIONS:
SetupDetectionRuntimeOptions = {
  maxCandidates: 10_000,

  pipelineOptions: {
    maxCandles:
      DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS
        .maxCandles,

    levelLinesOptions: {
      ...DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS
        .levelLinesOptions,
    },

    candidateOptions: {
      ...DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS
        .candidateOptions,
    },

    setupTypes: [
      ...DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS
        .setupTypes,
    ],
  },

  stageEvaluatorOptions: {
    ...DEFAULT_SETUP_STAGE_EVALUATOR_OPTIONS,
  },

  now: () =>
    new Date(),

  timeframes: [
    ...SETUP_ENGINE_RUNTIME_TIMEFRAMES,
  ],
};

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (
    !SYMBOL_PATTERN.test(
      symbol,
    )
  ) {
    throw new Error(
      `Invalid Setup Detection Runtime symbol: ${value}`,
    );
  }

  return symbol;
}

function cloneCandidate(
  candidate:
    SetupEngineState,
): SetupEngineState {
  return {
    ...candidate,
    level: {
      ...candidate.level,
    },
    ...(candidate.episode
      ? {
          episode: {
            ...candidate.episode,
          },
        }
      : {}),
    ...(candidate.causal
      ? {
          causal: {
            ...candidate.causal,
            realtimeConfirmationReasons: [
              ...candidate.causal
                .realtimeConfirmationReasons,
            ],
          },
        }
      : {}),
  };
}

function cloneCausalContext(
  context: SetupCausalContext,
): SetupCausalContext {
  return {
    ...context,
    realtimeConfirmationReasons: [
      ...context
        .realtimeConfirmationReasons,
    ],
  };
}

function causalStageRank(
  context: SetupCausalContext,
): number {
  switch (context.stage) {
    case 'LEVEL_CONFIRMED':
      return 0;
    case 'OBSERVATION':
      return 1;
    case 'APPROACH':
      return 2;
    case 'CONFIRMATION':
      return 3;
  }
}

function timestampValue(
  value: string,
): number {
  const timestamp =
    Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : Number.NEGATIVE_INFINITY;
}

function readTimestamp(
  value: string,
  name: string,
): number {
  const timestamp =
    Date.parse(value);

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    throw new Error(
      `Setup Detection Runtime ${name} must be a valid ISO date`,
    );
  }

  return timestamp;
}

function isTerminalStage(
  stage:
    SetupEngineStage,
): boolean {
  return TERMINAL_STAGES.includes(
    stage,
  );
}

type SetupLifecycleEventInput =
  Omit<
    SetupLifecycleEvent,
    'eventId'
  >;

function cloneLifecycleEvent(
  event:
    SetupLifecycleEvent,
): SetupLifecycleEvent {
  return {
    ...event,
    candidate:
      cloneCandidate(
        event.candidate,
      ),
  };
}

function lifecycleEventTypeForStage(
  stage:
    SetupEngineStage,
):
  Exclude<
    SetupLifecycleEventType,
    'candidate_created'
  > {
  switch (stage) {
    case 'BREAKOUT_CONFIRMED':
      return 'breakout_confirmed';

    case 'REJECTION_CONFIRMED':
      return 'rejection_confirmed';

    case 'SETUP_EXPIRED':
      return 'setup_expired';

    default:
      return 'stage_transition';
  }
}

export class SetupDetectionRuntimeService {
  private readonly pipelines:
    ReadonlyMap<
      LevelEngineTimeframe,
      SetupDetectionPipeline
    >;

  private readonly timeframes:
    readonly LevelEngineTimeframe[];

  private readonly stageEvaluatorOptions:
    SetupStageEvaluatorOptions;

  private readonly candidates =
    new Map<
      string,
      SetupEngineState
    >();

  private readonly lastScannedClosedCandle =
    new Map<string, string | null>();

  private readonly lifecycleListeners =
    new Set<
      SetupLifecycleEventListener
    >();

  private nextLifecycleEventId = 1;

  private state:
    SetupDetectionRuntimeState =
      'idle';

  private unsubscribe:
    (() => void)
    | null = null;

  private scansCount = 0;
  private failedScans = 0;

  private evaluationsCount = 0;
  private failedEvaluations = 0;
  private stageTransitionsCount = 0;

  private lastScanAt:
    string | null = null;

  private lastEvaluationAt:
    string | null = null;

  private lastTransitionAt:
    string | null = null;

  private lastTriggerSource:
    SetupDetectionTriggerSource
    | null = null;

  private lastError:
    string | null = null;

  constructor(
    private readonly source:
      SetupDetectionRuntimeSource,

    private readonly options:
      SetupDetectionRuntimeOptions =
        DEFAULT_SETUP_DETECTION_RUNTIME_OPTIONS,

    realtimeEvidenceReaders:
      RealtimeConfirmationEvidenceReaderOptions = {},
  ) {
    if (
      !Number.isInteger(
        options.maxCandidates,
      )
      || options.maxCandidates <= 0
    ) {
      throw new Error(
        'Setup Detection Runtime maxCandidates must be a positive integer',
      );
    }

    this.stageEvaluatorOptions = {
      ...(
        options.stageEvaluatorOptions
        ?? DEFAULT_SETUP_STAGE_EVALUATOR_OPTIONS
      ),
    };

    const requestedTimeframes:
      readonly LevelEngineTimeframe[] =
        options
          === DEFAULT_SETUP_DETECTION_RUNTIME_OPTIONS
        && !source.getSetupCandles
          ? ['1m']
          : options.timeframes
            ?? ['1m'];

    this.timeframes =
      Object.freeze([
        ...new Set<
          LevelEngineTimeframe
        >(
          requestedTimeframes,
        ),
      ]);

    if (this.timeframes.length === 0) {
      throw new Error(
        'Setup Detection Runtime requires at least one timeframe',
      );
    }

    if (
      this.timeframes.some(
        (timeframe) =>
          timeframe !== '1m',
      )
      && !source.getSetupCandles
    ) {
      throw new Error(
        'Setup Detection Runtime multi-timeframe source must provide getSetupCandles',
      );
    }

    this.pipelines =
      new Map(
        this.timeframes.map(
          (timeframe) => [
            timeframe,
            new SetupDetectionPipeline(
              source,
              options.pipelineOptions,
              {
                realtimeEvidenceReaders,
                now: options.now,
                timeframe,
              },
            ),
          ],
        ),
      );

    this.readNow();
  }

  start(): void {
    if (
      this.state === 'running'
    ) {
      return;
    }

    this.state = 'running';
    this.lastError = null;

    this.unsubscribe =
      this.source
        .subscribeKlineChanges(
          (event) => {
            if (
              this.state
              !== 'running'
            ) {
              return;
            }

            if (
              event.source
              === 'history'
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
    this.unsubscribe = null;

    this.state = 'stopped';
  }

  restoreCandidates(
    candidates:
      readonly SetupEngineState[],
  ): void {
    if (
      this.state === 'running'
    ) {
      throw new Error(
        'Setup Detection Runtime candidates can only be restored before runtime start',
      );
    }

    const now =
      this.readNow();

    const nowMs =
      now.getTime();

    for (
      const sourceCandidate
      of candidates
    ) {
      if (
        isTerminalStage(
          sourceCandidate.stage,
        )
      ) {
        continue;
      }

      const updatedAtMs =
        readTimestamp(
          sourceCandidate.updatedAt,
          'restored candidate updatedAt',
        );

      const expiresAtMs =
        readTimestamp(
          sourceCandidate.expiresAt,
          'restored candidate expiresAt',
        );

      const existing =
        this.candidates.get(
          sourceCandidate.id,
        );

      if (
        existing
        && timestampValue(
          existing.updatedAt,
        ) >= updatedAtMs
      ) {
        continue;
      }

      const restored =
        cloneCandidate(
          sourceCandidate,
        );

      if (
        expiresAtMs > nowMs
      ) {
        this.candidates.set(
          restored.id,
          restored,
        );

        continue;
      }

      const occurredAt =
        restored.expiresAt;

      this.evaluationsCount += 1;

      this.lastEvaluationAt =
        occurredAt;

      try {
        const expired =
          advanceSetupEngineState(
            restored,
            {
              type:
                'EXPIRED',

              occurredAt,
            },
          );

        this.candidates.set(
          expired.id,
          cloneCandidate(
            expired,
          ),
        );

        this.stageTransitionsCount +=
          1;

        this.lastTransitionAt =
          expired.updatedAt;

        this.emitStageTransition(
          restored,
          expired,
        );
      } catch (error) {
        this.failedEvaluations += 1;

        this.lastError =
          error instanceof Error
            ? `${restored.id}: ${error.message}`
            : `${restored.id}: Setup restart expiration failed`;
      }
    }

    this.enforceCandidateLimit();
  }

  subscribeLifecycleEvents(
    listener:
      SetupLifecycleEventListener,
  ): () => void {
    this.lifecycleListeners.add(
      listener,
    );

    let subscribed = true;

    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;

      this.lifecycleListeners.delete(
        listener,
      );
    };
  }

  getStatus():
  SetupDetectionRuntimeStatus {
    this.expireCandidates();

    return {
      state:
        this.state,

      candidatesCount:
        this.candidates.size,

      scansCount:
        this.scansCount,

      failedScans:
        this.failedScans,

      evaluationsCount:
        this.evaluationsCount,

      failedEvaluations:
        this.failedEvaluations,

      stageTransitionsCount:
        this.stageTransitionsCount,

      lastScanAt:
        this.lastScanAt,

      lastEvaluationAt:
        this.lastEvaluationAt,

      lastTransitionAt:
        this.lastTransitionAt,

      lastTriggerSource:
        this.lastTriggerSource,

      lastError:
        this.lastError,

      timeframes:
        [...this.timeframes],
    };
  }

  getCandidates(
    symbolValue?: string,
  ): SetupEngineState[] {
    this.expireCandidates();

    const symbol =
      symbolValue === undefined
        ? null
        : normalizeSymbol(
            symbolValue,
          );

    return [
      ...this.candidates
        .values(),
    ]
      .filter(
        (candidate) =>
          symbol === null
          || candidate.symbol
            === symbol,
      )
      .sort(
        (
          left,
          right,
        ) => {
          const timeDifference =
            timestampValue(
              right.updatedAt,
            )
            - timestampValue(
                left.updatedAt,
              );

          return timeDifference !== 0
            ? timeDifference
            : left.id.localeCompare(
                right.id,
              );
        },
      )
      .map(
        cloneCandidate,
      );
  }

  getCandidate(
    candidateIdValue: string,
  ): SetupEngineState | null {
    this.expireCandidates();

    const candidateId =
      candidateIdValue.trim();

    if (
      candidateId.length === 0
    ) {
      throw new Error(
        'Setup Detection Runtime candidate id cannot be empty',
      );
    }

    const candidate =
      this.candidates.get(
        candidateId,
      );

    return candidate
      ? cloneCandidate(
          candidate,
        )
      : null;
  }

  private processSymbols(
    symbolValues:
      readonly string[],

    triggerSource:
      SetupDetectionTriggerSource,
  ): void {
    const symbols = [
      ...new Set(
        symbolValues,
      ),
    ];

    this.lastTriggerSource =
      triggerSource;

    this.expireCandidates();

    for (
      const symbol
      of symbols
    ) {
      this.evaluateSymbolCandidates(
        symbol,
      );

      this.scanSymbol(
        symbol,
      );
    }

    this.expireCandidates();
  }

  private evaluateSymbolCandidates(
    symbolValue: string,
  ): void {
    const comparableSymbol =
      symbolValue
        .trim()
        .toUpperCase();

    const candidateIds = [
      ...this.candidates
        .values(),
    ]
      .filter(
        (candidate) =>
          candidate.symbol
            === comparableSymbol
          && !isTerminalStage(
            candidate.stage,
          ),
      )
      .map(
        (candidate) =>
          candidate.id,
      );

    if (
      candidateIds.length === 0
    ) {
      return;
    }

    let symbol: string;

    try {
      symbol =
        normalizeSymbol(
          symbolValue,
        );
    } catch (error) {
      this.recordEvaluationBatchFailure(
        candidateIds.length,
        comparableSymbol,
        error,
      );

      return;
    }

    const evaluatedAt =
      this.readNow()
        .toISOString();

    const observations =
      new Map<
        string,
        SetupStageMarketObservation
        | null
      >();

    for (
      const candidateId
      of candidateIds
    ) {
      const candidate =
        this.candidates.get(
          candidateId,
        );

      if (
        !candidate
        || isTerminalStage(
          candidate.stage,
        )
      ) {
        continue;
      }

      let observation =
        observations.get(
          candidate.timeframe,
        );

      if (
        !observations.has(
          candidate.timeframe,
        )
      ) {
        try {
          observation =
            this.buildObservation(
              symbol,
              candidate.timeframe as
                LevelEngineTimeframe,
              evaluatedAt,
            );

          observations.set(
            candidate.timeframe,
            observation,
          );
        } catch (error) {
          this.recordEvaluationBatchFailure(
            1,
            `${symbol}/${candidate.timeframe}`,
            error,
            evaluatedAt,
          );

          observations.set(
            candidate.timeframe,
            null,
          );

          continue;
        }
      }

      if (!observation) {
        continue;
      }

      if (
        candidate.causal
        && candidate.stage
          !== 'THIRD_TOUCH_CONFIRMED'
      ) {
        continue;
      }

      this.evaluationsCount += 1;
      this.lastEvaluationAt =
        observation.evaluatedAt;

      try {
        const event =
          evaluateSetupStage(
            candidate,
            observation,
            this.stageEvaluatorOptions,
          );

        if (!event) {
          continue;
        }

        const updatedCandidate =
          advanceSetupEngineState(
            candidate,
            event,
          );

        this.candidates.set(
          candidate.id,
          cloneCandidate(
            updatedCandidate,
          ),
        );

        this.stageTransitionsCount += 1;
        this.lastTransitionAt =
          updatedCandidate.updatedAt;

        this.emitStageTransition(
          candidate,
          updatedCandidate,
        );
      } catch (error) {
        this.failedEvaluations += 1;

        this.lastError =
          error instanceof Error
            ? `${candidate.id}: ${error.message}`
            : `${candidate.id}: Setup Stage evaluation failed`;
      }
    }
  }

  private buildObservation(
    symbol: string,
    timeframe:
      LevelEngineTimeframe,
    evaluatedAt: string,
  ):
    SetupStageMarketObservation
    | null {
    const klines =
      timeframe === '1m'
        ? this.source.getKlines(
            symbol,
            10,
          )
        : this.source.getSetupCandles?.(
            symbol,
            timeframe,
            10,
          )
          ?? [];

    const closedKline = [
      ...klines,
    ]
      .reverse()
      .find(
        (kline) =>
          kline.isClosed,
      );

    if (!closedKline) {
      return null;
    }

    const localEvaluatedAtMs =
      readTimestamp(
        evaluatedAt,
        'evaluatedAt',
      );

    const eventTimeMs =
      readTimestamp(
        closedKline.eventTime,
        'kline eventTime',
      );

    const closeTimeMs =
      readTimestamp(
        closedKline.closeTime,
        'kline closeTime',
      );

    const observedAtMs =
      Math.max(
        eventTimeMs,
        closeTimeMs,
      );

    const observedAt =
      new Date(
        observedAtMs,
      ).toISOString();

    const effectiveEvaluatedAt =
      new Date(
        Math.max(
          localEvaluatedAtMs,
          observedAtMs,
        ),
      ).toISOString();

    return {
      symbol:
        closedKline.symbol,

      openTime:
        closedKline.openTime,

      closeTime:
        closedKline.closeTime,

      open:
        closedKline.open,

      high:
        closedKline.high,

      low:
        closedKline.low,

      close:
        closedKline.close,

      currentPrice:
        closedKline.close,

      isClosed:
        closedKline.isClosed,

      observedAt,
      evaluatedAt:
        effectiveEvaluatedAt,
    };
  }

  private recordEvaluationBatchFailure(
    candidatesCount: number,
    symbol: string,
    error: unknown,
    evaluatedAt:
      string =
        this.readNow()
          .toISOString(),
  ): void {
    this.evaluationsCount +=
      candidatesCount;

    this.failedEvaluations +=
      candidatesCount;

    this.lastEvaluationAt =
      evaluatedAt;

    this.lastError =
      error instanceof Error
        ? `${symbol}: ${error.message}`
        : `${symbol}: Setup Stage evaluation failed`;
  }

  private scanSymbol(
    symbol: string,
  ): void {
    for (
      const [
        timeframe,
        pipeline,
      ] of this.pipelines
    ) {
      this.scansCount += 1;

      this.lastScanAt =
        this.readNow()
          .toISOString();

      try {
        const scanKey =
          `${symbol}:${timeframe}`;
        const latestClosedAt =
          this.latestClosedCandleAt(
            symbol,
            timeframe,
          );

        if (
          this.lastScannedClosedCandle.has(
            scanKey,
          )
          && this.lastScannedClosedCandle.get(
            scanKey,
          ) === latestClosedAt
        ) {
          this.scansCount -= 1;
          continue;
        }

        const result =
          pipeline.scanSymbol(
            symbol,
          );

        this.lastScannedClosedCandle.set(
          scanKey,
          latestClosedAt,
        );

        const nowMs =
          this.readNow()
            .getTime();

        for (
          const candidate
          of result.candidates
        ) {
          if (
            timestampValue(
              candidate.expiresAt,
            ) <= nowMs
          ) {
            continue;
          }

          if (
            !this.candidates.has(
              candidate.id,
            )
          ) {
            const storedCandidate =
              cloneCandidate(
                candidate,
              );

            this.candidates.set(
              candidate.id,
              storedCandidate,
            );

            this.emitCandidateCreated(
              storedCandidate,
            );
          }
        }

        for (
          const update
          of result.causalUpdates
        ) {
          this.applyCausalUpdate(
            update,
          );
        }

        this.enforceCandidateLimit();
      } catch (error) {
        this.failedScans += 1;

        this.lastError =
          error instanceof Error
            ? timeframe === '1m'
              ? `${symbol}: ${error.message}`
              : `${symbol}/${timeframe}: ${error.message}`
            : timeframe === '1m'
              ? `${symbol}: Setup Detection Runtime scan failed`
              : `${symbol}/${timeframe}: Setup Detection Runtime scan failed`;
      }
    }
  }

  private latestClosedCandleAt(
    symbol: string,
    timeframe:
      LevelEngineTimeframe,
  ): string | null {
    const candles =
      timeframe === '1m'
        ? this.source.getKlines(
            symbol,
            2,
          )
        : this.source.getSetupCandles?.(
            symbol,
            timeframe,
            2,
          )
          ?? [];

    return [
      ...candles,
    ]
      .reverse()
      .find(
        (candle) =>
          candle.isClosed,
      )
      ?.closeTime
      ?? null;
  }

  private applyCausalUpdate(
    update: SetupCausalUpdate,
  ): void {
    let candidate =
      this.candidates.get(
        update.candidateId,
      );

    if (
      !candidate
      || isTerminalStage(
        candidate.stage,
      )
    ) {
      return;
    }

    if (
      !candidate.episode
      || candidate.episode.id
        !== update.episodeId
    ) {
      throw new Error(
        `Setup Detection Runtime episode identity changed for ${candidate.id}`,
      );
    }

    if (
      candidate.causal
      && candidate.causal.lineId
        !== update.context.lineId
    ) {
      throw new Error(
        `Setup Detection Runtime causal line identity changed for ${candidate.id}`,
      );
    }

    for (
      const transition
      of update.transitionEvents
    ) {
      const event =
        transition.event;
      const applicable =
        (
          event.type
            === 'APPROACH_DETECTED'
          && candidate.stage
            === 'LEVEL_CONFIRMED'
        )
        || (
          event.type
            === 'THIRD_TOUCH_DETECTED'
          && candidate.stage
            === 'APPROACHING_THIRD_TOUCH'
        );

      if (!applicable) {
        continue;
      }

      const previous =
        candidate;
      const advanced =
        advanceSetupEngineState(
          previous,
          event,
        );
      candidate = {
        ...advanced,
        causal:
          cloneCausalContext(
            transition.context,
          ),
      };

      this.candidates.set(
        candidate.id,
        cloneCandidate(candidate),
      );
      this.stageTransitionsCount += 1;
      this.lastTransitionAt =
        candidate.updatedAt;
      this.emitStageTransition(
        previous,
        candidate,
      );
    }

    const currentContext =
      candidate.causal;

    if (
      !currentContext
      || causalStageRank(
        update.context,
      ) >= causalStageRank(
        currentContext,
      )
    ) {
      candidate = {
        ...candidate,
        causal:
          cloneCausalContext(
            update.context,
          ),
      };
      this.candidates.set(
        candidate.id,
        cloneCandidate(candidate),
      );
    }
  }

  private expireCandidates():
  void {
    const now =
      this.readNow();

    const nowMs =
      now.getTime();

    const occurredAt =
      now.toISOString();

    for (
      const [
        candidateId,
        candidate,
      ]
      of this.candidates
    ) {
      if (
        isTerminalStage(
          candidate.stage,
        )
        || timestampValue(
          candidate.expiresAt,
        ) > nowMs
      ) {
        continue;
      }

      this.evaluationsCount += 1;
      this.lastEvaluationAt =
        occurredAt;

      try {
        const expired =
          advanceSetupEngineState(
            candidate,
            {
              type: 'EXPIRED',
              occurredAt,
            },
          );

        this.candidates.set(
          candidateId,
          cloneCandidate(
            expired,
          ),
        );

        this.stageTransitionsCount += 1;
        this.lastTransitionAt =
          expired.updatedAt;

        this.emitStageTransition(
          candidate,
          expired,
        );
      } catch (error) {
        this.failedEvaluations += 1;

        this.lastError =
          error instanceof Error
            ? `${candidate.id}: ${error.message}`
            : `${candidate.id}: Setup expiration failed`;
      }
    }

    this.enforceCandidateLimit();
  }

  private emitCandidateCreated(
    candidate:
      SetupEngineState,
  ): void {
    this.emitLifecycleEvent({
      type:
        'candidate_created',

      occurredAt:
        candidate.createdAt,

      candidateId:
        candidate.id,

      symbol:
        candidate.symbol,

      setupType:
        candidate.setupType,

      direction:
        candidate.direction,

      previousStage:
        null,

      currentStage:
        candidate.stage,

      outcome:
        candidate.outcome,

      candidate:
        cloneCandidate(
          candidate,
        ),
    });
  }

  private emitStageTransition(
    previousCandidate:
      SetupEngineState,

    currentCandidate:
      SetupEngineState,
  ): void {
    this.emitLifecycleEvent({
      type:
        lifecycleEventTypeForStage(
          currentCandidate.stage,
        ),

      occurredAt:
        currentCandidate.updatedAt,

      candidateId:
        currentCandidate.id,

      symbol:
        currentCandidate.symbol,

      setupType:
        currentCandidate.setupType,

      direction:
        currentCandidate.direction,

      previousStage:
        previousCandidate.stage,

      currentStage:
        currentCandidate.stage,

      outcome:
        currentCandidate.outcome,

      candidate:
        cloneCandidate(
          currentCandidate,
        ),
    });
  }

  private emitLifecycleEvent(
    input:
      SetupLifecycleEventInput,
  ): void {
    const event:
      SetupLifecycleEvent = {
        eventId:
          this.nextLifecycleEventId,

        ...input,
      };

    this.nextLifecycleEventId += 1;

    for (
      const listener
      of this.lifecycleListeners
    ) {
      try {
        listener(
          cloneLifecycleEvent(
            event,
          ),
        );
      } catch {
        continue;
      }
    }
  }

  private enforceCandidateLimit():
  void {
    if (
      this.candidates.size
      <= this.options.maxCandidates
    ) {
      return;
    }

    const candidatesByRemovalPriority = [
      ...this.candidates
        .values(),
    ].sort(
      (
        left,
        right,
      ) => {
        const leftPriority =
          isTerminalStage(
            left.stage,
          )
            ? 0
            : 1;

        const rightPriority =
          isTerminalStage(
            right.stage,
          )
            ? 0
            : 1;

        if (
          leftPriority
          !== rightPriority
        ) {
          return (
            leftPriority
            - rightPriority
          );
        }

        return (
          timestampValue(
            left.createdAt,
          )
          - timestampValue(
              right.createdAt,
            )
        );
      },
    );

    const removeCount =
      this.candidates.size
      - this.options.maxCandidates;

    for (
      const candidate
      of candidatesByRemovalPriority
        .slice(
          0,
          removeCount,
        )
    ) {
      this.candidates.delete(
        candidate.id,
      );
    }
  }

  private readNow(): Date {
    const value =
      this.options.now();

    if (
      !(value instanceof Date)
      || Number.isNaN(
        value.getTime(),
      )
    ) {
      throw new Error(
        'Setup Detection Runtime now() must return a valid Date',
      );
    }

    return value;
  }
}
