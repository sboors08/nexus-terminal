export type LevelV2ExtremumKind =
  | 'swing_high'
  | 'swing_low';

export interface LevelV2Candle {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  baseVolume: number | null;
  quoteVolume: number | null;
  tradesCount: number | null;
  isClosed: boolean;
}

export interface LevelV2FoundationOptions {
  atrPeriod: number;
  swingLeftCandles: number;
  swingRightCandles: number;
  minReactionAtr: number;
  maxReactionLookaheadCandles: number;
  plateauToleranceAtr: number;
  maxPlateauWidthCandles: number;
  maxTouchMergeCandles: number;
  touchMergeToleranceAtr: number;
}

export interface LevelV2AtrPoint {
  candleIndex: number;
  trueRange: number;
  atr: number | null;
}

export interface LevelV2Extremum {
  id: string;
  kind: LevelV2ExtremumKind;
  candleIndex: number;
  segmentStartIndex: number;
  segmentEndIndex: number;
  occurredAt: string;
  confirmedAt: string;
  extremePrice: number;
  atr: number;
  reactionDistance: number;
  reactionAtr: number;
  reactionDurationCandles: number;
  leftProminenceAtr: number;
  rightProminenceAtr: number;
  qualityScore: number;
}

export interface LevelV2TouchEvent {
  id: string;
  kind: LevelV2ExtremumKind;
  extremumIds: readonly string[];
  representativeExtremumId: string;
  firstCandleIndex: number;
  lastCandleIndex: number;
  occurredAt: string;
  extremePrice: number;
  qualityScore: number;
}

export interface LevelV2FoundationResult {
  closedCandlesCount: number;
  atr: readonly LevelV2AtrPoint[];
  extrema: readonly LevelV2Extremum[];
  touchEvents: readonly LevelV2TouchEvent[];
}
