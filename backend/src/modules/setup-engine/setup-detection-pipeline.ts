import {
  createSetupCandidate,
  DEFAULT_SETUP_CANDIDATE_FACTORY_OPTIONS,
} from './setup-candidate-factory.js';
import {
  DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS,
  detectSetupLevels,
} from './setup-level-detector.js';
import type {
  SetupLevelDetectorCandle,
} from './setup-level-detector.types.js';
import type {
  SetupEngineSetupType,
} from './setup-engine.types.js';
import type {
  SetupDetectionMarketStore,
  SetupDetectionPipelineOptions,
  SetupDetectionPipelineResult,
} from './setup-detection-pipeline.types.js';

const TIMEFRAME =
  '1m' as const;

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

export const DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS:
  SetupDetectionPipelineOptions = {
    maxCandles: 1_440,
    detectorOptions: {
      ...DEFAULT_SETUP_LEVEL_DETECTOR_OPTIONS,
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
  options:
    SetupDetectionPipelineOptions,
): SetupDetectionPipelineOptions {
  if (
    !Number.isInteger(
      options.maxCandles,
    )
    || options.maxCandles <= 0
  ) {
    throw new Error(
      'Setup Detection Pipeline maxCandles must be a positive integer',
    );
  }

  const detectorIntegers = [
    options.detectorOptions
      .pivotWindow,
    options.detectorOptions
      .minTouches,
    options.detectorOptions
      .minTouchSpacingCandles,
  ];

  if (
    detectorIntegers.some(
      (value) =>
        !Number.isInteger(value)
        || value <= 0,
    )
  ) {
    throw new Error(
      'Setup Detection Pipeline detector integer options must be positive',
    );
  }

  if (
    options.detectorOptions
      .minTouches < 2
  ) {
    throw new Error(
      'Setup Detection Pipeline requires at least two level touches',
    );
  }

  if (
    !Number.isFinite(
      options.detectorOptions
        .maxDistancePct,
    )
    || options.detectorOptions
      .maxDistancePct <= 0
  ) {
    throw new Error(
      'Setup Detection Pipeline detector distance must be positive',
    );
  }

  if (
    !Number.isFinite(
      options.detectorOptions
        .zonePaddingPct,
    )
    || options.detectorOptions
      .zonePaddingPct < 0
  ) {
    throw new Error(
      'Setup Detection Pipeline zone padding must be non-negative',
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
    ...new Set(
      options.setupTypes,
    ),
  ];

  if (setupTypes.length === 0) {
    throw new Error(
      'Setup Detection Pipeline requires at least one setup type',
    );
  }

  for (
    const setupType
    of setupTypes
  ) {
    validateSetupType(
      setupType,
    );
  }

  return {
    maxCandles:
      options.maxCandles,
    detectorOptions: {
      ...options.detectorOptions,
    },
    candidateOptions: {
      ...options.candidateOptions,
    },
    setupTypes,
  };
}

function mapKlineToDetectorCandle(
  kline: {
    openTime: string;
    closeTime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    isClosed: boolean;
  },
): SetupLevelDetectorCandle {
  return {
    openTime:
      kline.openTime,
    closeTime:
      kline.closeTime,
    open:
      kline.open,
    high:
      kline.high,
    low:
      kline.low,
    close:
      kline.close,
    isClosed:
      kline.isClosed,
  };
}

function resolveCurrentPrice(
  state:
    ReturnType<
      SetupDetectionMarketStore[
        'getState'
      ]
    >,
): number | null {
  if (state?.bookTicker) {
    return (
      state.bookTicker.bidPrice
      + state.bookTicker.askPrice
    ) / 2;
  }

  return state?.kline?.close
    ?? null;
}

export class SetupDetectionPipeline {
  private readonly emittedCandidateIds =
    new Set<string>();

  private readonly options:
    SetupDetectionPipelineOptions;

  constructor(
    private readonly store:
      SetupDetectionMarketStore,
    options:
      SetupDetectionPipelineOptions =
        DEFAULT_SETUP_DETECTION_PIPELINE_OPTIONS,
  ) {
    this.options =
      normalizeOptions(options);
  }

  scanSymbol(
    symbolValue: string,
  ): SetupDetectionPipelineResult {
    const symbol =
      normalizeSymbol(
        symbolValue,
      );

    const retainedKlines =
      this.store.getKlines(
        symbol,
        this.options.maxCandles,
      );

    const detectorCandles =
      retainedKlines.map(
        mapKlineToDetectorCandle,
      );

    const levels =
      detectSetupLevels(
        symbol,
        TIMEFRAME,
        detectorCandles,
        this.options
          .detectorOptions,
      );

    const currentPrice =
      resolveCurrentPrice(
        this.store.getState(
          symbol,
        ),
      );

    const candidates = [];
    const duplicateCandidateIds:
      string[] = [];

    if (currentPrice !== null) {
      for (const level of levels) {
        for (
          const setupType
          of this.options.setupTypes
        ) {
          const candidate =
            createSetupCandidate(
              level,
              setupType,
              currentPrice,
              this.options
                .candidateOptions,
            );

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

          candidates.push(
            candidate,
          );
        }
      }
    }

    return {
      symbol,
      timeframe:
        TIMEFRAME,
      scannedCandlesCount:
        detectorCandles.length,
      currentPrice,
      levels,
      candidates,
      duplicateCandidateIds,
    };
  }
}
