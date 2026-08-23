import type {
  SetupOutcomeDatasetValidationReport,
  SetupOutcomeTerminalEventType,
} from './setup-outcome-dataset-validation.types.js';

import {
  SETUP_OUTCOME_SAMPLE_SUFFICIENCY_VERSION,
} from './setup-outcome-sample-sufficiency.types.js';

import type {
  SetupOutcomeSampleCohortDefinition,
  SetupOutcomeSampleCohortSummary,
  SetupOutcomeSampleDimensionCount,
  SetupOutcomeSampleSufficiencyBlocker,
  SetupOutcomeSampleSufficiencyPolicy,
  SetupOutcomeSampleSufficiencyReport,
  SetupOutcomeSampleSufficiencyStatus,
} from './setup-outcome-sample-sufficiency.types.js';

const REQUIRED_COHORTS:
readonly SetupOutcomeSampleCohortDefinition[] =
  Object.freeze([
    {
      setupType:
        'level_breakout',
      direction:
        'long',
    },
    {
      setupType:
        'level_breakout',
      direction:
        'short',
    },
    {
      setupType:
        'level_bounce',
      direction:
        'long',
    },
    {
      setupType:
        'level_bounce',
      direction:
        'short',
    },
  ]);

export const DEFAULT_SETUP_OUTCOME_SAMPLE_SUFFICIENCY_POLICY:
SetupOutcomeSampleSufficiencyPolicy =
  Object.freeze({
    minimumMeasuredTotal:
      100,

    minimumMeasuredPerCohort:
      25,

    requiredCohorts:
      REQUIRED_COHORTS,
  });

function cohortKey(
  cohort:
    SetupOutcomeSampleCohortDefinition,
): string {
  return `${cohort.setupType}:${cohort.direction}`;
}

function validatePolicy(
  policy:
    SetupOutcomeSampleSufficiencyPolicy,
): void {
  if (
    !Number.isInteger(
      policy.minimumMeasuredTotal,
    )
    || policy.minimumMeasuredTotal <= 0
  ) {
    throw new Error(
      'Setup Outcome sufficiency minimumMeasuredTotal must be a positive integer',
    );
  }

  if (
    !Number.isInteger(
      policy.minimumMeasuredPerCohort,
    )
    || policy.minimumMeasuredPerCohort <= 0
  ) {
    throw new Error(
      'Setup Outcome sufficiency minimumMeasuredPerCohort must be a positive integer',
    );
  }

  if (
    policy.requiredCohorts.length === 0
  ) {
    throw new Error(
      'Setup Outcome sufficiency requires at least one cohort',
    );
  }

  const keys =
    policy.requiredCohorts.map(
      cohortKey,
    );

  if (
    new Set(keys).size
      !== keys.length
  ) {
    throw new Error(
      'Setup Outcome sufficiency cohorts must be unique',
    );
  }
}

function dimensionCounts(
  values:
    readonly string[],
): readonly SetupOutcomeSampleDimensionCount[] {
  const counts =
    new Map<
      string,
      number
    >();

  for (const value of values) {
    counts.set(
      value,
      (
        counts.get(
          value,
        )
        ?? 0
      ) + 1,
    );
  }

  return Object.freeze(
    [...counts.entries()]
      .sort(
        ([left], [right]) =>
          left.localeCompare(
            right,
          ),
      )
      .map(
        ([key, measuredCount]) => ({
          key,
          measuredCount,
        }),
      ),
  );
}

function sourceSafetyViolationCount(
  source:
    SetupOutcomeDatasetValidationReport,
): number {
  const violations = [
    source.observationalOnly
      !== true,

    source.profitabilityLabelApplied
      !== false,

    source.sampleSufficiencyThresholdApplied
      !== false,

    source.changesProductionSetup
      !== false,

    source.changesTradingRules
      !== false,

    source.tradeExecution
      !== false,

    source.trainingApplied
      !== false,

    source.futureMarketDataUsedForDetection
      !== false,
  ];

  return violations.filter(
    Boolean,
  ).length;
}

