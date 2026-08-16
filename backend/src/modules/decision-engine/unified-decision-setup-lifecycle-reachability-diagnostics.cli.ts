import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  diagnoseUnifiedDecisionSetupLifecycleReachability,
} from './unified-decision-setup-lifecycle-reachability-diagnostics.js';

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
    process.env.UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_PATH
      ?? process.env.UNIFIED_DECISION_REACHABILITY_PATH
      ?? process.env.UNIFIED_DECISION_LIVE_OBSERVATION_PATH
      ?? './data/unified-decision-live-observations-v1.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env.UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_OUTPUT_DIR
      ?? '.tmp/unified-decision-setup-lifecycle-reachability-diagnostics',
  );
  const startSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_START_SEQUENCE,
    'UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_START_SEQUENCE',
  );
  const endSequence = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_END_SEQUENCE,
    'UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_END_SEQUENCE',
  );
  const minimumObservationCount = optionalPositiveInteger(
    process.env.UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_MIN_OBSERVATIONS,
    'UNIFIED_DECISION_SETUP_LIFECYCLE_REACHABILITY_MIN_OBSERVATIONS',
  );
  const report = diagnoseUnifiedDecisionSetupLifecycleReachability(
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

  console.log(`Unified Decision Setup lifecycle reachability diagnostics: ${report.generatedAt}`);
  console.log(`Status: ${report.status}`);
  console.log(`Observations: ${report.observationCount}`);
  console.log(`Sequence: ${report.firstSequence ?? '-'}-${report.lastSequence ?? '-'}`);
  console.log(`Period: ${report.firstRecordedAt ?? '-'} -> ${report.lastRecordedAt ?? '-'}`);
  console.log('CANDIDATE LIFETIME');
  console.table([{
    sourceAvailable: report.setupSourceAvailableObservationCount,
    candidateObservations: report.candidates.candidateObservationCount,
    occurrences: report.candidates.candidateOccurrenceCount,
    uniqueCandidates: report.candidates.uniqueCandidateCount,
    firstSeenCurrent: report.candidates.firstSeenBeforeExpiryCount,
    firstSeenExpired: report.candidates.firstSeenAtOrAfterExpiryCount,
    currentOccurrences: report.candidates.currentOccurrenceCount,
    expiredOccurrences: report.candidates.expiredOccurrenceCount,
    retainedExpired: report.candidates.retainedExpiredOccurrenceCount,
    maxRetentionSec: report.candidates.maximumRetentionAfterExpirySeconds,
  }]);
  console.log('SETUP STAGES');
  console.table(report.candidates.setupStageOccurrenceCounts);
  console.log('UNIQUE CANDIDATES BY SETUP STAGE');
  console.table(report.candidates.uniqueCandidateStageCounts);
  console.log('CAUSAL STAGES');
  console.table(report.candidates.causalStageOccurrenceCounts);
  console.log('UNIQUE CANDIDATES BY CAUSAL STAGE');
  console.table(report.candidates.uniqueCandidateCausalStageCounts);
  console.log('REACHABILITY PATH');
  console.table(
    report.assessment.path.map((entry) => ({
      node: entry.code,
      observations: entry.observationCount,
      occurrences: entry.occurrenceCount,
      uniqueCandidates: entry.uniqueCandidateCount,
    })),
  );
  console.log(`Diagnosis: ${report.assessment.diagnosis}`);
  console.log(`Cutoff: ${report.assessment.cutoff}`);
  console.log(`Conclusion: ${report.assessment.message}`);
  console.log(`Violations: ${report.violations.length}`);
  console.log(`Next action: ${report.nextAction}`);
  console.log(`Targeted live check recommended: ${report.targetedLiveCheckRecommended}`);
  console.log(`Decision rules change recommended: ${report.decisionRulesChangeRecommended}`);
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
