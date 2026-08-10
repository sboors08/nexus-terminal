import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from './level-engine.contract.js';
import {
  APPROACH_ENGINE_CONTRACT_VERSION,
} from './approach-engine.types.js';
import type {
  ApproachEvaluationInput,
  ApproachEvaluationOptions,
  ApproachEvaluationResult,
  LevelLineApproachEvaluation,
} from './approach-engine.types.js';
import {
  OBSERVATION_TRACKER_CONTRACT_VERSION,
} from './observation-tracker.types.js';
import type {
  ObservationPathProgress,
  ObservationTrackingResult,
} from './observation-tracker.types.js';

export const DEFAULT_APPROACH_EVALUATION_OPTIONS:
ApproachEvaluationOptions = Object.freeze({
  maxDistanceToLevelPercent:
    0.5,
});

function fail(
  message: string,
): never {
  throw new Error(
    `Approach Engine: ${message}`,
  );
}

function positiveFinite(
  value: number,
  field: string,
): number {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    fail(
      `${field} must be a positive finite number`,
    );
  }

  return value;
}

function nonNegativeFinite(
  value: number,
  field: string,
): number {
  if (
    !Number.isFinite(value)
    || value < 0
  ) {
    fail(
      `${field} must be a non-negative finite number`,
    );
  }

  return value;
}

function nonNegativeInteger(
  value: number,
  field: string,
): number {
  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    fail(
      `${field} must be a non-negative integer`,
    );
  }

  return value;
}

function canonicalTimestamp(
  value: string,
  field: string,
): string {
  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    fail(
      `${field} must be a valid timestamp`,
    );
  }

  return new Date(timestamp)
    .toISOString();
}

function validateOptions(
  value: ApproachEvaluationOptions,
): ApproachEvaluationOptions {
  const maxDistanceToLevelPercent =
    positiveFinite(
      value.maxDistanceToLevelPercent,
      'maxDistanceToLevelPercent',
    );

  if (maxDistanceToLevelPercent > 100) {
    fail(
      'maxDistanceToLevelPercent cannot exceed 100',
    );
  }

  return Object.freeze({
    maxDistanceToLevelPercent,
  });
}

function validateRootContract(
  value: ObservationTrackingResult,
  symbol: string,
  timeframe:
    ApproachEvaluationInput['timeframe'],
): void {
  if (
    value.version
      !== OBSERVATION_TRACKER_CONTRACT_VERSION
    || normalizeLevelEngineSymbol(
      value.symbol,
    ) !== symbol
    || value.timeframe !== timeframe
    || value.observationalOnly !== true
    || value.computesObservationProgress
      !== true
    || value.createsApproachEvaluation
      !== false
    || value.createsSetup !== false
    || value.createsSignal !== false
    || value.usesFutureCandles !== false
  ) {
    fail(
      'observation tracker contract does not match the approach input',
    );
  }

  const closedCandlesCount =
    nonNegativeInteger(
      value.closedCandlesCount,
      'closedCandlesCount',
    );
  nonNegativeInteger(
    value.ignoredOpenCandlesCount,
    'ignoredOpenCandlesCount',
  );

  const currentValues = [
    value.currentPrice,
    value.currentCandleIndex,
    value.currentCandleOpenTime,
    value.observedAt,
  ];
  const hasCurrentValue =
    currentValues.some(
      (currentValue) =>
        currentValue !== null,
    );
  const hasMissingCurrentValue =
    currentValues.some(
      (currentValue) =>
        currentValue === null,
    );

  if (
    hasCurrentValue
    && hasMissingCurrentValue
  ) {
    fail(
      'current observation fields must be all null or all populated',
    );
  }
  if (
    closedCandlesCount === 0
    && hasCurrentValue
  ) {
    fail(
      'an empty closed-candle snapshot cannot have current values',
    );
  }
  if (
    closedCandlesCount > 0
    && !hasCurrentValue
  ) {
    fail(
      'a closed-candle snapshot must have current values',
    );
  }

  if (!hasCurrentValue) {
    if (value.activeProgress.length > 0) {
      fail(
        'observation progress requires a current closed candle',
      );
    }
    return;
  }

  positiveFinite(
    value.currentPrice as number,
    'currentPrice',
  );
  nonNegativeInteger(
    value.currentCandleIndex as number,
    'currentCandleIndex',
  );
  canonicalTimestamp(
    value.currentCandleOpenTime as string,
    'currentCandleOpenTime',
  );
  canonicalTimestamp(
    value.observedAt as string,
    'observedAt',
  );
}

