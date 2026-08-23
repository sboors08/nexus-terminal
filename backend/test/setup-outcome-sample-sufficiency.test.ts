import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  SetupDirection,
  SetupEngineSetupType,
} from '../src/modules/setup-engine/setup-engine.types.js';

import type {
  SetupOutcomeDatasetItem,
  SetupOutcomeDatasetValidationReport,
} from '../src/modules/setup-engine/setup-outcome-dataset-validation.types.js';

import {
  buildSetupOutcomeSampleSufficiency,
} from '../src/modules/setup-engine/setup-outcome-sample-sufficiency.js';

interface Cohort {
  setupType:
    SetupEngineSetupType;

  direction:
    SetupDirection;
}

const COHORTS:
readonly Cohort[] = [
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
];

function measuredItem(
  index: number,
  cohort: Cohort,
  historyComplete = true,
): SetupOutcomeDatasetItem {
  const candidateId =
    `setup-sufficiency-${index}`;

  return {
    id:
      `setup-outcome:${candidateId}`,

    candidateId,

    symbol:
      `TEST${index}USDT`,

    timeframe:
      index % 2 === 0
        ? '1m'
        : '5m',

    setupType:
      cohort.setupType,

    direction:
      cohort.direction,

    episodeId:
      `episode-${index}`,

    lineId:
      `line-${index}`,

    historyComplete,

    firstRetainedEventId:
      index * 3 - 2,

    lastRetainedEventId:
      index * 3,

    lifecycleEventsCount:
      3,

    terminal: {
      eventId:
        index * 3,

      type:
        'rejection_confirmed',

      occurredAt:
        '2026-08-23T12:00:00.000Z',

      stage:
        'REJECTION_CONFIRMED',

      lifecycleOutcome:
        'rejection',

      snapshotPrice:
        100,
    },

    anchor: {
      eventId:
        index * 3 - 1,

      occurredAt:
        '2026-08-23T11:59:30.000Z',

      price:
        100,

      measurementStartsAt:
        '2026-08-23T12:00:00.000Z',

      anchorMinuteExcluded:
        true,

      anchorGapMs:
        30_000,
    },

    measurementStatus:
      'measured',

    metrics: {
      observationWindowMinutes:
        60,

      observationWindowEndsAt:
        '2026-08-23T12:59:30.000Z',

      candlesCount:
        59,

      firstCandleOpenTime:
        '2026-08-23T12:00:00.000Z',

      lastCandleCloseTime:
        '2026-08-23T12:58:59.999Z',

      maxFavorableExcursionPct:
        1,

      maxAdverseExcursionPct:
        1,

      maxFavorablePrice:
        101,

      maxAdversePrice:
        99,

      checkpoints:
        [],
    },

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
  };
}

function outcomeReport(
  items:
    readonly SetupOutcomeDatasetItem[],
): SetupOutcomeDatasetValidationReport {
  return {
    version:
      'setup-outcome-dataset-validation-v0.1',

    generatedAt:
      '2026-08-23T13:00:00.000Z',

    status:
      items.length > 0
        ? 'sample_available'
        : 'insufficient_sample',

    source: {
      historySnapshotFound:
        true,

      snapshotSavedAt:
        '2026-08-23T13:00:00.000Z',

      retainedEventsCount:
        items.length * 3,

      droppedEventsCount:
        0,
    },

    options: {
      horizonsMinutes:
        [
          5,
          15,
          30,
          60,
        ],

      excludeAnchorMinute:
        true,
    },

    diagnostics: {
      candidatesCount:
        items.length,

      terminalCandidatesCount:
        items.length,

      anchoredTerminalCandidatesCount:
        items.length,

      measuredCandidatesCount:
        items.length,

      pendingWindowCandidatesCount:
        0,

      missingThirdTouchAnchorCount:
        0,

      insufficientCandleCoverageCount:
        0,

      marketHistoryErrorCount:
        0,

      multipleTerminalEventsCount:
        0,
    },

    items,

    observationalOnly:
      true,

    profitabilityLabelApplied:
      false,

    sampleSufficiencyThresholdApplied:
      false,

    changesProductionSetup:
      false,

    changesTradingRules:
      false,

    tradeExecution:
      false,

    trainingApplied:
      false,

    futureMarketDataUsedForDetection:
      false,

    postEventMarketDataUsedForMeasurement:
      items.length > 0,
  };
}

