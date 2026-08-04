import type {
  LevelCandidate,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCandle,
} from './level-engine-touch-detector.types.js';
import type {
  LevelClusterRejectionReason,
  MultiTimeframeLevelDetectionResult,
} from './level-engine-multi-timeframe-detector.types.js';

export interface BinanceLevelEngineCandleRequest {
  readonly baseUrl: string;
  readonly requestTimeoutMs: number;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly limit: number;
  readonly endTime?: number;
}

export interface LevelEngineRealDataValidationConfig {
  readonly binanceBaseUrl: string;
  readonly requestTimeoutMs: number;
  readonly requestDelayMs: number;
  readonly symbols: readonly string[];
  readonly timeframes: readonly LevelEngineTimeframe[];
  readonly candlesPerTimeframe: number;
  readonly reviewLimitPerSymbol: number;
  readonly endTime?: number;
}

export interface LevelEngineValidationDatasetSnapshot {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly candles: readonly LevelEngineCandle[];
}

export interface LevelEngineValidationTimeframeSummary {
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly pivotSeedCount: number;
  readonly candidateCount: number;
  readonly confirmedCount: number;
  readonly developingCount: number;
  readonly oneTouchCandidateCount: number;
  readonly maxTouchEpisodeCount: number;
  readonly candidatesPer100ClosedCandles: number;
  readonly rejectedClusterCount: number;
  readonly rejectedClustersByReason:
    Readonly<Record<LevelClusterRejectionReason, number>>;
}

export type LevelEngineManualReviewLabel =
  | 'good'
  | 'borderline'
  | 'junk'
  | 'flip'
  | 'broken'
  | 'single_candle_false_level';

export type LevelEngineValidationReviewState =
  | 'active'
  | 'broken'
  | 'stale'
  | 'pending';

export type LevelEngineValidationBreakMode =
  | 'decisive_body_break'
  | 'consecutive_closes';

export interface LevelEngineValidationReviewPolicy {
  readonly atrPeriod: number;
  readonly decisiveBreakAtr: number;
  readonly consecutiveBreakCloses: number;
  readonly staleAfterBars: number;
  readonly staleDistanceAtr: number;
  readonly minimumFutureBars: number;
}

export interface LevelEngineValidationBreakEvidence {
  readonly mode: LevelEngineValidationBreakMode;
  readonly candleIndex: number;
  readonly brokenAt: string;
  readonly boundary: number;
  readonly close: number;
  readonly distanceBeyondBoundary: number;
  readonly distanceBeyondBoundaryAtr: number | null;
}

export interface LevelEngineValidationReviewDiagnostic {
  readonly state: LevelEngineValidationReviewState;
  readonly futureClosedCandlesCount: number;
  readonly firstFutureCandleIndex: number | null;
  readonly lastClosedCandleIndex: number | null;
  readonly lastClosedAt: string | null;
  readonly currentPrice: number | null;
  readonly currentAtr: number | null;
  readonly distanceFromZone: number | null;
  readonly distanceFromZoneAtr: number | null;
  readonly lastInteractionCandleIndex: number | null;
  readonly lastInteractionAt: string | null;
  readonly barsSinceLastInteraction: number | null;
  readonly breakEvidence: LevelEngineValidationBreakEvidence | null;
}

export interface LevelEngineValidationReviewItem {
  readonly reviewOrder: number;
  readonly candidate: LevelCandidate;
  readonly diagnostic: LevelEngineValidationReviewDiagnostic;
  readonly manualLabel: LevelEngineManualReviewLabel | null;
  readonly manualNote: string | null;
}

export interface LevelEngineSymbolValidationReport {
  readonly symbol: string;
  readonly datasets: readonly LevelEngineValidationDatasetSnapshot[];
  readonly detection: MultiTimeframeLevelDetectionResult;
  readonly timeframeSummaries:
    readonly LevelEngineValidationTimeframeSummary[];
  readonly reviewQueue: readonly LevelEngineValidationReviewItem[];
}

export interface LevelEngineRealDataValidationTotals {
  readonly symbolCount: number;
  readonly timeframeDatasetCount: number;
  readonly candleCount: number;
  readonly candidateCount: number;
  readonly confirmedCount: number;
  readonly reviewItemCount: number;
  readonly reviewStateCounts:
    Readonly<Record<LevelEngineValidationReviewState, number>>;
}

export interface LevelEngineRealDataValidationReport {
  readonly version: 'level-engine-real-data-validation-v0.1';
  readonly reviewDiagnosticsVersion:
    'level-engine-review-diagnostics-v0.1';
  readonly generatedAt: string;
  readonly binanceBaseUrl: string;
  readonly requestedSymbols: readonly string[];
  readonly requestedTimeframes: readonly LevelEngineTimeframe[];
  readonly candlesPerTimeframe: number;
  readonly reviewLimitPerSymbol: number;
  readonly reviewPolicy: LevelEngineValidationReviewPolicy;
  readonly symbolReports: readonly LevelEngineSymbolValidationReport[];
  readonly totals: LevelEngineRealDataValidationTotals;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesAcrossTimeframes: false;
  readonly usesQualityScore: false;
}
