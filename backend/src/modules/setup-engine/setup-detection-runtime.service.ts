import {
  DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
  SetupDetectionPipeline,
} from './setup-detection-pipeline.js';
import {
  advanceSetupEngineState,
} from './setup-engine.js';
import type {
  SetupEngineStage,
  SetupEngineState,
} from './setup-engine.types.js';
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

    detectorOptions: {
      ...DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS
        .detectorOptions,
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
  };
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

export class SetupDetectionRuntimeService {
  private readonly pipeline:
    SetupDetectionPipeline;

  private readonly stageEvaluatorOptions:
    SetupStageEvaluatorOptions;

  private readonly candidates =
    new Map<
      string,
      SetupEngineState
    >();

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

    this.pipeline =
      new SetupDetectionPipeline(
        source,
        options.pipelineOptions,
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

    let observation:
      SetupStageMarketObservation
      | null;

    try {
      observation =
        this.buildObservation(
          symbol,
          evaluatedAt,
        );
    } catch (error) {
      this.recordEvaluationBatchFailure(
        candidateIds.length,
        symbol,
        error,
        evaluatedAt,
      );

      return;
    }

    if (!observation) {
      return;
    }

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
    evaluatedAt: string,
  ):
    SetupStageMarketObservation
    | null {
    const klines =
      this.source.getKlines(
        symbol,
        10,
      );

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
    this.scansCount += 1;

    this.lastScanAt =
      this.readNow()
        .toISOString();

    try {
      const result =
        this.pipeline.scanSymbol(
          symbol,
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
          this.candidates.set(
            candidate.id,
            cloneCandidate(
              candidate,
            ),
          );
        }
      }

      this.enforceCandidateLimit();
    } catch (error) {
      this.failedScans += 1;

      this.lastError =
        error instanceof Error
          ? `${symbol}: ${error.message}`
          : `${symbol}: Setup Detection Runtime scan failed`;
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
