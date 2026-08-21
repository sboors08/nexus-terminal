import {
  createHash,
} from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import type {
  CausalSetupRealDataValidationReport,
} from './causal-setup-real-data-validation.types.js';
import {
  validateSetupCandidateEpisodeRealData,
} from './setup-candidate-episode-real-data-validation.js';

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const sourcePath = resolve(
    process.cwd(),
    process.env
      .SETUP_CANDIDATE_EPISODE_VALIDATION_SOURCE
      ?? '.tmp/causal-setup-validation/latest.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env
      .SETUP_CANDIDATE_EPISODE_VALIDATION_OUTPUT_DIR
      ?? '.tmp/setup-candidate-episode-real-data-validation',
  );

  console.log(
    `Reading saved real-data source: ${sourcePath}`,
  );

  const sourceText = await readFile(
    sourcePath,
    'utf8',
  );
  const sourceHash = createHash('sha256')
    .update(sourceText, 'utf8')
    .digest('hex');
  const source = JSON.parse(
    sourceText,
  ) as CausalSetupRealDataValidationReport;

  console.log(
    'Replaying saved candles twice through the production episode contract: baseline and fresh restart...',
  );

  const report =
    validateSetupCandidateEpisodeRealData(
      source,
      {
        sourceDatasetHash: sourceHash,
      },
      {
        onReplayProgress: (progress) => {
          if (
            progress.completedStepCount === 1
            || progress.completedStepCount % 100 === 0
            || progress.completedStepCount
              === progress.totalStepCount
          ) {
            console.log(
              `${progress.phase} ${progress.symbol}: ${progress.completedStepCount}/${progress.totalStepCount} causal prefixes`,
            );
          }
        },
      },
    );

  await mkdir(outputDirectory, {
    recursive: true,
  });

  const serialized =
    `${JSON.stringify(report, null, 2)}\n`;
  const timestamp = safeTimestamp(
    report.generatedAt,
  );
  const timestampedPath = resolve(
    outputDirectory,
    `report-${timestamp}.json`,
  );
  const latestPath = resolve(
    outputDirectory,
    'latest.json',
  );

  await Promise.all([
    writeFile(
      timestampedPath,
      serialized,
      'utf8',
    ),
    writeFile(
      latestPath,
      serialized,
      'utf8',
    ),
  ]);

  console.log(
    `Setup candidate episode real-data validation: ${report.generatedAt}`,
  );
  console.table(
    report.datasets.map((dataset) => ({
      symbol: dataset.symbol,
      candles:
        dataset.totals.closedCandlesCount,
      sourceCandidates:
        dataset.totals.sourceCandidateTrackCount,
      episodeCandidates:
        dataset.totals.candidateTrackCount,
      pairs:
        dataset.totals.uniqueLineSetupPairCount,
      rearmedPairs:
        dataset.totals.rearmedPairCount,
      rearms:
        dataset.totals.rearmCount,
      suppressions:
        dataset.totals
          .duplicateSuppressionObservationCount,
      restartMismatches:
        dataset.totals.restartMismatchCount,
      violations:
        dataset.totals.violationCount,
    })),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.closedCandlesCount} real candles, `
    + `${report.totals.candidateTrackCount} episode candidates, `
    + `${report.totals.rearmCount} rearms`,
  );
  console.log(
    'Duplicate suppression observations: '
    + report.totals
      .duplicateSuppressionObservationCount,
  );
  console.log(
    'Restart mismatches: '
    + report.totals.restartMismatchCount,
  );
  console.log(
    `Invariant violations: ${report.totals.violationCount}`,
  );
  console.log(
    `Status: ${report.status}`,
  );
  console.log(
    `Permanent duplicate cutoff eliminated: ${report.permanentDuplicateCutoffEliminated}`,
  );
  console.log(
    `Same-episode churn detected: ${report.sameEpisodeChurnDetected}`,
  );
  console.log(
    `Restart equivalent: ${report.restartEquivalent}`,
  );
  console.log(
    `Report: ${timestampedPath}`,
  );
  console.log(
    `Latest: ${latestPath}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
