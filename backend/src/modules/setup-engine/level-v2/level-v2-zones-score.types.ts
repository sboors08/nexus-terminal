import type {
  LevelV2FoundationResult,
  LevelV2TouchEvent,
} from './level-v2.types.js';

export type LevelV2Kind =
  | 'support'
  | 'resistance';

export type LevelV2ZoneRejectionCode =
  | 'insufficient_touches'
  | 'acceptance_zone'
  | 'structure_midrange'
  | 'score_below_threshold';

export interface LevelV2ZonesScoreOptions {
  minTouches: number;
  minTouchSpacingCandles: number;
  clusterToleranceAtr: number;
  maxClusterTolerancePct: number;
  corePaddingAtr: number;
  outerPaddingAtr: number;
  liquidityPaddingAtr: number;
  acceptanceWindowCandles: number;
  maxClosesInsideRatio: number;
  maxCrossingsCount: number;
  minStructureEdgePosition: number;
  minLevelScore: number;
  freshnessHalfLifeCandles: number;
}

export interface LevelV2ZoneGeometry {
  referencePrice: number;
  coreLow: number;
  coreHigh: number;
  outerLow: number;
  outerHigh: number;
  liquidityLow: number;
  liquidityHigh: number;
  widthPct: number;
  widthAtr: number;
}

export interface LevelV2Cleanliness {
  closesInsideRatio: number;
  closesAboveRatio: number;
  closesBelowRatio: number;
  crossingsCount: number;
  timeInsideCandles: number;
  rangeEdgePosition: number;
  isAcceptanceZone: boolean;
}

export interface LevelV2Score {
  total: number;
  touches: number;
  reactions: number;
  cleanliness: number;
  spacing: number;
  freshness: number;
  precision: number;
  structureEdge: number;
}

export interface LevelV2DetectedZone {
  id: string;
  version: 2;
  symbol: string;
  timeframe: string;
  kind: LevelV2Kind;
  sourceKind: LevelV2TouchEvent['kind'];
  zone: LevelV2ZoneGeometry;
  touches: readonly LevelV2TouchEvent[];
  touchesCount: number;
  firstTouchAt: string;
  lastTouchAt: string;
  firstTouchCandleIndex: number;
  lastTouchCandleIndex: number;
  cleanliness: LevelV2Cleanliness;
  score: LevelV2Score;
}

export interface LevelV2RejectedZone {
  id: string;
  kind: LevelV2Kind;
  touches: readonly LevelV2TouchEvent[];
  zone: LevelV2ZoneGeometry;
  cleanliness: LevelV2Cleanliness;
  score: LevelV2Score;
  reasons: readonly LevelV2ZoneRejectionCode[];
}

export interface LevelV2ZonesScoreResult {
  foundation: LevelV2FoundationResult;
  levels: readonly LevelV2DetectedZone[];
  rejected: readonly LevelV2RejectedZone[];
}
