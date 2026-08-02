import type {
  LevelV2DetectedZone,
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2BreakClassificationStatus =
  | 'idle'
  | 'pierce'
  | 'breakout_pending'
  | 'breakout_confirmed'
  | 'false_breakout';

export type LevelV2BreakClassificationEventType =
  | 'registered'
  | 'pierce_detected'
  | 'breakout_pending'
  | 'breakout_confirmed'
  | 'breakout_reset'
  | 'false_breakout';

export type LevelV2BreakClassificationReason =
  | 'initial_idle'
  | 'wick_beyond_zone'
  | 'acceptance_close'
  | 'acceptance_confirmed'
  | 'acceptance_sequence_broken'
  | 'returned_inside_zone'
  | 'quick_return_inside_zone';

export interface LevelV2BreakClassificationOptions {
  acceptanceClosesRequired: number;
  acceptanceBufferPct: number;
  falseBreakoutMaxCandles: number;
  maxEventsPerLevel: number;
}

export interface LevelV2BreakClassificationObservation {
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

export interface LevelV2BreakClassificationEvidence {
  open: number;
  high: number;
  low: number;
  close: number;
  boundaryPrice: number;
  acceptanceThresholdPrice: number;
  penetrationPrice: number;
  penetrationDepthPct: number;
  maxPenetrationDepthPct: number;
  penetrated: boolean;
  acceptanceClose: boolean;
  returnedInsideZone: boolean;
  acceptanceClosesCount: number;
  acceptanceClosesRequired: number;
}

export interface LevelV2BreakClassificationEvent {
  id: string;
  classifierId: string;
  levelId: string;
  type: LevelV2BreakClassificationEventType;
  reason: LevelV2BreakClassificationReason;
  fromStatus: LevelV2BreakClassificationStatus | null;
  toStatus: LevelV2BreakClassificationStatus;
  occurredAt: string;
  candleIndex: number;
  sequence: number;
  evidence: LevelV2BreakClassificationEvidence | null;
}

export interface LevelV2BreakClassificationState {
  id: string;
  level: LevelV2DetectedZone;
  currentKind: LevelV2Kind;
  status: LevelV2BreakClassificationStatus;
  registeredAt: string;
  registeredCandleIndex: number;
  episodeStartedAt: string | null;
  episodeStartedCandleIndex: number | null;
  maxPenetrationDepthPct: number;
  acceptanceClosesCount: number;
  firstAcceptanceAt: string | null;
  firstAcceptanceCandleIndex: number | null;
  lastAcceptanceAt: string | null;
  lastAcceptanceCandleIndex: number | null;
  breakoutConfirmedAt: string | null;
  breakoutConfirmedCandleIndex: number | null;
  falseBreakoutAt: string | null;
  falseBreakoutCandleIndex: number | null;
  lastProcessedCandleIndex: number;
  lastProcessedCloseTime: string;
  transitionSequence: number;
  events: readonly LevelV2BreakClassificationEvent[];
}

export interface LevelV2BreakClassificationRegistration {
  state: LevelV2BreakClassificationState;
  event: LevelV2BreakClassificationEvent;
}

export interface LevelV2BreakClassificationEvaluation {
  state: LevelV2BreakClassificationState;
  event: LevelV2BreakClassificationEvent | null;
}
