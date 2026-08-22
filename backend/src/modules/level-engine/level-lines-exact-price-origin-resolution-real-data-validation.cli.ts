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
} from '../setup-engine/causal-setup-real-data-validation.types.js';
import {
  validateLevelLinesExactPriceOriginResolutionOnRealData,
} from './level-lines-exact-price-origin-resolution-real-data-validation.js';

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const sourcePath = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_SOURCE
      ?? '.tmp/causal-setup-validation/latest.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_ORIGIN_RESOLUTION_REAL_DATA_OUTPUT_DIR
      ?? '.tmp/level-lines-exact-price-origin-resolution-real-data-validation',
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
    'Replaying every causal prefix twice through production Level Lines exact-price origin resolution...',
  );

  const report =
    validateLevelLinesExactPriceOriginResolutionOnRealData(
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
              `${progress.symbol} [${progress.pass}]: ${progress.completedStepCount}/${progress.totalStepCount} causal prefixes`,
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
    `Exact-price origin resolution real-data validation: ${report.generatedAt}`,
  );
  console.table(
    report.datasets.map((dataset) => ({
      symbol: dataset.symbol,
      candles:
        dataset.totals.closedCandlesCount,
      primarySteps:
        dataset.totals.replayStepCount,
      restartSteps:
        dataset.totals.restartReplayStepCount,
      decisions:
        dataset.totals.uniqueDecisionCount,
      activeReuse:
        dataset.totals
          .activeIdentityReuseDecisionCount,
      workedRearm:
        dataset.totals
          .workedIdentityRearmDecisionCount,
      residualCollisions:
        dataset.totals
          .residualCurrentCollisionGroupCount,
      restartMismatches:
        dataset.totals
          .restartReplayMismatchCount,
      violations:
        dataset.totals.violationCount,
    })),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.closedCandlesCount} real closed candles, `
    + `${report.totals.replayStepCount} primary prefixes, `
    + `${report.totals.restartReplayStepCount} restart prefixes`,
  );
  console.log(
    `Unique resolution decisions: ${report.totals.uniqueDecisionCount}`,
  );
  console.log(
    `Active identity reuse: ${report.totals.activeIdentityReuseDecisionCount}`,
  );
  console.log(
    `Worked identity rearm: ${report.totals.workedIdentityRearmDecisionCount}`,
  );
  console.log(
    `Residual current collision groups: ${report.totals.residualCurrentCollisionGroupCount}`,
  );
  console.log(
    `Full history preserved: ${report.fullHistoryPreserved}`,
  );
  console.log(
    `Restart/replay equivalent: ${report.restartReplayEquivalent}`,
  );
  console.log(
    `Invariant violations: ${report.totals.violationCount}`,
  );
  console.log(`Status: ${report.status}`);
  console.log(
    `Trading rules changed: ${report.changesTradingRules}`,
  );
  console.log(
    `Future candles used: ${report.usesFutureCandles}`,
  );
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
