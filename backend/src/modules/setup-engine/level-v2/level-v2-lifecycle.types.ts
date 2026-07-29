import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2LifecycleStatus =
  | 'forming'
  | 'active'
  | 'testing'
  | 'broken'
  | 'retest_pending'
  | 'flipped'
  | 'expired';

export type LevelV2LifecycleEventType =
  | 'registered'
  | 'test_started'
  | 'test_rejected'
  | 'activated'
  | 'test_timeout'
  | 'break_progress'
  | 'broken'
  | 'retest_pending'
  | 'retest_started'
  | 'flipped'
  | 'expired';

export type LevelV2LifecycleReason =
  | 'initial_forming'
  | 'initial_active'
  | 'zone_touched'
  | 'reaction_confirmed'
  | 'testing_window_elapsed'
  | 'acceptance_close'
  | 'acceptance_confirmed'
  | 'moved_away_after_break'
  | 'retest_touch'
  | 'retest_reaction_confirmed'
  | 'active_age_exceeded'
  | 'retest_age_exceeded';

export interface LevelV2LifecycleOptions {
  minActiveTouches: number;
  minTouchSpacingCandles: number;
  breakoutClosesRequired: number;
  breakoutConfirmationPct: number;
  reactionConfirmationPct: number;
  maxTestingCandles: number;
  maxActiveAgeCandles: number;
  maxRetestWaitCandles: number;
}

export interface LevelV2LifecycleObservation {
  symbol: string;
  timeframe: string;
  candleIndex: number;
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed: boolean;
}

export interface LevelV2LifecycleState {
  id: string;
  level: LevelV2DetectedZone;
  originalKind: LevelV2Kind;
  currentKind: LevelV2Kind;
  status: LevelV2LifecycleStatus;
  qualifiedTouchesCount: number;
  lastQualifiedTouchCandleIndex: number;
  eligibleForSetups: boolean;
  registeredAt: string;
  registeredCandleIndex: number;
  lineStartCandleIndex: number;
  lineEndCandleIndex: number | null;
  lineEndAt: string | null;
  testOriginStatus: 'forming' | 'active' | null;
  testingStartedCandleIndex: number | null;
  testingStartedAt: string | null;
  testingTouchCandleIndex: number | null;
  breakClosesCount: number;
  breakFirstCandleIndex: number | null;
  breakFirstAt: string | null;
  brokenCandleIndex: number | null;
  brokenAt: string | null;
  breakConfirmedAt: string | null;
  retestStartedCandleIndex: number | null;
  retestStartedAt: string | null;
  flippedCandleIndex: number | null;
  flippedAt: string | null;
  flippedLineStartCandleIndex: number | null;
  expiredCandleIndex: number | null;
  expiredAt: string | null;
  lastProcessedCandleIndex: number;
  lastProcessedCloseTime: string;
  transitionSequence: number;
}

export interface LevelV2LifecycleEvent {
  id: string;
  levelId: string;
  type: LevelV2LifecycleEventType;
  reason: LevelV2LifecycleReason;
  fromStatus: LevelV2LifecycleStatus | null;
  toStatus: LevelV2LifecycleStatus;
  occurredAt: string;
  candleIndex: number;
  sequence: number;
  eligibleForSetups: boolean;
}

export interface LevelV2LifecycleEvaluation {
  state: LevelV2LifecycleState;
  event: LevelV2LifecycleEvent | null;
}

export interface LevelV2LifecycleRegistration {
  state: LevelV2LifecycleState;
  event: LevelV2LifecycleEvent;
}
