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
  diagnoseLevelLinesExactPriceOriginCollisions,
} from './level-lines-exact-price-origin-collision-diagnostics.js';

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const sourcePath = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_COLLISION_SOURCE
      ?? '.tmp/causal-setup-validation/latest.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_COLLISION_OUTPUT_DIR
      ?? '.tmp/level-lines-exact-price-origin-collision-diagnostics',
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
    'Replaying saved closed candles through production Level Lines and measuring simultaneous exact-price origins...',
  );

  const report =
    diagnoseLevelLinesExactPriceOriginCollisions(
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
              `${progress.symbol}: ${progress.completedStepCount}/${progress.totalStepCount} causal prefixes`,
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
    `Exact-price origin collision diagnostics: ${report.generatedAt}`,
  );
  console.table(
    report.datasets.map((dataset) => ({
      symbol: dataset.symbol,
      candles:
        dataset.totals.closedCandlesCount,
      replaySteps:
        dataset.totals.replayStepCount,
      collisionObservations:
        dataset.totals.collisionObservationCount,
      groups:
        dataset.totals.collisionGroupCount,
      episodes:
        dataset.totals.collisionEpisodeCount,
      pairs:
        dataset.totals.collisionPairCount,
      collidingLines:
        dataset.totals.uniqueCollidingLineCount,
      inherited:
        dataset.totals
          .inheritedPriorExactOriginLineCount,
      maximumConcurrent:
        dataset.totals.maximumConcurrentLineCount,
      violations:
        dataset.totals.violationCount,
    })),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.closedCandlesCount} real candles, `
    + `${report.totals.collisionGroupCount} exact-price groups, `
    + `${report.totals.collisionPairCount} coactive origin pairs`,
  );
  console.log(
    `Collision observations: ${report.totals.collisionObservationCount}`,
  );
  console.log(
    `Unique colliding lines: ${report.totals.uniqueCollidingLineCount}`,
  );
  console.log(
    `Maximum concurrent lines: ${report.totals.maximumConcurrentLineCount}`,
  );
  console.log(
    `Inherited prior-origin evidence: ${report.totals.inheritedPriorExactOriginLineCount}`,
  );
  console.log(
    `Invariant violations: ${report.totals.violationCount}`,
  );
  console.log(`Status: ${report.status}`);
  console.log(
    `Immediate merge by price recommended: ${report.recommendsImmediatePriceMerge}`,
  );
  console.log(
    `Production Level identity changed: ${report.changesLevelIdentity}`,
  );
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