function validateProgress(
  value: ObservationPathProgress,
  index: number,
  observation:
    ObservationTrackingResult,
  symbol: string,
  timeframe:
    ApproachEvaluationInput['timeframe'],
): ObservationPathProgress {
  if (!value.lineId.trim()) {
    fail(
      `activeProgress[${index}].lineId cannot be empty`,
    );
  }
  if (
    normalizeLevelEngineSymbol(
      value.symbol,
    ) !== symbol
    || value.timeframe !== timeframe
  ) {
    fail(
      `activeProgress[${index}] does not belong to ${symbol} ${timeframe}`,
    );
  }
  if (
    value.kind !== 'support'
    && value.kind !== 'resistance'
  ) {
    fail(
      `activeProgress[${index}].kind is unsupported`,
    );
  }

  positiveFinite(
    value.levelPrice,
    `activeProgress[${index}].levelPrice`,
  );
  positiveFinite(
    value.departureExtremumPrice,
    `activeProgress[${index}].departureExtremumPrice`,
  );
  positiveFinite(
    value.currentPrice,
    `activeProgress[${index}].currentPrice`,
  );
  nonNegativeInteger(
    value.currentCandleIndex,
    `activeProgress[${index}].currentCandleIndex`,
  );
  canonicalTimestamp(
    value.departureExtremumObservedAt,
    `activeProgress[${index}].departureExtremumObservedAt`,
  );
  canonicalTimestamp(
    value.currentCandleOpenTime,
    `activeProgress[${index}].currentCandleOpenTime`,
  );
  canonicalTimestamp(
    value.observedAt,
    `activeProgress[${index}].observedAt`,
  );
  const progress =
    nonNegativeFinite(
      value.progress,
      `activeProgress[${index}].progress`,
    );
  const observationThreshold =
    positiveFinite(
      value.observationPathProgressThreshold,
      `activeProgress[${index}].observationPathProgressThreshold`,
    );

  if (observationThreshold > 1) {
    fail(
      `activeProgress[${index}].observationPathProgressThreshold cannot exceed 1`,
    );
  }
  if (
    value.stage
      !== (
        progress >= observationThreshold
          ? 'OBSERVATION'
          : null
      )
  ) {
    fail(
      `activeProgress[${index}].stage does not match its progress`,
    );
  }
  if (
    value.currentPrice
      !== observation.currentPrice
    || value.currentCandleIndex
      !== observation.currentCandleIndex
    || value.currentCandleOpenTime
      !== observation.currentCandleOpenTime
    || value.observedAt
      !== observation.observedAt
  ) {
    fail(
      `activeProgress[${index}] does not match the current observation snapshot`,
    );
  }

  return value;
}

function evaluateLine(
  value: ObservationPathProgress,
  threshold: number,
): LevelLineApproachEvaluation {
  const distanceToLevelPercent =
    Math.abs(
      value.currentPrice
      - value.levelPrice,
    )
    / value.levelPrice
    * 100;

  if (
    !Number.isFinite(
      distanceToLevelPercent,
    )
    || distanceToLevelPercent < 0
  ) {
    fail(
      `line ${value.lineId} produced an invalid distance`,
    );
  }

  return Object.freeze({
    lineId:
      value.lineId,
    symbol:
      value.symbol,
    timeframe:
      value.timeframe,
    kind:
      value.kind,
    levelPrice:
      value.levelPrice,
    currentPrice:
      value.currentPrice,
    currentCandleIndex:
      value.currentCandleIndex,
    currentCandleOpenTime:
      value.currentCandleOpenTime,
    observedAt:
      value.observedAt,
    observationProgress:
      value.progress,
    observationStage:
      value.stage,
    distanceToLevelPercent,
    maxDistanceToLevelPercent:
      threshold,
    stage:
      value.stage === 'OBSERVATION'
      && distanceToLevelPercent
        <= threshold
        ? 'APPROACH'
        : null,
  });
}

export function evaluateApproaches(
  input: ApproachEvaluationInput,
  optionsValue:
    ApproachEvaluationOptions =
      DEFAULT_APPROACH_EVALUATION_OPTIONS,
): ApproachEvaluationResult {
  if (
    !isLevelEngineTimeframe(
      input.timeframe,
    )
  ) {
    fail(
      `unsupported timeframe: ${input.timeframe}`,
    );
  }

  const symbol =
    normalizeLevelEngineSymbol(
      input.symbol,
    );
  const options =
    validateOptions(
      optionsValue,
    );
  const observation =
    input.observationTracking;

  validateRootContract(
    observation,
    symbol,
    input.timeframe,
  );

  const lineIds =
    new Set<string>();
  const evaluations:
  LevelLineApproachEvaluation[] = [];

  observation.activeProgress.forEach(
    (
      value,
      index,
    ) => {
      const progress =
        validateProgress(
          value,
          index,
          observation,
          symbol,
          input.timeframe,
        );

      if (lineIds.has(progress.lineId)) {
        fail(
          `duplicate line id: ${progress.lineId}`,
        );
      }
      lineIds.add(
        progress.lineId,
      );

      evaluations.push(
        evaluateLine(
          progress,
          options
            .maxDistanceToLevelPercent,
        ),
      );
    },
  );

  return Object.freeze({
    version:
      APPROACH_ENGINE_CONTRACT_VERSION,
    symbol,
    timeframe:
      input.timeframe,
    closedCandlesCount:
      observation.closedCandlesCount,
    ignoredOpenCandlesCount:
      observation.ignoredOpenCandlesCount,
    currentPrice:
      observation.currentPrice,
    currentCandleIndex:
      observation.currentCandleIndex,
    currentCandleOpenTime:
      observation.currentCandleOpenTime,
    observedAt:
      observation.observedAt,
    evaluations:
      Object.freeze([
        ...evaluations,
      ]),
    appliedOptions:
      options,
    observationalOnly: true,
    evaluatesApproach: true,
    createsRealtimeConfirmation:
      false,
    createsSetup: false,
    createsSignal: false,
    usesFutureCandles: false,
  });
}
