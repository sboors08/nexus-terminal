import type {
  LevelEngineKind,
  LevelEngineTimeframe,
} from './level-engine.types.js';
import type {
  LevelEngineCausalReplayCandidateTrack,
  LevelEngineCausalReplayEvent,
} from './level-engine-causal-replay.types.js';
import type {
  LevelLifecycleTransitionType,
} from './level-engine-lifecycle.types.js';
import type {
  LevelEngineLifecycleRealDataValidationReport,
  LevelEngineLifecycleRealDataValidationTotals,
  LevelEngineLifecycleValidationReviewItem,
  LevelEngineLifecycleValidationSymbolReport,
} from './level-engine-lifecycle-real-data-validation.types.js';

export const LEVEL_ENGINE_CAUSAL_REPLAY_REAL_DATA_VALIDATION_VERSION =
  'level-engine-causal-replay-real-data-validation-v0.1' as const;

export type LevelEngineCausalReplayRealDataValidationVersion =
  typeof LEVEL_ENGINE_CAUSAL_REPLAY_REAL_DATA_VALIDATION_VERSION;

export type LevelEngineCausalReplayBreakTiming =
  | 'before_break'
  | 'at_break'
  | 'after_break'
  | 'no_break'
  | 'not_observed';

export const LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES = [
  'confirmed_before_break',
  'confirmed_at_break',
  'confirmed_after_break',
  'confirmed_unbroken',
  'not_confirmed_broken',
  'not_confirmed_unbroken',
  'cycle_not_observed',
] as const;

export type LevelEngineCausalReplaySelectedCycleConfirmationState =
  typeof LEVEL_ENGINE_CAUSAL_REPLAY_SELECTED_CYCLE_CONFIRMATION_STATES[number];

export interface LevelEngineCausalReplayLagObservation {
  readonly marketOccurredAt: string;
  readonly observedAt: string;
  readonly marketCandleIndex: number;
  readonly observedCandleIndex: number;
  readonly lagBars: number;
}

export interface LevelEngineCausalReplayTransitionObservation
  extends LevelEngineCausalReplayLagObservation {
  readonly cycleId: string;
  readonly transition: LevelLifecycleTransitionType;
}

export interface LevelEngineCausalReplayLatencyStats {
  readonly sampleCount: number;
  readonly minimumBars: number | null;
  readonly medianBars: number | null;
  readonly averageBars: number | null;
  readonly maximumBars: number | null;
}


export interface LevelEngineCausalReplaySelectedCycleDiagnostic {
  readonly cycleFound: boolean;
  readonly cycleId: string;
  readonly kind: LevelEngineKind | null;
  readonly transition: LevelLifecycleTransitionType | null;
  readonly firstObservedAt: string | null;
  readonly firstObservedCandleIndex: number | null;
  readonly firstConfirmedAt: string | null;
  readonly firstConfirmedCandleIndex: number | null;
  readonly brokenAt: string | null;
  readonly firstObservedBreakTiming: LevelEngineCausalReplayBreakTiming;
  readonly confirmationState:
    LevelEngineCausalReplaySelectedCycleConfirmationState;
}

export interface LevelEngineCausalReplayReviewDiagnostic {
  readonly trackFound: boolean;
  readonly firstSeen: LevelEngineCausalReplayLagObservation | null;
  readonly firstSeenFromActiveFromBars: number | null;
  readonly firstConfirmed: LevelEngineCausalReplayLagObservation | null;
  readonly firstBreakAt: string | null;
  readonly firstSeenBreakTiming: LevelEngineCausalReplayBreakTiming;
  readonly firstConfirmedBreakTiming: LevelEngineCausalReplayBreakTiming;
  readonly detectorObservationCount: number;
  readonly disappearanceCount: number;
  readonly reappearanceCount: number;
  readonly maxDetectorTouchEpisodeCount: number;
  readonly presentAtEnd: boolean;
  readonly cycleTrackCount: number;
  readonly confirmedCycleTrackCount: number;
  readonly brokenCycleTrackCount: number;
  readonly originCycleTrackCount: number;
  readonly flipCycleTrackCount: number;
  readonly reclaimCycleTrackCount: number;
  readonly transitionObservations:
    readonly LevelEngineCausalReplayTransitionObservation[];
  readonly breakObservations:
    readonly LevelEngineCausalReplayLagObservation[];
  readonly selectedCycle:
    LevelEngineCausalReplaySelectedCycleDiagnostic;
}

export interface LevelEngineCausalReplayValidationReviewItem
  extends LevelEngineLifecycleValidationReviewItem {
  readonly causalReplayTrack:
    LevelEngineCausalReplayCandidateTrack | null;
  readonly causalReplayEvents:
    readonly LevelEngineCausalReplayEvent[];
  readonly causalReplayDiagnostic:
    LevelEngineCausalReplayReviewDiagnostic;
}

