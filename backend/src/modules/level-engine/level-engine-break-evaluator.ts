import type { LevelEngineKind, LevelEngineZone } from './level-engine.types.js';
import type { LevelEngineCandle } from './level-engine-touch-detector.types.js';
import type {
  LevelEngineConfirmedBreakCandle,
  LevelEngineConfirmedBreakEvidence,
  LevelEngineConfirmedBreakPolicy,
  LevelEngineConfirmedBreakSearchWindow,
  LevelEngineConfirmedBreakTarget,
} from './level-engine-break-evaluator.types.js';

export const LEVEL_ENGINE_BREAK_SEARCH_WINDOWS = Object.freeze({
  lifecycle: 'cycle_active_from_exclusive_to_observation_inclusive',
  review: 'candidate_detected_at_exclusive_to_dataset_end_inclusive',
} as const);

function fail(message: string): never {
  throw new Error(`Level Engine Break Evaluator: ${message}`);
}

function validatePolicy(
  value: LevelEngineConfirmedBreakPolicy,
): LevelEngineConfirmedBreakPolicy {
  if (!Number.isFinite(value.decisiveBreakAtr) || value.decisiveBreakAtr <= 0) {
    fail('decisiveBreakAtr must be a positive finite number');
  }
  if (!Number.isInteger(value.consecutiveBreakCloses)
    || value.consecutiveBreakCloses <= 0) {
    fail('consecutiveBreakCloses must be a positive integer');
  }
  return Object.freeze({
    decisiveBreakAtr: value.decisiveBreakAtr,
    consecutiveBreakCloses: value.consecutiveBreakCloses,
  });
}

function validateWindow(
  value: LevelEngineConfirmedBreakSearchWindow,
): LevelEngineConfirmedBreakSearchWindow {
  if (!Number.isFinite(value.afterExclusiveMs)) {
    fail('afterExclusiveMs must be finite');
  }
  if (!Number.isFinite(value.throughInclusiveMs)
    && value.throughInclusiveMs !== Number.POSITIVE_INFINITY) {
    fail('throughInclusiveMs must be finite or positive infinity');
  }
  if (value.throughInclusiveMs < value.afterExclusiveMs) {
    fail('throughInclusiveMs cannot precede afterExclusiveMs');
  }
  return Object.freeze({ ...value });
}

function closesBeyond(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? candle.close < zone.low
    : candle.close > zone.high;
}

function bodyBeyond(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): boolean {
  return kind === 'support'
    ? Math.max(candle.open, candle.close) < zone.low
    : Math.min(candle.open, candle.close) > zone.high;
}

function boundary(
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): number {
  return kind === 'support' ? zone.low : zone.high;
}

function distance(
  candle: LevelEngineCandle,
  zone: LevelEngineZone,
  kind: LevelEngineKind,
): number {
  return kind === 'support'
    ? zone.low - candle.close
    : candle.close - zone.high;
}

export function findConfirmedLevelEngineBreak(
  candles: readonly LevelEngineConfirmedBreakCandle[],
  target: LevelEngineConfirmedBreakTarget,
  windowValue: LevelEngineConfirmedBreakSearchWindow,
  policyValue: LevelEngineConfirmedBreakPolicy,
): LevelEngineConfirmedBreakEvidence | null {
  const window = validateWindow(windowValue);
  const policy = validatePolicy(policyValue);
  let consecutiveBeyondCloses = 0;

  for (const indexed of candles) {
    if (!indexed.candle.isClosed) {
      continue;
    }
    const closedAtMs = Date.parse(indexed.candle.closeTime);
    if (!Number.isFinite(closedAtMs)) {
      fail(`candle ${indexed.candleIndex} closeTime must be valid`);
    }
    if (closedAtMs <= window.afterExclusiveMs) {
      continue;
    }
    if (closedAtMs > window.throughInclusiveMs) {
      break;
    }
    if (!closesBeyond(indexed.candle, target.zone, target.kind)) {
      consecutiveBeyondCloses = 0;
      continue;
    }

    consecutiveBeyondCloses += 1;
    const rawDistance = distance(indexed.candle, target.zone, target.kind);
    const distanceAtr = indexed.atr !== null
      && Number.isFinite(indexed.atr)
      && indexed.atr > 0
      ? rawDistance / indexed.atr
      : null;
    const decisive = bodyBeyond(
      indexed.candle,
      target.zone,
      target.kind,
    ) && distanceAtr !== null
      && distanceAtr >= policy.decisiveBreakAtr;
    const consecutive =
      consecutiveBeyondCloses >= policy.consecutiveBreakCloses;

    if (!decisive && !consecutive) {
      continue;
    }

    return Object.freeze({
      mode: decisive ? 'decisive_body_break' : 'consecutive_closes',
      fromKind: target.kind,
      candleIndex: indexed.candleIndex,
      brokenAt: new Date(closedAtMs).toISOString(),
      boundary: boundary(target.zone, target.kind),
      close: indexed.candle.close,
      distanceBeyondBoundary: rawDistance,
      distanceBeyondBoundaryAtr: distanceAtr,
    });
  }

  return null;
}
