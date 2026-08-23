import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  dirname,
  resolve,
} from 'node:path';

import {
  SETUP_OUTCOME_DATASET_VALIDATION_VERSION,
} from './setup-outcome-dataset-validation.types.js';

import type {
  SetupOutcomeDatasetValidationReport,
} from './setup-outcome-dataset-validation.types.js';

import {
  buildSetupOutcomeSampleSufficiency,
} from './setup-outcome-sample-sufficiency.js';

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(
      value,
    )
  );
}

function parseOutcomeReport(
  value: unknown,
): SetupOutcomeDatasetValidationReport {
  if (
    !isRecord(
      value,
    )
    || value.version
      !== SETUP_OUTCOME_DATASET_VALIDATION_VERSION
    || !Array.isArray(
      value.items,
    )
    || !isRecord(
      value.source,
    )
    || !isRecord(
      value.diagnostics,
    )
  ) {
    throw new Error(
      'Invalid Setup Outcome Dataset validation report',
    );
  }

  return value as unknown as
    SetupOutcomeDatasetValidationReport;
}

async function main():
Promise<void> {
  const inputPath =
    resolve(
      process.env
        .SETUP_OUTCOME_SAMPLE_SUFFICIENCY_INPUT_PATH
      ?? './.tmp/setup-outcome-dataset-validation/latest.json',
    );

  const outputPath =
    resolve(
      process.env
        .SETUP_OUTCOME_SAMPLE_SUFFICIENCY_OUTPUT_PATH
      ?? './.tmp/setup-outcome-sample-sufficiency/latest.json',
    );

  const sourceRaw =
    JSON.parse(
      await readFile(
        inputPath,
        'utf8',
      ),
    ) as unknown;

  const source =
    parseOutcomeReport(
      sourceRaw,
    );

  const report =
    buildSetupOutcomeSampleSufficiency(
      source,
    );

  await mkdir(
    dirname(
      outputPath,
    ),
    {
      recursive:
        true,
    },
  );

  await writeFile(
    outputPath,
    `${JSON.stringify(
      report,
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    '===== SETUP OUTCOME SAMPLE SUFFICIENCY v0.1 =====',
  );

  console.log(
    `Version: ${report.version}`,
  );

  console.log(
    `Source Outcome status: ${report.sourceOutcomeStatus}`,
  );

  console.log(
    `Sufficiency status: ${report.status}`,
  );

  console.log(
    `Source measured candidates: ${report.diagnostics.sourceMeasuredCandidatesCount}`,
  );

  console.log(
    `Eligible measured candidates: ${report.diagnostics.eligibleMeasuredCandidatesCount}`,
  );

  console.log(
    `Minimum measured total: ${report.policy.minimumMeasuredTotal}`,
  );

  console.log(
    `Minimum measured per cohort: ${report.policy.minimumMeasuredPerCohort}`,
  );

  console.log(
    '',
  );

  console.log(
    'Required cohorts:',
  );

  for (
    const cohort
    of report.cohorts
  ) {
    console.log(
      `- ${cohort.key}: ${cohort.measuredCount}/${cohort.minimumRequired} `
      + `(shortfall ${cohort.shortfall}, sufficient ${cohort.sufficient})`,
    );
  }

  console.log(
    '',
  );

  console.log(
    `Dropped history events: ${report.diagnostics.droppedEventsCount}`,
  );

  console.log(
    `Multiple terminal anomalies: ${report.diagnostics.multipleTerminalEventsCount}`,
  );

  console.log(
    `Insufficient candle coverage: ${report.diagnostics.insufficientCandleCoverageCount}`,
  );

  console.log(
    `Market history errors: ${report.diagnostics.marketHistoryErrorCount}`,
  );

  console.log(
    `Incomplete measured histories: ${report.diagnostics.incompleteMeasuredHistoryCount}`,
  );

  console.log(
    `Measured without metrics: ${report.diagnostics.measuredWithoutMetricsCount}`,
  );

  console.log(
    `Measured count mismatch: ${report.diagnostics.measuredCountMismatch}`,
  );

  console.log(
    `Safety contract violations: ${report.diagnostics.safetyContractViolationCount}`,
  );

  console.log(
    `Blockers: ${
      report.diagnostics.blockers.length > 0
        ? report.diagnostics.blockers.join(', ')
        : 'none'
    }`,
  );

  console.log(
    '',
  );

  console.log(
    `Label-rule research eligible: ${report.labelRuleResearchEligible}`,
  );

  console.log(
    `Profitability labels applied: ${report.profitabilityLabelApplied}`,
  );

  console.log(
    `Trading rules changed: ${report.changesTradingRules}`,
  );

  console.log(
    `Training applied: ${report.trainingApplied}`,
  );

  console.log(
    `Statistical power claimed: ${report.statisticalPowerClaimed}`,
  );

  console.log(
    `Output: ${outputPath}`,
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