export function buildSetupOutcomeSampleSufficiency(
  source:
    SetupOutcomeDatasetValidationReport,

  policy:
    SetupOutcomeSampleSufficiencyPolicy =
      DEFAULT_SETUP_OUTCOME_SAMPLE_SUFFICIENCY_POLICY,
): SetupOutcomeSampleSufficiencyReport {
  validatePolicy(
    policy,
  );

  const measuredItems =
    source.items.filter(
      (item) =>
        item.measurementStatus
          === 'measured',
    );

  const incompleteMeasuredHistoryCount =
    measuredItems.filter(
      (item) =>
        item.historyComplete
          !== true,
    ).length;

  const measuredWithoutMetricsCount =
    measuredItems.filter(
      (item) =>
        item.metrics
          === null,
    ).length;

  const eligibleMeasuredItems =
    measuredItems.filter(
      (item) =>
        item.historyComplete
          === true
        && item.metrics
          !== null,
    );

  const measuredCountMismatch =
    source
      .diagnostics
      .measuredCandidatesCount
    !== measuredItems.length;

  const safetyContractViolationCount =
    sourceSafetyViolationCount(
      source,
    );

  const blockers:
  SetupOutcomeSampleSufficiencyBlocker[] = [];

  if (
    !source.source.historySnapshotFound
    && source.items.length > 0
  ) {
    blockers.push(
      'history_snapshot_inconsistent',
    );
  }

  if (
    source.source.droppedEventsCount
      > 0
  ) {
    blockers.push(
      'dropped_history_events',
    );
  }

  if (
    source
      .diagnostics
      .multipleTerminalEventsCount
      > 0
  ) {
    blockers.push(
      'multiple_terminal_events',
    );
  }

  if (
    source
      .diagnostics
      .insufficientCandleCoverageCount
      > 0
  ) {
    blockers.push(
      'insufficient_candle_coverage',
    );
  }

  if (
    source
      .diagnostics
      .marketHistoryErrorCount
      > 0
  ) {
    blockers.push(
      'market_history_error',
    );
  }

  if (measuredCountMismatch) {
    blockers.push(
      'measured_count_mismatch',
    );
  }

  if (
    incompleteMeasuredHistoryCount
      > 0
  ) {
    blockers.push(
      'incomplete_measured_history',
    );
  }

  if (
    measuredWithoutMetricsCount
      > 0
  ) {
    blockers.push(
      'measured_without_metrics',
    );
  }

  if (
    safetyContractViolationCount
      > 0
  ) {
    blockers.push(
      'source_safety_contract_violation',
    );
  }

  const cohorts:
  SetupOutcomeSampleCohortSummary[] =
    policy.requiredCohorts.map(
      (required) => {
        const measuredCount =
          eligibleMeasuredItems.filter(
            (item) =>
              item.setupType
                === required.setupType
              && item.direction
                === required.direction,
          ).length;

        const shortfall =
          Math.max(
            0,
            policy.minimumMeasuredPerCohort
              - measuredCount,
          );

        return {
          ...required,

          key:
            cohortKey(
              required,
            ),

          measuredCount,

          minimumRequired:
            policy.minimumMeasuredPerCohort,

          shortfall,

          sufficient:
            shortfall === 0,
        };
      },
    );

  const byTerminalEventType:
  Record<
    SetupOutcomeTerminalEventType,
    number
  > = {
    breakout_confirmed:
      0,

    rejection_confirmed:
      0,

    setup_expired:
      0,
  };

  for (
    const item
    of eligibleMeasuredItems
  ) {
    byTerminalEventType[
      item.terminal.type
    ] += 1;
  }

  let status:
  SetupOutcomeSampleSufficiencyStatus;

  if (
    blockers.length > 0
  ) {
    status =
      'blocked_data_integrity';
  } else if (
    eligibleMeasuredItems.length
      < policy.minimumMeasuredTotal
  ) {
    status =
      'insufficient_total_sample';
  } else if (
    cohorts.some(
      (cohort) =>
        !cohort.sufficient,
    )
  ) {
    status =
      'insufficient_cohort_sample';
  } else {
    status =
      'sufficient_for_next_research_stage';
  }

  const labelRuleResearchEligible =
    status
      === 'sufficient_for_next_research_stage';

  return {
    version:
      SETUP_OUTCOME_SAMPLE_SUFFICIENCY_VERSION,

    generatedAt:
      new Date()
        .toISOString(),

    sourceOutcomeReportVersion:
      source.version,

    sourceOutcomeGeneratedAt:
      source.generatedAt,

    sourceOutcomeStatus:
      source.status,

    status,

    policy,

    cohorts:
      Object.freeze(
        cohorts,
      ),

    byTimeframe:
      dimensionCounts(
        eligibleMeasuredItems.map(
          (item) =>
            item.timeframe,
        ),
      ),

    byTerminalEventType:
      Object.freeze({
        ...byTerminalEventType,
      }),

    diagnostics: {
      sourceMeasuredCandidatesCount:
        source
          .diagnostics
          .measuredCandidatesCount,

      measuredItemsCount:
        measuredItems.length,

      eligibleMeasuredCandidatesCount:
        eligibleMeasuredItems.length,

      incompleteMeasuredHistoryCount,

      measuredWithoutMetricsCount,

      measuredCountMismatch,

      droppedEventsCount:
        source.source
          .droppedEventsCount,

      multipleTerminalEventsCount:
        source
          .diagnostics
          .multipleTerminalEventsCount,

      insufficientCandleCoverageCount:
        source
          .diagnostics
          .insufficientCandleCoverageCount,

      marketHistoryErrorCount:
        source
          .diagnostics
          .marketHistoryErrorCount,

      pendingWindowCandidatesCount:
        source
          .diagnostics
          .pendingWindowCandidatesCount,

      missingThirdTouchAnchorCount:
        source
          .diagnostics
          .missingThirdTouchAnchorCount,

      safetyContractViolationCount,

      blockers:
        Object.freeze([
          ...blockers,
        ]),
    },

    labelRuleResearchEligible,

    observationalOnly:
      true,

    profitabilityLabelApplied:
      false,

    changesProductionSetup:
      false,

    changesTradingRules:
      false,

    tradeExecution:
      false,

    trainingApplied:
      false,

    statisticalPowerClaimed:
      false,
  };
}
