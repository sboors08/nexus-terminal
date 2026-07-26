import type {
  SetupEngineEvent,
  SetupEngineOutcome,
  SetupEngineStage,
  SetupEngineState,
} from './setup-engine.types.js';

const TERMINAL_STAGES:
  readonly SetupEngineStage[] = [
    'BREAKOUT_CONFIRMED',
    'REJECTION_CONFIRMED',
    'SETUP_EXPIRED',
  ];

function round(
  value: number,
  digits = 4,
): number {
  const factor =
    10 ** digits;

  return Math.round(
    value * factor,
  ) / factor;
}

function validatePrice(
  price: number,
): void {
  if (
    !Number.isFinite(price)
    || price <= 0
  ) {
    throw new Error(
      'Setup Engine price must be a positive finite number',
    );
  }
}

function validateTimestamp(
  timestamp: string,
): void {
  if (
    !Number.isFinite(
      Date.parse(timestamp),
    )
  ) {
    throw new Error(
      'Setup Engine timestamp must be a valid ISO date',
    );
  }
}

function isTerminalStage(
  stage: SetupEngineStage,
): boolean {
  return TERMINAL_STAGES.includes(
    stage,
  );
}

export function calculateDistanceToLevelPct(
  currentPrice: number,
  levelCenterPrice: number,
): number {
  validatePrice(currentPrice);
  validatePrice(levelCenterPrice);

  return round(
    Math.abs(
      (
        currentPrice
        - levelCenterPrice
      ) / levelCenterPrice
      * 100,
    ),
  );
}

function resolveNextStage(
  currentStage: SetupEngineStage,
  event: SetupEngineEvent,
): SetupEngineStage {
  if (
    event.type === 'EXPIRED'
    && !isTerminalStage(currentStage)
  ) {
    return 'SETUP_EXPIRED';
  }

  if (
    currentStage === 'LEVEL_CONFIRMED'
    && event.type === 'APPROACH_DETECTED'
  ) {
    return 'APPROACHING_THIRD_TOUCH';
  }

  if (
    currentStage === 'APPROACHING_THIRD_TOUCH'
    && event.type === 'THIRD_TOUCH_DETECTED'
  ) {
    return 'THIRD_TOUCH_CONFIRMED';
  }

  if (
    currentStage === 'THIRD_TOUCH_CONFIRMED'
    && event.type === 'BREAKOUT_DETECTED'
  ) {
    return 'BREAKOUT_CONFIRMED';
  }

  if (
    currentStage === 'THIRD_TOUCH_CONFIRMED'
    && event.type === 'REJECTION_DETECTED'
  ) {
    return 'REJECTION_CONFIRMED';
  }

  throw new Error(
    `Invalid Setup Engine transition: ${currentStage} -> ${event.type}`,
  );
}

function resolveOutcome(
  nextStage: SetupEngineStage,
): SetupEngineOutcome {
  if (
    nextStage === 'BREAKOUT_CONFIRMED'
  ) {
    return 'breakout';
  }

  if (
    nextStage === 'REJECTION_CONFIRMED'
  ) {
    return 'rejection';
  }

  return null;
}

export function advanceSetupEngineState(
  state: SetupEngineState,
  event: SetupEngineEvent,
): SetupEngineState {
  validateTimestamp(event.occurredAt);

  if (
    Date.parse(event.occurredAt)
    < Date.parse(state.updatedAt)
  ) {
    throw new Error(
      'Setup Engine event cannot occur before the current state update',
    );
  }

  const nextStage =
    resolveNextStage(
      state.stage,
      event,
    );

  if (
    event.type === 'EXPIRED'
  ) {
    return {
      ...state,
      stage: nextStage,
      outcome: null,
      updatedAt: event.occurredAt,
    };
  }

  validatePrice(event.price);

  return {
    ...state,
    stage: nextStage,
    outcome:
      resolveOutcome(nextStage),
    level: {
      ...state.level,
      touches:
        event.type === 'THIRD_TOUCH_DETECTED'
          ? Math.max(
              state.level.touches,
              3,
            )
          : state.level.touches,
    },
    currentPrice: event.price,
    distanceToLevelPct:
      calculateDistanceToLevelPct(
        event.price,
        state.level.centerPrice,
      ),
    updatedAt: event.occurredAt,
  };
}
