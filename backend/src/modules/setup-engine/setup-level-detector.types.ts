export type SetupLevelKind =
  | 'support'
  | 'resistance';

export interface SetupLevelDetectorCandle {
  openTime: string;
  closeTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  isClosed: boolean;
}

export interface SetupLevelDetectorOptions {
  pivotWindow: number;
  minTouches: number;
  minTouchSpacingCandles: number;
  maxDistancePct: number;
  zonePaddingPct: number;
}

export interface SetupLevelTouch {
  candleIndex: number;
  price: number;
  occurredAt: string;
}

export interface DetectedSetupLevel {
  id: string;
  symbol: string;
  timeframe: string;
  kind: SetupLevelKind;
  zoneLow: number;
  zoneHigh: number;
  centerPrice: number;
  touchesCount: number;
  firstTouchAt: string;
  lastTouchAt: string;
  formedAt: string;
  confirmedAt: string;
  formationDurationSec: number;
  touches: readonly SetupLevelTouch[];
}
