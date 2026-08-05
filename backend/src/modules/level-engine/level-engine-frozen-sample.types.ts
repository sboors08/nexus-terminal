import type {
  LevelEngineKind,
  LevelEngineMaturity,
  LevelEngineTimeframe,
  LevelEngineZone,
} from './level-engine.types.js';
import type {
  LevelEngineValidationDatasetSnapshot,
  LevelEngineValidationReviewState,
} from './level-engine-real-data-validation.types.js';
import type {
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';
import type {
  LevelEngineCausalReplayRealDataValidationReport,
  LevelEngineCausalReplayValidationReviewItem,
} from './level-engine-causal-replay-real-data-validation.types.js';

export const LEVEL_ENGINE_FROZEN_SAMPLE_VERSION =
  'level-engine-frozen-sample-v0.1' as const;

export const LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS = [
  'source_detected_late_or_post_break',
  'causal_track_missing',
  'detector_disappeared',
  'detector_reappeared',
  'selected_cycle_not_current',
  'selected_cycle_role_changed',
  'source_touch_history_discarded',
  'selected_cycle_broke_before_confirmation',
  'selected_cycle_confirmed_at_or_after_break',
  'selected_cycle_not_observed',
] as const;

export type LevelEngineFrozenSampleVersion =
  typeof LEVEL_ENGINE_FROZEN_SAMPLE_VERSION;

export type LevelEngineFrozenSampleDiagnosticFlag =
  typeof LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS[number];

export interface BuildLevelEngineFrozenSampleOptions {
  readonly limit?: number;
}

export interface LevelEngineFrozenSampleDataset
  extends LevelEngineValidationDatasetSnapshot {
  readonly key: string;
}

export interface LevelEngineFrozenSampleSelection {
  readonly strategy:
    'round_robin_symbol_timeframe_then_review_order';
  readonly requestedLimit: number;
  readonly availableItemCount: number;
  readonly selectedItemCount: number;
  readonly omittedItemCount: number;
  readonly datasetCount: number;
  readonly complete: boolean;
}

export interface LevelEngineFrozenSampleItem {
  readonly id: string;
  readonly selectionIndex: number;
  readonly datasetKey: string;
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly sourceCandidateId: string;
  readonly selectedCandidateId: string;
  readonly sourceKind: LevelEngineKind;
  readonly selectedKind: LevelEngineKind;
  readonly selectedMaturity: LevelEngineMaturity;
  readonly selectedTransition: LevelLifecycleTransitionType;
  readonly reviewState: LevelEngineValidationReviewState;
  readonly selectedZone: LevelEngineZone;
  readonly sourceActiveFrom: string;
  readonly sourceDetectedAt: string;
  readonly selectedActiveFrom: string;
  readonly selectedDetectedAt: string;
  readonly diagnosticFlags:
    readonly LevelEngineFrozenSampleDiagnosticFlag[];
  readonly reviewItem:
    LevelEngineCausalReplayValidationReviewItem;
}

export interface LevelEngineFrozenSampleCounts {
  readonly bySymbol: Readonly<Record<string, number>>;
  readonly byTimeframe: Readonly<Record<string, number>>;
  readonly byReviewState: Readonly<Record<string, number>>;
  readonly byTransition: Readonly<Record<string, number>>;
  readonly bySelectedCycleConfirmationState:
    Readonly<Record<string, number>>;
  readonly byDiagnosticFlag:
    Readonly<Record<LevelEngineFrozenSampleDiagnosticFlag, number>>;
}

export interface LevelEngineFrozenSample {
  readonly id: string;
  readonly version: LevelEngineFrozenSampleVersion;
  readonly sourceReportVersion:
    LevelEngineCausalReplayRealDataValidationReport['version'];
  readonly generatedAt: string;
  readonly requestedSymbols: readonly string[];
  readonly requestedTimeframes:
    readonly LevelEngineTimeframe[];
  readonly appliedOptions:
    LevelEngineCausalReplayRealDataValidationReport['appliedOptions'];
  readonly selection: LevelEngineFrozenSampleSelection;
  readonly datasets: readonly LevelEngineFrozenSampleDataset[];
  readonly items: readonly LevelEngineFrozenSampleItem[];
  readonly counts: LevelEngineFrozenSampleCounts;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesAcrossTimeframes: false;
  readonly usesQualityScore: false;
  readonly usesFutureCandles: false;
  readonly intendedForManualReview: true;
}
