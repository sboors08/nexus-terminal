import type {
  LevelCandidate,
} from './level-engine.types.js';
import type {
  LevelLifecycleResult,
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';
import type {
  LevelEngineManualReviewLabel,
  LevelEngineRealDataValidationReport,
  LevelEngineRealDataValidationTotals,
  LevelEngineSymbolValidationReport,
  LevelEngineValidationReviewDiagnostic,
  LevelEngineValidationReviewState,
} from './level-engine-real-data-validation.types.js';

export const LEVEL_ENGINE_LIFECYCLE_REAL_DATA_VALIDATION_VERSION =
  'level-engine-lifecycle-real-data-validation-v0.1' as const;

export type LevelEngineLifecycleRealDataValidationVersion =
  typeof LEVEL_ENGINE_LIFECYCLE_REAL_DATA_VALIDATION_VERSION;

export interface LevelEngineLifecycleReviewDiagnostic {
  readonly selectedCycleId: string;
  readonly selectedCycleSequence: number;
  readonly selectedTransition: LevelLifecycleTransitionType;
  readonly selectedCycleIsCurrent: boolean;
  readonly sourceTouchEpisodeCount: number;
  readonly selectedCycleTouchEpisodeCount: number;
  readonly retainedSourceTouchEpisodeCount: number;
  readonly discardedSourceTouchEpisodeCount: number;
  readonly lifecycleCycleCount: number;
  readonly lifecycleBreakCount: number;
  readonly lifecycleFlipCount: number;
  readonly lifecycleReclaimCount: number;
  readonly ignoredLifecycleEpisodeCount: number;
  readonly firstBreakAt: string | null;
  readonly sourceDetectedBeforeFirstBreak: boolean | null;
}

export interface LevelEngineLifecycleValidationReviewItem {
  readonly reviewOrder: number;
  readonly sourceCandidate: LevelCandidate;
  readonly candidate: LevelCandidate;
  readonly sourceDiagnostic: LevelEngineValidationReviewDiagnostic;
  readonly diagnostic: LevelEngineValidationReviewDiagnostic;
  readonly lifecycle: LevelLifecycleResult;
  readonly lifecycleDiagnostic: LevelEngineLifecycleReviewDiagnostic;
  readonly manualLabel: LevelEngineManualReviewLabel | null;
  readonly manualNote: string | null;
}

export interface LevelEngineLifecycleValidationSymbolReport
  extends Omit<LevelEngineSymbolValidationReport, 'reviewQueue'> {
  readonly reviewQueue:
    readonly LevelEngineLifecycleValidationReviewItem[];
}

export interface LevelEngineLifecycleRealDataValidationTotals
  extends LevelEngineRealDataValidationTotals {
  readonly sourceReviewStateCounts:
    Readonly<Record<LevelEngineValidationReviewState, number>>;
  readonly lifecycleCycleCount: number;
  readonly lifecycleBreakCount: number;
  readonly lifecycleFlipCount: number;
  readonly lifecycleReclaimCount: number;
  readonly ignoredLifecycleEpisodeCount: number;
  readonly currentLifecycleCycleCount: number;
  readonly terminalBrokenLifecycleCount: number;
  readonly sourceTouchEpisodeCount: number;
  readonly selectedCycleTouchEpisodeCount: number;
  readonly retainedSourceTouchEpisodeCount: number;
  readonly discardedSourceTouchEpisodeCount: number;
  readonly transitionCounts:
    Readonly<Record<LevelLifecycleTransitionType, number>>;
  readonly preBreakDetectionCount: number;
  readonly lateOrPostBreakDetectionCount: number;
  readonly noBreakObservedCount: number;
}

export interface LevelEngineLifecycleRealDataValidationReport
  extends Omit<
    LevelEngineRealDataValidationReport,
    'version' | 'symbolReports' | 'totals'
  > {
  readonly version: LevelEngineLifecycleRealDataValidationVersion;
  readonly sourceValidationVersion:
    LevelEngineRealDataValidationReport['version'];
  readonly symbolReports:
    readonly LevelEngineLifecycleValidationSymbolReport[];
  readonly totals: LevelEngineLifecycleRealDataValidationTotals;
}
