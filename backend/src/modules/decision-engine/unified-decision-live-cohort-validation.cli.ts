import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  validateUnifiedDecisionLiveCohort,
} from './unified-decision-live-cohort-validation.js';

function optionalPositiveInteger(
  value: string | undefined,
  field: string,
): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  field: string,
): number {
  return optionalPositiveInteger(value, field) ?? fallback;
}

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const inputPath = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_LIVE_COHORT_PATH
      ?? process.env.UNIFIED_DECISION_LIVE_OBSERVATION_PATH
      ?? './data/unified-decision-live-observations-v1.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_LIVE_COHORT_OUTPUT_DIR
      ?? '.tmp/unified-decision-live-cohort-validation',
  );
  const startSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_LIVE_COHORT_START_SEQUENCE,
    'UNIFIED_DECISION_LIVE_COHORT_START_SEQUENCE',
  );
  const endSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_LIVE_COHORT_END_SEQUENCE,
    'UNIFIED_DECISION_LIVE_COHORT_END_SEQUENCE',
  );
  const report = validateUnifiedDecisionLiveCohort(
    JSON.parse(await readFile(inputPath, 'utf8')) as unknown,
    {
      ...(startSequence === undefined ? {} : { startSequence }),
      ...(endSequence === undefined ? {} : { endSequence }),
      minimumObservationCount: positiveInteger(
        process.env.UNIFIED_DECISION_LIVE_COHORT_MIN_OBSERVATIONS,
        500,
        'UNIFIED_DECISION_LIVE_COHORT_MIN_OBSERVATIONS',
      ),
      minimumSymmetryCellCount: positiveInteger(
        process.env.UNIFIED_DECISION_LIVE_COHORT_MIN_SYMMETRY_CELL,
        10,
        'UNIFIED_DECISION_LIVE_COHORT_MIN_SYMMETRY_CELL',
      ),
      minimumRealtimeLossCount: positiveInteger(
        process.env.UNIFIED_DECISION_LIVE_COHORT_MIN_SOURCE_LOSS,
        1,
        'UNIFIED_DECISION_LIVE_COHORT_MIN_SOURCE_LOSS',
      ),
      minimumDisagreementCount: positiveInteger(
        process.env.UNIFIED_DECISION_LIVE_COHORT_MIN_DISAGREEMENT,
        10,
        'UNIFIED_DECISION_LIVE_COHORT_MIN_DISAGREEMENT',
      ),
    },
  );

  await mkdir(outputDirectory, { recursive: true });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const timestampedPath = resolve(
    outputDirectory,
    `report-${safeTimestamp(report.generatedAt)}.json`,
  );
  const latestPath = resolve(outputDirectory, 'latest.json');
  await Promise.all([
    writeFile(timestampedPath, serialized, 'utf8'),
    writeFile(latestPath, serialized, 'utf8'),
  ]);

  const coverage = report.coverage;
  console.log(`Unified Decision live cohort validation: ${report.generatedAt}`);
  console.log(`Status: ${report.status}`);
  console.log(`Sequence: ${coverage.firstSequence}-${coverage.lastSequence}`);
  console.log(`Observations: ${coverage.observationCount}`);
  console.log(`Period: ${coverage.firstRecordedAt} -> ${coverage.lastRecordedAt}`);
  console.table([{
    observe: coverage.stateCounts.observe,
    wait: coverage.stateCounts.wait_confirmation,
    possibleLong: coverage.stateCounts.possible_long,
    possibleShort: coverage.stateCounts.possible_short,
    setupConfirmed: coverage.stateCounts.setup_confirmed,
    skip: coverage.stateCounts.skip,
    transitions: coverage.transitionCount,
    violations: report.violations.length,
  }]);
  console.table([{
    symmetry: coverage.symmetry.status,
    resistanceBreakoutLong: coverage.symmetry.resistanceBreakoutLongCount,
    resistanceBounceShort: coverage.symmetry.resistanceBounceShortCount,
    supportBreakoutShort: coverage.symmetry.supportBreakoutShortCount,
    supportBounceLong: coverage.symmetry.supportBounceLongCount,
  }]);
  console.table([{
    realtimeDowngrade: coverage.realtime.status,
    nonLiveTape: coverage.realtime.nonLiveTapeObservationCount,
    nonLiveOrderBook: coverage.realtime.nonLiveOrderBookObservationCount,
    disagreements: coverage.realtime.disagreementObservationCount,
    partial: coverage.realtime.partialObservationCount,
    possibleWithSourceLoss: coverage.realtime.possibleWithSourceLossCount,
  }]);
  console.table([{
    marketFreshness: coverage.marketContext.freshnessStatus,
    marketConflict: coverage.marketContext.conflictStatus,
    singleConflicts: coverage.marketContext.singleConflictObservationCount,
    doubleConflicts: coverage.marketContext.doubleConflictObservationCount,
    terminalSetupOutcome: coverage.setup.terminalOutcomeStatus,
    setupConfirmed: coverage.setup.setupConfirmedObservationCount,
  }]);
  if (report.coverageGaps.length > 0) {
    console.log('Coverage gaps:');
    for (const gap of report.coverageGaps) {
      console.log(`- ${gap.code}: ${gap.message}`);
    }
  }
  console.log(`Decision rules change recommended: ${report.decisionRulesChangeRecommended}`);
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
