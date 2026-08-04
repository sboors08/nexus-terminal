import type {
  LevelEngineKind,
  LevelEngineTimeframe,
  LevelEngineZone,
  TouchEpisode,
} from './level-engine.types.js';

export interface LevelEngineCandle {
  readonly openTime: string;
  readonly closeTime: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly isClosed: boolean;
}

export interface TouchEpisodeDetectionTarget {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly zone: LevelEngineZone;
}

export interface TouchEpisodeDetectionOptions {
  readonly atrPeriod: number;
  readonly minDepartureAtr: number;
  readonly maxDepartureCandles: number;
  readonly minBarsBetweenEpisodes: number;
  readonly maxEpisodeSpanCandles: number;
}

export type TouchInteractionRejectionReason =
  | 'missing_atr'
  | 'insufficient_departure'
  | 'insufficient_time_separation'
  | 'wrong_side_break'
  | 'prolonged_zone_chop';

export interface RejectedTouchInteraction {
  readonly startCandleIndex: number;
  readonly endCandleIndex: number;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly reason: TouchInteractionRejectionReason;
}

export interface PendingTouchInteraction {
  readonly startCandleIndex: number;
  readonly lastContactCandleIndex: number;
  readonly startedAt: string;
  readonly lastContactAt: string;
  readonly status: 'awaiting_departure_confirmation';
}

export interface TouchEpisodeDetectionResult {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly zone: LevelEngineZone;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly episodes: readonly TouchEpisode[];
  readonly rejectedInteractions: readonly RejectedTouchInteraction[];
  readonly pendingInteraction: PendingTouchInteraction | null;
  readonly observationalOnly: true;
  readonly createsSetup: false;
}