export interface LevelEngineCausalReplayDatasetSummary {
  readonly symbol: string;
  readonly sourceTimeframe: LevelEngineTimeframe;
  readonly closedCandlesCount: number;
  readonly ignoredOpenCandlesCount: number;
  readonly replayStepCount: number;
  readonly candidateTrackCount: number;
  readonly confirmedCandidateTrackCount: number;
  readonly cycleTrackCount: number;
  readonly confirmedCycleTrackCount: number;
  readonly brokenCycleTrackCount: number;
  readonly originCycleTrackCount: number;
  readonly flipCycleTrackCount: number;
  readonly reclaimCycleTrackCount: number;
  readonly candidateDisappearanceCount: number;
  readonly candidateReappearanceCount: number;
  readonly reviewItemCount: number;
  readonly reviewTrackFoundCount: number;
  readonly reviewTrackMissingCount: number;
  readonly reviewFirstSeenBeforeBreakCount: number;
  readonly reviewFirstSeenAtOrAfterBreakCount: number;
  readonly reviewFirstSeenNoBreakCount: number;
  readonly selectedCycleFirstObservedTimingCounts:
    Readonly<Record<LevelEngineCausalReplayBreakTiming, number>>;
  readonly selectedCycleConfirmationStateCounts:
    Readonly<Record<
      LevelEngineCausalReplaySelectedCycleConfirmationState,
      number
    >>;
  readonly candidateFirstSeenLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly candidateFirstSeenFromActiveFromLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly candidateConfirmedLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly originStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly flipStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly reclaimStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly breakObservationLagBars:
    LevelEngineCausalReplayLatencyStats;
}

export interface LevelEngineCausalReplayTimeframeSummary
  extends Omit<LevelEngineCausalReplayDatasetSummary, 'symbol'> {
  readonly datasetCount: number;
}

export interface LevelEngineCausalReplayValidationSymbolReport
  extends Omit<
    LevelEngineLifecycleValidationSymbolReport,
    'reviewQueue'
  > {
  readonly reviewQueue:
    readonly LevelEngineCausalReplayValidationReviewItem[];
  readonly causalReplayDatasets:
    readonly LevelEngineCausalReplayDatasetSummary[];
}

export interface LevelEngineCausalReplayRealDataValidationTotals
  extends LevelEngineLifecycleRealDataValidationTotals {
  readonly replayDatasetCount: number;
  readonly replayStepCount: number;
  readonly causalCandidateTrackCount: number;
  readonly causalConfirmedCandidateTrackCount: number;
  readonly causalCycleTrackCount: number;
  readonly causalConfirmedCycleTrackCount: number;
  readonly causalBrokenCycleTrackCount: number;
  readonly causalOriginCycleTrackCount: number;
  readonly causalFlipCycleTrackCount: number;
  readonly causalReclaimCycleTrackCount: number;
  readonly causalCandidateDisappearanceCount: number;
  readonly causalCandidateReappearanceCount: number;
  readonly reviewTrackFoundCount: number;
  readonly reviewTrackMissingCount: number;
  readonly reviewFirstSeenBeforeBreakCount: number;
  readonly reviewFirstSeenAtOrAfterBreakCount: number;
  readonly reviewFirstSeenNoBreakCount: number;
  readonly reviewFirstSeenNotObservedCount: number;
  readonly reviewFirstConfirmedBeforeBreakCount: number;
  readonly reviewFirstConfirmedAtOrAfterBreakCount: number;
  readonly reviewFirstConfirmedNoBreakCount: number;
  readonly reviewFirstConfirmedNotObservedCount: number;
  readonly selectedCycleFirstObservedTimingCounts:
    Readonly<Record<LevelEngineCausalReplayBreakTiming, number>>;
  readonly selectedCycleConfirmationStateCounts:
    Readonly<Record<
      LevelEngineCausalReplaySelectedCycleConfirmationState,
      number
    >>;
  readonly candidateFirstSeenLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly candidateFirstSeenFromActiveFromLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly candidateConfirmedLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly originStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly flipStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly reclaimStartLagBars:
    LevelEngineCausalReplayLatencyStats;
  readonly breakObservationLagBars:
    LevelEngineCausalReplayLatencyStats;
}

export interface LevelEngineCausalReplayRealDataValidationReport
  extends Omit<
    LevelEngineLifecycleRealDataValidationReport,
    'version' | 'symbolReports' | 'totals'
  > {
  readonly version:
    LevelEngineCausalReplayRealDataValidationVersion;
  readonly sourceLifecycleValidationVersion:
    LevelEngineLifecycleRealDataValidationReport['version'];
  readonly symbolReports:
    readonly LevelEngineCausalReplayValidationSymbolReport[];
  readonly timeframeCausalReplaySummaries:
    readonly LevelEngineCausalReplayTimeframeSummary[];
  readonly totals:
    LevelEngineCausalReplayRealDataValidationTotals;
  readonly usesFutureCandles: false;
  readonly reusesFetchedDatasets: true;
}
