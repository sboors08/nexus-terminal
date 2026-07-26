import type {
  SetupEngineEvent,
  SetupEngineLevelKind,
  SetupEngineState,
} from './setup-engine.types.js';
import type {
  SetupStageEvaluatorOptions,
  SetupStageMarketObservation,
} from './setup-stage-evaluator.types.js';

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const TERMINAL_STAGES =
  new Set([
    'BREAKOUT_CONFIRMED',
    'REJECTION_CONFIRMED',
    'SETUP_EXPIRED',
  ]);

export const DEFAULT_SETUP_STAGE_EVALUATOR_OPTIONS:
SetupStageEvaluatorOptions = {
  approachDistancePct: 0.5,
  breakoutConfirmationPct: 0.05,
  rejectionConfirmationPct: 0.1,
  maxObservationAgeSec: 120,
};

interface ValidatedTimes {
  updatedAtMs: number;
  expiresAtMs: number;
  openTimeMs: number;
  closeTimeMs: number;
  observedAtMs: number;
  evaluatedAtMs: number;
}

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
      `Invalid Setup Stage Evaluator symbol: ${value}`,
    );
  }

  return symbol;
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
      `Setup Stage Evaluator ${name} must be a valid ISO date`,
    );
  }

  return timestamp;
}

function validatePositivePrice(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `Setup Stage Evaluator ${name} must be a positive finite number`,
    );
  }
}

function validateNonNegativeNumber(
  value: number,
  name: string,
): void {
  if (
    !Number.isFinite(value)
    || value < 0
  ) {
    throw new Error(
      `Setup Stage Evaluator ${name} must be a non-negative finite number`,
    );
  }
}

function validateOptions(
  options:
    SetupStageEvaluatorOptions,
): void {
  validateNonNegativeNumber(
    options.approachDistancePct,
    'approachDistancePct',
  );

  validateNonNegativeNumber(
    options.breakoutConfirmationPct,
    'breakoutConfirmationPct',
  );

  validateNonNegativeNumber(
    options.rejectionConfirmationPct,
    'rejectionConfirmationPct',
  );

  if (
    !Number.isInteger(
      options.maxObservationAgeSec,
    )
    || options.maxObservationAgeSec
      <= 0
  ) {
    throw new Error(
      'Setup Stage Evaluator maxObservationAgeSec must be a positive integer',
    );
  }
}

function validateLevel(
  state:
    SetupEngineState,
): void {
  validatePositivePrice(
    state.level.centerPrice,
    'level centerPrice',
  );

  validatePositivePrice(
    state.level.zoneLow,
    'level zoneLow',
  );

  validatePositivePrice(
    state.level.zoneHigh,
    'level zoneHigh',
  );

  if (
    state.level.zoneLow
      > state.level.centerPrice
    || state.level.centerPrice
      > state.level.zoneHigh
  ) {
    throw new Error(
      'Setup Stage Evaluator level center must be inside its zone',
    );
  }

  if (
    !Number.isInteger(
      state.level.touches,
    )
    || state.level.touches < 2
  ) {
    throw new Error(
      'Setup Stage Evaluator level must contain at least two touches',
    );
  }
}

function validateObservation(
  state:
    SetupEngineState,
  observation:
    SetupStageMarketObservation,
  options:
    SetupStageEvaluatorOptions,
): ValidatedTimes {
  validateOptions(options);
  validateLevel(state);

  const stateSymbol =
    normalizeSymbol(
      state.symbol,
    );

  const observationSymbol =
    normalizeSymbol(
      observation.symbol,
    );

  if (
    stateSymbol
      !== observationSymbol
  ) {
    throw new Error(
      'Setup Stage Evaluator observation symbol must match setup symbol',
    );
  }

  validatePositivePrice(
    observation.open,
    'open',
  );

  validatePositivePrice(
    observation.high,
    'high',
  );

  validatePositivePrice(
    observation.low,
    'low',
  );

  validatePositivePrice(
    observation.close,
    'close',
  );

  validatePositivePrice(
    observation.currentPrice,
    'currentPrice',
  );

  if (
    observation.low
      > observation.high
    || observation.open
      < observation.low
    || observation.open
      > observation.high
    || observation.close
      < observation.low
    || observation.close
      > observation.high
  ) {
    throw new Error(
      'Setup Stage Evaluator observation contains invalid OHLC values',
    );
  }

  const times:
  ValidatedTimes = {
    updatedAtMs:
      readTimestamp(
        state.updatedAt,
        'state updatedAt',
      ),
    expiresAtMs:
      readTimestamp(
        state.expiresAt,
        'state expiresAt',
      ),
    openTimeMs:
      readTimestamp(
        observation.openTime,
        'openTime',
      ),
    closeTimeMs:
      readTimestamp(
        observation.closeTime,
        'closeTime',
      ),
    observedAtMs:
      readTimestamp(
        observation.observedAt,
        'observedAt',
      ),
    evaluatedAtMs:
      readTimestamp(
        observation.evaluatedAt,
        'evaluatedAt',
      ),
  };

  if (
    times.openTimeMs
      > times.closeTimeMs
  ) {
    throw new Error(
      'Setup Stage Evaluator openTime cannot be after closeTime',
    );
  }

  if (
    times.observedAtMs
      < times.openTimeMs
  ) {
    throw new Error(
      'Setup Stage Evaluator observedAt cannot be before candle openTime',
    );
  }

  if (
    observation.isClosed
    && times.observedAtMs
      < times.closeTimeMs
  ) {
    throw new Error(
      'Setup Stage Evaluator closed candle cannot be observed before closeTime',
    );
  }

  if (
    times.evaluatedAtMs
      < times.observedAtMs
  ) {
    throw new Error(
      'Setup Stage Evaluator evaluatedAt cannot be before observedAt',
    );
  }

  return times;
}

