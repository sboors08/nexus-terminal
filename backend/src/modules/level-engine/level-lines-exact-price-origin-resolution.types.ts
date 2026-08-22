import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelLine,
  LevelLineStatus,
} from './level-lines.types.js';

export const LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION =
  'level-lines-exact-price-origin-resolution-v0.1' as const;

export type LevelLinesExactPriceOriginResolutionVersion =
  typeof LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_VERSION;

export type LevelLinesExactPriceOriginResolutionAction =
  | 'reuse_active_exact_price_identity'
  | 'retire_worked_identity_before_rearm';

export interface LevelLinesExactPriceOriginResolutionDecision {
  readonly key: string;
  readonly groupKey: string;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly kind: LevelEngineKind;
  readonly price: number;
  readonly olderLineId: string;
  readonly newerLineId: string;
  readonly olderStatusAtResolution: LevelLineStatus;
  readonly action:
    LevelLinesExactPriceOriginResolutionAction;
  readonly effectiveAt: string;
  readonly currentLineId: string;
  readonly suppressedCurrentLineId: string;
  readonly retainedHistoryLineId: string;
  readonly rationale: readonly string[];
}

export interface LevelLinesExactPriceOriginResolutionTotals {
  readonly historyLineCount: number;
  readonly inputCurrentLineCount: number;
  readonly resolvedCurrentLineCount: number;
  readonly exactPriceGroupCount: number;
  readonly collisionGroupCount: number;
  readonly decisionCount: number;
  readonly activeIdentityReuseCount: number;
  readonly workedIdentityRearmCount: number;
  readonly suppressedCurrentLineCount: number;
  readonly retainedHistoryLineCount: number;
}

export interface LevelLinesExactPriceOriginResolutionResult {
  readonly version:
    LevelLinesExactPriceOriginResolutionVersion;
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly currentLevels: readonly LevelLine[];
  readonly decisions:
    readonly LevelLinesExactPriceOriginResolutionDecision[];
  readonly totals:
    LevelLinesExactPriceOriginResolutionTotals;
  readonly preservesFullHistory: true;
  readonly usesExactPriceOnly: true;
  readonly mergesNearbyPrices: false;
  readonly changesTradingRules: false;
  readonly createsSetup: false;
  readonly createsSignal: false;
  readonly createsTradeOrder: false;
  readonly usesFutureCandles: false;
}

export interface LevelLinesExactPriceOriginResolutionInput {
  readonly symbol: string;
  readonly timeframe: LevelEngineTimeframe;
  readonly lines: readonly LevelLine[];
  readonly currentLevels: readonly LevelLine[];
  readonly currentLevelVisibleFrom:
    Readonly<Record<string, string>>;
}
