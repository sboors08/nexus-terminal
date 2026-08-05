import type { LevelEngineKind, LevelEngineZone } from './level-engine.types.js';
import type { LevelEngineCandle } from './level-engine-touch-detector.types.js';

export interface LevelEngineConfirmedBreakPolicy {
  readonly decisiveBreakAtr: number;
  readonly consecutiveBreakCloses: number;
}

export interface LevelEngineConfirmedBreakCandle {
  readonly candleIndex: number;
  readonly candle: LevelEngineCandle;
  readonly atr: number | null;
}

export interface LevelEngineConfirmedBreakEvidence {
  readonly mode: 'decisive_body_break' | 'consecutive_closes';
  readonly fromKind: LevelEngineKind;
  readonly candleIndex: number;
  readonly brokenAt: string;
  readonly boundary: number;
  readonly close: number;
  readonly distanceBeyondBoundary: number;
  readonly distanceBeyondBoundaryAtr: number | null;
}

export interface LevelEngineConfirmedBreakTarget {
  readonly zone: LevelEngineZone;
  readonly kind: LevelEngineKind;
}

export interface LevelEngineConfirmedBreakSearchWindow {
  readonly afterExclusiveMs: number;
  readonly throughInclusiveMs: number;
}