function balancedItems(
  count: number,
): SetupOutcomeDatasetItem[] {
  return Array.from(
    {
      length:
        count,
    },
    (_, index) => {
      const cohort =
        COHORTS[
          index % COHORTS.length
        ];

      assert.ok(
        cohort,
      );

      return measuredItem(
        index + 1,
        cohort,
      );
    },
  );
}

test(
  'keeps a real but tiny measured sample below the total sufficiency gate',
  () => {
    const report =
      buildSetupOutcomeSampleSufficiency(
        outcomeReport([
          measuredItem(
            1,
            {
              setupType:
                'level_bounce',
              direction:
                'short',
            },
          ),
        ]),
      );

    assert.equal(
      report.status,
      'insufficient_total_sample',
    );

    assert.equal(
      report
        .diagnostics
        .eligibleMeasuredCandidatesCount,
      1,
    );

    assert.equal(
      report.policy.minimumMeasuredTotal,
      100,
    );

    assert.equal(
      report.labelRuleResearchEligible,
      false,
    );

    assert.equal(
      report.profitabilityLabelApplied,
      false,
    );

    assert.equal(
      report.changesTradingRules,
      false,
    );

    assert.equal(
      report.trainingApplied,
      false,
    );
  },
);

test(
  'marks 100 balanced measured candidates as sufficient for the next research stage only',
  () => {
    const report =
      buildSetupOutcomeSampleSufficiency(
        outcomeReport(
          balancedItems(
            100,
          ),
        ),
      );

    assert.equal(
      report.status,
      'sufficient_for_next_research_stage',
    );

    assert.equal(
      report
        .diagnostics
        .eligibleMeasuredCandidatesCount,
      100,
    );

    assert.equal(
      report.cohorts.length,
      4,
    );

    assert.equal(
      report.cohorts.every(
        (cohort) =>
          cohort.measuredCount
            === 25
          && cohort.sufficient,
      ),
      true,
    );

    assert.equal(
      report.labelRuleResearchEligible,
      true,
    );

    assert.equal(
      report.profitabilityLabelApplied,
      false,
    );

    assert.equal(
      report.statisticalPowerClaimed,
      false,
    );
  },
);

test(
  'requires cohort coverage even when the total measured count reaches 100',
  () => {
    const items =
      Array.from(
        {
          length:
            100,
        },
        (_, index) =>
          measuredItem(
            index + 1,
            {
              setupType:
                'level_bounce',
              direction:
                'short',
            },
          ),
      );

    const report =
      buildSetupOutcomeSampleSufficiency(
        outcomeReport(
          items,
        ),
      );

    assert.equal(
      report.status,
      'insufficient_cohort_sample',
    );

    const populated =
      report.cohorts.find(
        (cohort) =>
          cohort.key
            === 'level_bounce:short',
      );

    assert.equal(
      populated?.measuredCount,
      100,
    );

    assert.equal(
      report.cohorts.filter(
        (cohort) =>
          !cohort.sufficient,
      ).length,
      3,
    );

    assert.equal(
      report.labelRuleResearchEligible,
      false,
    );
  },
);

test(
  'blocks sufficiency when persisted history has dropped events',
  () => {
    const base =
      outcomeReport(
        balancedItems(
          100,
        ),
      );

    const report =
      buildSetupOutcomeSampleSufficiency({
        ...base,

        source: {
          ...base.source,

          droppedEventsCount:
            1,
        },
      });

    assert.equal(
      report.status,
      'blocked_data_integrity',
    );

    assert.equal(
      report
        .diagnostics
        .blockers
        .includes(
          'dropped_history_events',
        ),
      true,
    );

    assert.equal(
      report.labelRuleResearchEligible,
      false,
    );
  },
);

test(
  'blocks sufficiency when a measured case does not have complete retained lifecycle history',
  () => {
    const items =
      balancedItems(
        100,
      );

    const first =
      items[0];

    assert.ok(
      first,
    );

    items[0] = {
      ...first,

      historyComplete:
        false,
    };

    const report =
      buildSetupOutcomeSampleSufficiency(
        outcomeReport(
          items,
        ),
      );

    assert.equal(
      report.status,
      'blocked_data_integrity',
    );

    assert.equal(
      report
        .diagnostics
        .eligibleMeasuredCandidatesCount,
      99,
    );

    assert.equal(
      report
        .diagnostics
        .blockers
        .includes(
          'incomplete_measured_history',
        ),
      true,
    );
  },
);
