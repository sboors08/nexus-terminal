import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  diagnoseUnifiedDecisionCoverageGapReachability,
} from './unified-decision-coverage-gap-reachability-diagnostics.js';

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

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const inputPath = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_REACHABILITY_PATH
      ?? process.env.UNIFIED_DECISION_LIVE_OBSERVATION_PATH
      ?? './data/unified-decision-live-observations-v1.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_REACHABILITY_OUTPUT_DIR
      ?? '.tmp/unified-decision-coverage-gap-reachability-diagnostics',
  );
  const startSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_REACHABILITY_START_SEQUENCE,
    'UNIFIED_DECISION_REACHABILITY_START_SEQUENCE',
  );
  const endSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_REACHABILITY_END_SEQUENCE,
    'UNIFIED_DECISION_REACHABILITY_END_SEQUENCE',
  );
  const minimumObservationCount = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_REACHABILITY_MIN_OBSERVATIONS,
    'UNIFIED_DECISION_REACHABILITY_MIN_OBSERVATIONS',
  );
  const report = diagnoseUnifiedDecisionCoverageGapReachability(
    JSON.parse(await readFile(inputPath, 'utf8')) as unknown,
    {
      ...(startSequence === undefined ? {} : { startSequence }),
      ...(endSequence === undefined ? {} : { endSequence }),
      ...(minimumObservationCount === undefined
        ? {}
        : { minimumObservationCount }),
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

  console.log(`Unified Decision coverage-gap reachability diagnostics: ${report.generatedAt}`);
  console.log(`Status: ${report.status}`);
  console.log(`Observations: ${report.observationCount}`);
  console.log(`Sequence: ${report.firstSequence ?? '-'}-${report.lastSequence ?? '-'}`);
  console.log(`Period: ${report.firstRecordedAt ?? '-'} -> ${report.lastRecordedAt ?? '-'}`);
  console.log('MARKET CONTEXT PATH');
  console.table([{
    directionalPrecursors: report.market.directionalRealtimePrecursorCount,
    contextAvailable: report.market.marketContextReadAvailableCount,
    btcComputable: report.market.btcContextComputableCount,
    impulseComputable: report.market.impulseContextComputableCount,
    bothComputable: report.market.bothContextsComputableCount,
    btcOpposed: report.market.btcOpposedCount,
    impulseOpposed: report.market.impulseOpposedCount,
    singleConflict: report.market.singleConflictConditionCount,
    doubleConflict: report.market.doubleConflictConditionCount,
    alignmentMismatches: report.market.alignmentMismatchCount,
  }]);
  console.log('SETUP LIFECYCLE PATH');
  console.table([{
    sourceAvailable: report.setup.sourceReadAvailableObservationCount,
    candidateObservations: report.setup.candidateObservationCount,
    uniqueCandidates: report.setup.uniqueCandidateCount,
    approaching: report.setup.approachingObservationCount,
    thirdTouch: report.setup.thirdTouchObservationCount,
    terminalCaptured: report.setup.capturedTerminalObservationCount,
    terminalCurrent: report.setup.currentTerminalObservationCount,
    terminalExpired: report.setup.expiredTerminalObservationCount,
    setupConfirmed: report.setup.setupConfirmedObservationCount,
  }]);
  console.log('REACHABILITY ASSESSMENTS');
  console.table(
    report.assessments.map((assessment) => ({
      kind: assessment.kind,
      status: assessment.status,
      targetObservations: assessment.targetObservationCount,
      cutoff: assessment.cutoff,
    })),
  );
  for (const assessment of report.assessments) {
    console.log(`- ${assessment.kind}: ${assessment.message}`);
  }
  console.log(`Violations: ${report.violations.length}`);
  console.log(`Next action: ${report.nextAction}`);
  console.log(`Decision rules change recommended: ${report.decisionRulesChangeRecommended}`);
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