function percentageValue(
  centerPrice: number,
  percentage: number,
): number {
  return (
    centerPrice
    * percentage
    / 100
  );
}

function isApproachingLevel(
  state:
    SetupEngineState,
  currentPrice: number,
  approachDistancePct: number,
): boolean {
  const {
    centerPrice,
    zoneLow,
    zoneHigh,
    kind,
  } =
    state.level;

  if (
    kind === 'resistance'
  ) {
    if (
      currentPrice > zoneHigh
    ) {
      return false;
    }

    const distancePct =
      Math.max(
        0,
        (
          zoneLow
          - currentPrice
        )
        / centerPrice
        * 100,
      );

    return distancePct
      <= approachDistancePct;
  }

  if (
    currentPrice < zoneLow
  ) {
    return false;
  }

  const distancePct =
    Math.max(
      0,
      (
        currentPrice
        - zoneHigh
      )
      / centerPrice
      * 100,
    );

  return distancePct
    <= approachDistancePct;
}

function candleTouchesLevel(
  state:
    SetupEngineState,
  observation:
    SetupStageMarketObservation,
): boolean {
  return (
    observation.high
      >= state.level.zoneLow
    && observation.low
      <= state.level.zoneHigh
  );
}

function breakoutThreshold(
  state:
    SetupEngineState,
  levelKind:
    SetupEngineLevelKind,
  confirmationPct: number,
): number {
  const confirmationValue =
    percentageValue(
      state.level.centerPrice,
      confirmationPct,
    );

  return levelKind
    === 'resistance'
      ? state.level.zoneHigh
        + confirmationValue
      : state.level.zoneLow
        - confirmationValue;
}

function rejectionThreshold(
  state:
    SetupEngineState,
  levelKind:
    SetupEngineLevelKind,
  confirmationPct: number,
): number {
  const confirmationValue =
    percentageValue(
      state.level.centerPrice,
      confirmationPct,
    );

  return levelKind
    === 'resistance'
      ? state.level.zoneLow
        - confirmationValue
      : state.level.zoneHigh
        + confirmationValue;
}

function isBreakoutConfirmed(
  state:
    SetupEngineState,
  observation:
    SetupStageMarketObservation,
  options:
    SetupStageEvaluatorOptions,
): boolean {
  const threshold =
    breakoutThreshold(
      state,
      state.level.kind,
      options
        .breakoutConfirmationPct,
    );

  return state.level.kind
    === 'resistance'
      ? observation.close
        >= threshold
      : observation.close
        <= threshold;
}

function isRejectionConfirmed(
  state:
    SetupEngineState,
  observation:
    SetupStageMarketObservation,
  options:
    SetupStageEvaluatorOptions,
): boolean {
  const threshold =
    rejectionThreshold(
      state,
      state.level.kind,
      options
        .rejectionConfirmationPct,
    );

  return state.level.kind
    === 'resistance'
      ? observation.close
        <= threshold
      : observation.close
        >= threshold;
}

export function evaluateSetupStage(
  state:
    SetupEngineState,
  observation:
    SetupStageMarketObservation,
  options:
    SetupStageEvaluatorOptions =
      DEFAULT_SETUP_STAGE_EVALUATOR_OPTIONS,
): SetupEngineEvent | null {
  const times =
    validateObservation(
      state,
      observation,
      options,
    );

  if (
    TERMINAL_STAGES.has(
      state.stage,
    )
  ) {
    return null;
  }

  if (
    times.evaluatedAtMs
      >= times.expiresAtMs
  ) {
    return {
      type: 'EXPIRED',
      occurredAt:
        observation.evaluatedAt,
    };
  }

  const observationAgeMs =
    times.evaluatedAtMs
    - times.observedAtMs;

  if (
    times.observedAtMs
      <= times.updatedAtMs
    || observationAgeMs
      > options
        .maxObservationAgeSec
        * 1_000
  ) {
    return null;
  }

  if (
    state.stage
      === 'LEVEL_CONFIRMED'
  ) {
    return isApproachingLevel(
      state,
      observation.currentPrice,
      options
        .approachDistancePct,
    )
      ? {
          type:
            'APPROACH_DETECTED',
          price:
            observation.currentPrice,
          occurredAt:
            observation.observedAt,
        }
      : null;
  }

  if (
    state.stage
      === 'APPROACHING_THIRD_TOUCH'
  ) {
    return (
      observation.isClosed
      && candleTouchesLevel(
        state,
        observation,
      )
    )
      ? {
          type:
            'THIRD_TOUCH_DETECTED',
          price:
            observation.currentPrice,
          occurredAt:
            observation.observedAt,
        }
      : null;
  }

  if (
    state.stage
      !== 'THIRD_TOUCH_CONFIRMED'
    || !observation.isClosed
  ) {
    return null;
  }

  if (
    state.setupType
      === 'level_breakout'
  ) {
    return isBreakoutConfirmed(
      state,
      observation,
      options,
    )
      ? {
          type:
            'BREAKOUT_DETECTED',
          price:
            observation.close,
          occurredAt:
            observation.observedAt,
        }
      : null;
  }

  return isRejectionConfirmed(
    state,
    observation,
    options,
  )
    ? {
        type:
          'REJECTION_DETECTED',
        price:
          observation.close,
        occurredAt:
          observation.observedAt,
      }
    : null;
}
