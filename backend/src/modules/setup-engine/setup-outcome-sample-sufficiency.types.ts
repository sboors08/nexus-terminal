import type {
  SetupDirection,
  SetupEngineSetupType,
} from './setup-engine.types.js';

import type {
  SetupOutcomeDatasetValidationStatus,
  SetupOutcomeTerminalEventType,
} from './setup-outcome-dataset-validation.types.js';

export const SETUP_OUTCOME_SAMPLE_SUFFICIENCY_VERSION =
  'setup-outcome-sample-sufficiency-v0.1' as const;

export type SetupOutcomeSampleSufficiencyStatus =
  | 'blocked_data_integrity'
  | 'insufficient_total_sample'
  | 'insufficient_cohort_sample'
  | 'sufficient_for_next_research_stage';

export type SetupOutcomeSampleSufficiencyBlocker =
  | 'history_snapshot_inconsistent'
  | 'dropped_history_events'
  | 'multiple_terminal_events'
  | 'insufficient_candle_coverage'
  | 'market_history_error'
  | 'measured_count_mismatch'
  | 'incomplete_measured_history'
  | 'measured_without_metrics'
  | 'source_safety_contract_violation';

export interface SetupOutcomeSampleCohortDefinition {
  setupType:
    SetupEngineSetupType;

  direction:
    SetupDirection;
}

export interface SetupOutcomeSampleSufficiencyPolicy {
  minimumMeasuredTotal:
    number;

  minimumMeasuredPerCohort:
    number;

  requiredCohorts:
    readonly SetupOutcomeSampleCohortDefinition[];
}

export interface SetupOutcomeSampleCohortSummary
extends SetupOutcomeSampleCohortDefinition {
  key: string;

  measuredCount:
    number;

  minimumRequired:
    number;

  shortfall:
    number;

  sufficient:
    boolean;
}

export interface SetupOutcomeSampleDimensionCount {
  key: string;

  measuredCount:
    number;
}

export interface SetupOutcomeSampleSufficiencyDiagnostics {
  sourceMeasuredCandidatesCount:
    number;

  measuredItemsCount:
    number;

  eligibleMeasuredCandidatesCount:
    number;

  incompleteMeasuredHistoryCount:
    number;

  measuredWithoutMetricsCount:
    number;

  measuredCountMismatch:
    boolean;

  droppedEventsCount:
    number;

  multipleTerminalEventsCount:
    number;

  insufficientCandleCoverageCount:
    number;

  marketHistoryErrorCount:
    number;

  pendingWindowCandidatesCount:
    number;

  missingThirdTouchAnchorCount:
    number;

  safetyContractViolationCount:
    number;

  blockers:
    readonly SetupOutcomeSampleSufficiencyBlocker[];
}

export interface SetupOutcomeSampleSufficiencyReport {
  version:
    typeof SETUP_OUTCOME_SAMPLE_SUFFICIENCY_VERSION;

  generatedAt:
    string;

  sourceOutcomeReportVersion:
    string;

  sourceOutcomeGeneratedAt:
    string;

  sourceOutcomeStatus:
    SetupOutcomeDatasetValidationStatus;

  status:
    SetupOutcomeSampleSufficiencyStatus;

  policy:
    SetupOutcomeSampleSufficiencyPolicy;

  cohorts:
    readonly SetupOutcomeSampleCohortSummary[];

  byTimeframe:
    readonly SetupOutcomeSampleDimensionCount[];

  byTerminalEventType:
    Readonly<
      Record<
        SetupOutcomeTerminalEventType,
        number
      >
    >;

  diagnostics:
    SetupOutcomeSampleSufficiencyDiagnostics;

  labelRuleResearchEligible:
    boolean;

  observationalOnly:
    true;

  profitabilityLabelApplied:
    false;

  changesProductionSetup:
    false;

  changesTradingRules:
    false;

  tradeExecution:
    false;

  trainingApplied:
    false;

  statisticalPowerClaimed:
    false;
}
