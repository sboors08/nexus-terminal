import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2Kind,
  LevelV2ZoneGeometry,
} from './level-v2-zones-score.types.js';

export interface LevelV2LifecycleCollisionState {
  originalKind: LevelV2Kind;
  currentKind: LevelV2Kind;
  status: LevelV2LifecycleStatus;
  eligibleForSetups: boolean;
  level: {
    id: string;
    touchesCount: number;
    lastTouchCandleIndex: number;
    score: {
      total: number;
    };
    zone: Pick<
      LevelV2ZoneGeometry,
      | 'referencePrice'
      | 'outerLow'
      | 'outerHigh'
    >;
  };
}

export interface LevelV2LifecycleCollisionOptions {
  maxReferenceDistancePct: number;
  minOuterOverlapPct: number;
}

export const DEFAULT_LEVEL_V2_LIFECYCLE_COLLISION_OPTIONS:
LevelV2LifecycleCollisionOptions = {
  maxReferenceDistancePct: 0.2,
  minOuterOverlapPct: 50,
};

function round(
  value: number,
  digits = 8,
): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function validateOptions(
  options: LevelV2LifecycleCollisionOptions,
): void {
  if (
    !Number.isFinite(options.maxReferenceDistancePct)
    || options.maxReferenceDistancePct < 0
    || options.maxReferenceDistancePct > 100
  ) {
    throw new Error(
      'Level v2 lifecycle collision maxReferenceDistancePct must be from zero to one hundred',
    );
  }

  if (
    !Number.isFinite(options.minOuterOverlapPct)
    || options.minOuterOverlapPct < 0
    || options.minOuterOverlapPct > 100
  ) {
    throw new Error(
      'Level v2 lifecycle collision minOuterOverlapPct must be from zero to one hundred',
    );
  }
}

function referenceDistancePct(
  left: number,
  right: number,
): number {
  const denominator = Math.max(
    (Math.abs(left) + Math.abs(right)) / 2,
    Number.EPSILON,
  );

  return round(
    Math.abs(left - right) / denominator * 100,
  );
}

function overlapPct(
  leftLow: number,
  leftHigh: number,
  rightLow: number,
  rightHigh: number,
): number {
  const intersection = Math.max(
    0,
    Math.min(leftHigh, rightHigh)
      - Math.max(leftLow, rightLow),
  );

  const leftWidth = Math.max(
    0,
    leftHigh - leftLow,
  );

  const rightWidth = Math.max(
    0,
    rightHigh - rightLow,
  );

  const denominator = Math.min(
    leftWidth,
    rightWidth,
  );

  if (denominator <= 0) {
    return intersection === 0
      && leftLow === rightLow
      && leftHigh === rightHigh
      ? 100
      : 0;
  }

  return round(
    Math.min(
      100,
      intersection / denominator * 100,
    ),
  );
}

function isNativeFlippedCollision(
  left: LevelV2LifecycleCollisionState,
  right: LevelV2LifecycleCollisionState,
  options: LevelV2LifecycleCollisionOptions,
): boolean {
  if (left.currentKind !== right.currentKind) {
    return false;
  }

  const leftFlipped = left.status === 'flipped';
  const rightFlipped = right.status === 'flipped';

  if (leftFlipped === rightFlipped) {
    return false;
  }

  const distance = referenceDistancePct(
    left.level.zone.referencePrice,
    right.level.zone.referencePrice,
  );

  if (distance > options.maxReferenceDistancePct) {
    return false;
  }

  const overlap = overlapPct(
    left.level.zone.outerLow,
    left.level.zone.outerHigh,
    right.level.zone.outerLow,
    right.level.zone.outerHigh,
  );

  return overlap >= options.minOuterOverlapPct;
}

export function resolveLevelV2LifecycleCollisions<
  State extends LevelV2LifecycleCollisionState,
>(
  states: readonly State[],
  options:
    LevelV2LifecycleCollisionOptions =
      DEFAULT_LEVEL_V2_LIFECYCLE_COLLISION_OPTIONS,
): State[] {
  validateOptions(options);

  return states.filter((candidate, candidateIndex) => {
    if (candidate.status === 'flipped') {
      return true;
    }

    return !states.some((other, otherIndex) =>
      otherIndex !== candidateIndex
      && other.status === 'flipped'
      && isNativeFlippedCollision(
        candidate,
        other,
        options,
      ));
  });
}
