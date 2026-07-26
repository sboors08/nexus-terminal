import {
  DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
  SetupDetectionPipeline,
} from './setup-detection-pipeline.js';
import type {
  SetupEngineState,
} from './setup-engine.types.js';
import type {
  SetupDetectionRuntimeOptions,
  SetupDetectionRuntimeSource,
  SetupDetectionRuntimeState,
  SetupDetectionRuntimeStatus,
  SetupDetectionTriggerSource,
} from './setup-detection-runtime.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

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

export class SetupDetectionRuntimeService {
  private readonly pipeline:
    SetupDetectionPipeline;

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

  private lastScanAt:
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

            this.scanSymbols(
              event.symbols,
              event.source,
            );
          },
        );

    this.scanSymbols(
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
    this.pruneExpiredCandidates();

    return {
      state:
        this.state,
      candidatesCount:
        this.candidates.size,
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

  getCandidates(
    symbolValue?: string,
  ): SetupEngineState[] {
    this.pruneExpiredCandidates();

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
    this.pruneExpiredCandidates();

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

  private scanSymbols(
    symbolValues:
      readonly string[],
    triggerSource:
      SetupDetectionTriggerSource,
  ): void {
    const symbols =
      [
        ...new Set(
          symbolValues,
        ),
      ];

    this.lastTriggerSource =
      triggerSource;

    for (const symbol of symbols) {
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

    this.pruneExpiredCandidates();
  }

  private enforceCandidateLimit():
  void {
    if (
      this.candidates.size
      <= this.options.maxCandidates
    ) {
      return;
    }

    const oldestCandidates =
      [
        ...this.candidates
          .values(),
      ].sort(
        (
          left,
          right,
        ) =>
          timestampValue(
            left.createdAt,
          )
          - timestampValue(
              right.createdAt,
            ),
      );

    const removeCount =
      this.candidates.size
      - this.options.maxCandidates;

    for (
      const candidate
      of oldestCandidates.slice(
        0,
        removeCount,
      )
    ) {
      this.candidates.delete(
        candidate.id,
      );
    }
  }

  private pruneExpiredCandidates():
  void {
    const nowMs =
      this.readNow()
        .getTime();

    for (
      const [
        candidateId,
        candidate,
      ]
      of this.candidates
    ) {
      if (
        timestampValue(
          candidate.expiresAt,
        ) <= nowMs
      ) {
        this.candidates.delete(
          candidateId,
        );
      }
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
