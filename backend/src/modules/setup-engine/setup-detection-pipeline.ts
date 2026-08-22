import {
  DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
  detectLevelLines,
} from '../level-engine/level-lines-detector.js';
import type {
  LevelEngineTimeframe,
} from '../level-engine/level-engine.types.js';
import type {
  LevelEngineCandle,
} from '../level-engine/level-engine-touch-detector.types.js';
import {
  captureRealtimeConfirmationEvidence,
} from '../level-engine/realtime-confirmation-evidence.js';
import {
  evaluateRealtimeConfirmations,
} from '../level-engine/realtime-confirmation-engine.js';
import {
  adaptCausalSetupCandidates,
} from './causal-setup-adapter.js';
import {
  DEFAULT_SETUP_CANDIDATE_FACTORY_OPTIONS,
} from './setup-candidate-factory.js';
import type {
  SetupEngineSetupType,
} from './setup-engine.types.js';
import type {
  SetupDetectionMarketStore,
  SetupDetectionPipelineDependencies,
  SetupDetectionPipelineOptions,
  SetupDetectionPipelineResult,
} from './setup-detection-pipeline.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

export const DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS:
  SetupDetectionPipelineOptions = {
    maxCandles: 1_440,
    levelLinesOptions: {
      ...DEFAULT_LEVEL_LINES_DETECTION_OPTIONS,
    },
    candidateOptions: {
      ...DEFAULT_SETUP_CANDIDATE_FACTORY_OPTIONS,
    },
    setupTypes: [
      'level_breakout',
      'level_bounce',
    ],
  };

function normalizeSymbol(
  value: string,
): string {
  const symbol =
    value.trim().toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Setup Detection Pipeline symbol: ${value}`,
    );
  }

  return symbol;
}

function validateSetupType(
  value: SetupEngineSetupType,
): void {
  if (
    value !== 'level_breakout'
    && value !== 'level_bounce'
  ) {
    throw new Error(
      `Invalid Setup Detection Pipeline setup type: ${String(value)}`,
    );
  }
}

function normalizeOptions(
  options: SetupDetectionPipelineOptions,
): SetupDetectionPipelineOptions {
  if (
    !Number.isInteger(options.maxCandles)
    || options.maxCandles <= 0
  ) {
    throw new Error(
      'Setup Detection Pipeline maxCandles must be a positive integer',
    );
  }

  if (
    !Number.isInteger(
      options.candidateOptions
        .expiresAfterSec,
    )
    || options.candidateOptions
      .expiresAfterSec <= 0
  ) {
    throw new Error(
      'Setup Detection Pipeline candidate expiration must be positive',
    );
  }

  const setupTypes = [
    ...new Set(options.setupTypes),
  ];

  if (setupTypes.length === 0) {
    throw new Error(
      'Setup Detection Pipeline requires at least one setup type',
    );
  }

  for (const setupType of setupTypes) {
    validateSetupType(setupType);
  }

  return {
    maxCandles: options.maxCandles,
    levelLinesOptions: {
      ...options.levelLinesOptions,
    },
    candidateOptions: {
      ...options.candidateOptions,
    },
    setupTypes,
  };
}

function mapKlineToLevelEngineCandle(
  kline: {
    openTime: string;
    closeTime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    isClosed: boolean;
  },
): LevelEngineCandle {
  return {
    openTime: kline.openTime,
    closeTime: kline.closeTime,
    open: kline.open,
    high: kline.high,
    low: kline.low,
    close: kline.close,
    isClosed: kline.isClosed,
  };
}

export class SetupDetectionPipeline {
  private readonly emittedCandidateIds =
    new Set<string>();

  private readonly options:
    SetupDetectionPipelineOptions;

  private readonly timeframe:
    LevelEngineTimeframe;

  constructor(
    private readonly store:
      SetupDetectionMarketStore,
    options:
      SetupDetectionPipelineOptions =
        DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
    private readonly dependencies:
      SetupDetectionPipelineDependencies = {},
  ) {
    this.options =
      normalizeOptions(options);

    this.timeframe =
      dependencies.timeframe
      ?? '1m';
  }

  scanSymbol(
    symbolValue: string,
  ): SetupDetectionPipelineResult {
    const symbol =
      normalizeSymbol(symbolValue);
    const retainedKlines =
      this.timeframe === '1m'
        ? this.store.getKlines(
            symbol,
            this.options.maxCandles,
          )
        : this.store.getSetupCandles?.(
            symbol,
            this.timeframe,
            this.options.maxCandles,
          )
          ?? [];
    const candles =
      retainedKlines.map(
        mapKlineToLevelEngineCandle,
      );
    const detection =
      detectLevelLines(
        {
          symbol,
          timeframe: this.timeframe,
          candles,
        },
        this.options
          .levelLinesOptions,
      );
    const currentCandleIndex =
      detection
        .approachEvaluation
        .currentCandleIndex;
    const currentClosedCandle =
      currentCandleIndex === null
        ? null
        : candles[currentCandleIndex]
          ?? null;
    const localNow =
      this.dependencies.now
      ?? (() => new Date());
    const now = (): Date =>
      new Date(
        Math.max(
          localNow().getTime(),
          currentClosedCandle
            ? Date.parse(
                currentClosedCandle
                  .closeTime,
              )
            : Number.NEGATIVE_INFINITY,
        ),
      );
    const realtimeEvidence =
      captureRealtimeConfirmationEvidence(
        symbol,
        this.dependencies
          .realtimeEvidenceReaders
        ?? {},
        now,
      );
    const realtimeConfirmation =
      evaluateRealtimeConfirmations({
        symbol,
        timeframe: this.timeframe,
        approachEvaluation:
          detection.approachEvaluation,
        currentClosedCandle,
        evidence: realtimeEvidence,
      });
    const adapted =
      adaptCausalSetupCandidates({
        detection,
        realtimeConfirmation,
        setupTypes:
          this.options.setupTypes,
        expiresAfterSec:
          this.options
            .candidateOptions
            .expiresAfterSec,
      });
    const candidates:
      SetupDetectionPipelineResult[
        'candidates'
      ] = [];
    const duplicateCandidateIds:
      string[] = [];

    for (const candidate of adapted.candidates) {
      if (
        this.emittedCandidateIds.has(
          candidate.id,
        )
      ) {
        duplicateCandidateIds.push(
          candidate.id,
        );
        continue;
      }

      this.emittedCandidateIds.add(
        candidate.id,
      );
      candidates.push(candidate);
    }

    return {
      symbol,
      timeframe: this.timeframe,
      scannedCandlesCount:
        candles.length,
      currentPrice:
        detection
          .observationTracking
          .currentPrice,
      levels: [
        ...detection.activeLevels,
      ],
      candidates,
      causalUpdates: [
        ...adapted.updates,
      ],
      duplicateCandidateIds,
      source: 'level_lines',
      sourceCreatesSetup: false,
      createsSignal: false,
      evaluatesBreakout: false,
      evaluatesBounce: false,
    };
  }
}
