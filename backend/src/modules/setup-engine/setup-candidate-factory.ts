import {
  calculateDistanceToLevelPct,
} from './setup-engine.js';
import type {
  DetectedSetupLevel,
} from './setup-level-detector.types.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
  SetupEngineState,
} from './setup-engine.types.js';

export interface SetupCandidateFactoryOptions {
  expiresAfterSec: number;
}

export const DEFAULT_SETUP_CANDIDATE_FACTORY_OPTIONS:
  SetupCandidateFactoryOptions = {
    expiresAfterSec: 3_600,
  };

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

function validateTimestamp(
  value: string,
  field: string,
): number {
  const timestamp =
    Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid Setup Candidate timestamp: ${field}`,
    );
  }

  return timestamp;
}

function validatePositivePrice(
  value: number,
  field: string,
): void {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `Setup Candidate ${field} must be a positive finite number`,
    );
  }
}

function validateSetupType(
  setupType: SetupEngineSetupType,
): void {
  if (
    setupType !== 'level_breakout'
    && setupType !== 'level_bounce'
  ) {
    throw new Error(
      `Invalid Setup Candidate type: ${String(setupType)}`,
    );
  }
}

function validateOptions(
  options: SetupCandidateFactoryOptions,
): void {
  if (
    !Number.isInteger(
      options.expiresAfterSec,
    )
    || options.expiresAfterSec <= 0
  ) {
    throw new Error(
      'Setup Candidate expiration must be a positive integer',
    );
  }
}

function validateDetectedLevel(
  level: DetectedSetupLevel,
): {
  symbol: string;
  timeframe: string;
  confirmedAtMs: number;
} {
  const symbol =
    level.symbol
      .trim()
      .toUpperCase();

  if (!SYMBOL_PATTERN.test(symbol)) {
    throw new Error(
      `Invalid Setup Candidate symbol: ${level.symbol}`,
    );
  }

  const timeframe =
    level.timeframe.trim();

  if (timeframe.length === 0) {
    throw new Error(
      'Setup Candidate timeframe cannot be empty',
    );
  }

  if (level.id.trim().length === 0) {
    throw new Error(
      'Setup Candidate level id cannot be empty',
    );
  }

  if (
    level.kind !== 'support'
    && level.kind !== 'resistance'
  ) {
    throw new Error(
      `Invalid Setup Candidate level kind: ${String(level.kind)}`,
    );
  }

  validatePositivePrice(
    level.zoneLow,
    'zone low',
  );

  validatePositivePrice(
    level.zoneHigh,
    'zone high',
  );

  validatePositivePrice(
    level.centerPrice,
    'center price',
  );

  if (
    level.zoneLow > level.centerPrice
    || level.centerPrice > level.zoneHigh
  ) {
    throw new Error(
      'Setup Candidate level center must be inside its zone',
    );
  }

  if (
    !Number.isInteger(
      level.touchesCount,
    )
    || level.touchesCount < 2
  ) {
    throw new Error(
      'Setup Candidate level must contain at least two touches',
    );
  }

  if (
    level.touches.length
    !== level.touchesCount
  ) {
    throw new Error(
      'Setup Candidate touch count does not match level touches',
    );
  }

  if (
    !Number.isFinite(
      level.formationDurationSec,
    )
    || level.formationDurationSec < 0
  ) {
    throw new Error(
      'Setup Candidate formation duration must be non-negative',
    );
  }

  const firstTouchAtMs =
    validateTimestamp(
      level.firstTouchAt,
      'firstTouchAt',
    );

  const lastTouchAtMs =
    validateTimestamp(
      level.lastTouchAt,
      'lastTouchAt',
    );

  const formedAtMs =
    validateTimestamp(
      level.formedAt,
      'formedAt',
    );

  const confirmedAtMs =
    validateTimestamp(
      level.confirmedAt,
      'confirmedAt',
    );

  if (
    firstTouchAtMs > formedAtMs
    || formedAtMs > confirmedAtMs
    || confirmedAtMs > lastTouchAtMs
  ) {
    throw new Error(
      'Setup Candidate level timestamps are out of order',
    );
  }

  let previousCandleIndex =
    -1;

  let previousOccurredAtMs =
    Number.NEGATIVE_INFINITY;

  for (const touch of level.touches) {
    if (
      !Number.isInteger(
        touch.candleIndex,
      )
      || touch.candleIndex < 0
      || touch.candleIndex
        <= previousCandleIndex
    ) {
      throw new Error(
        'Setup Candidate touch indexes must increase',
      );
    }

    validatePositivePrice(
      touch.price,
      'touch price',
    );

    if (
      touch.price < level.zoneLow
      || touch.price > level.zoneHigh
    ) {
      throw new Error(
        'Setup Candidate touch price must be inside the level zone',
      );
    }

    const occurredAtMs =
      validateTimestamp(
        touch.occurredAt,
        'touch.occurredAt',
      );

    if (
      occurredAtMs
      < previousOccurredAtMs
    ) {
      throw new Error(
        'Setup Candidate touch timestamps must increase',
      );
    }

    previousCandleIndex =
      touch.candleIndex;

    previousOccurredAtMs =
      occurredAtMs;
  }

  const firstTouch =
    level.touches[0];

  const lastTouch =
    level.touches.at(-1);

  if (
    !firstTouch
    || !lastTouch
    || firstTouch.occurredAt
      !== level.firstTouchAt
    || lastTouch.occurredAt
      !== level.lastTouchAt
  ) {
    throw new Error(
      'Setup Candidate level touch boundaries do not match',
    );
  }

  return {
    symbol,
    timeframe,
    confirmedAtMs,
  };
}

function resolveDirection(
  levelKind:
    DetectedSetupLevel['kind'],
  setupType:
    SetupEngineSetupType,
): SetupDirection {
  if (
    setupType === 'level_breakout'
  ) {
    return levelKind === 'resistance'
      ? 'long'
      : 'short';
  }

  return levelKind === 'resistance'
    ? 'short'
    : 'long';
}

export function createSetupCandidate(
  level: DetectedSetupLevel,
  setupType: SetupEngineSetupType,
  currentPrice: number,
  options:
    SetupCandidateFactoryOptions =
      DEFAULT_SETUP_CANDIDATE_FACTORY_OPTIONS,
): SetupEngineState {
  validateSetupType(setupType);
  validateOptions(options);
  validatePositivePrice(
    currentPrice,
    'current price',
  );

  const {
    symbol,
    timeframe,
    confirmedAtMs,
  } = validateDetectedLevel(level);

  const expiresAtMs =
    confirmedAtMs
    + options.expiresAfterSec
      * 1_000;

  if (!Number.isFinite(expiresAtMs)) {
    throw new Error(
      'Setup Candidate expiration timestamp is invalid',
    );
  }

  return {
    id:
      `setup-${level.id}-${setupType}`,
    symbol,
    timeframe,
    setupType,
    direction:
      resolveDirection(
        level.kind,
        setupType,
      ),
    stage: 'LEVEL_CONFIRMED',
    outcome: null,
    level: {
      kind: level.kind,
      centerPrice:
        level.centerPrice,
      zoneLow:
        level.zoneLow,
      zoneHigh:
        level.zoneHigh,
      touches:
        level.touchesCount,
      confirmedAt:
        level.confirmedAt,
    },
    currentPrice,
    distanceToLevelPct:
      calculateDistanceToLevelPct(
        currentPrice,
        level.centerPrice,
      ),
    createdAt:
      level.confirmedAt,
    updatedAt:
      level.confirmedAt,
    expiresAt:
      new Date(
        expiresAtMs,
      ).toISOString(),
  };
}
