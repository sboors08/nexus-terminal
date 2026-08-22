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
import {
  classifyLevelLinesExactPriceOriginCollisions,
} from './level-lines-exact-price-origin-collision-classification.js';
import type {
  LevelLinesExactPriceOriginCollisionDiagnosticsReport,
} from './level-lines-exact-price-origin-collision-diagnostics.types.js';

function safeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const sourcePath = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_COLLISION_CLASSIFICATION_SOURCE
      ?? '.tmp/level-lines-exact-price-origin-collision-diagnostics/latest.json',
  );
  const outputDirectory = resolve(
    process.cwd(),
    process.env
      .LEVEL_LINES_EXACT_PRICE_COLLISION_CLASSIFICATION_OUTPUT_DIR
      ?? '.tmp/level-lines-exact-price-origin-collision-classification',
  );

  console.log(
    `Reading exact-price collision report: ${sourcePath}`,
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
  ) as LevelLinesExactPriceOriginCollisionDiagnosticsReport;

  console.log(
    'Classifying every coactive origin pair by prior lifecycle status and inherited exact-price evidence...',
  );

  const report =
    classifyLevelLinesExactPriceOriginCollisions(
      source,
      {
        sourceReportHash: sourceHash,
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
    `Exact-price origin collision classification: ${report.generatedAt}`,
  );
  console.table(
    report.datasets.map((dataset) => ({
      symbol: dataset.symbol,
      groups: dataset.groupCount,
      pairs: dataset.pairCount,
      activeReuse:
        dataset.activeOriginReconfirmationCount,
      workedRearm:
        dataset.workedOriginRetentionRearmCount,
      independentCandidates:
        dataset.postWorkIndependentOriginCandidateCount,
      unresolved:
        dataset.unresolvedCoactiveOriginCount,
    })),
  );
  console.log(
    'Totals: '
    + `${report.totals.datasetCount} datasets, `
    + `${report.totals.groupCount} groups, `
    + `${report.totals.pairCount} pairs`,
  );
  console.log(
    `Active-origin reconfirmations: ${report.totals.activeOriginReconfirmationCount}`,
  );
  console.log(
    `Worked-origin retention rearms: ${report.totals.workedOriginRetentionRearmCount}`,
  );
  console.log(
    `Independent-origin candidates: ${report.totals.postWorkIndependentOriginCandidateCount}`,
  );
  console.log(
    `Unresolved coactive origins: ${report.totals.unresolvedCoactiveOriginCount}`,
  );
  console.log(
    'Origin gap buckets: '
    + `1-9=${report.totals.gapBuckets.bars1To9}, `
    + `10-29=${report.totals.gapBuckets.bars10To29}, `
    + `30-59=${report.totals.gapBuckets.bars30To59}, `
    + `60+=${report.totals.gapBuckets.bars60Plus}`,
  );
  console.log(
    'Origin gap bars: '
    + `min=${String(report.totals.minimumOriginGapBars)}, `
    + `median=${String(report.totals.medianOriginGapBars)}, `
    + `max=${String(report.totals.maximumOriginGapBars)}`,
  );
  console.log(
    `All pairs inherited prior-origin evidence: ${report.allObservedPairsInheritedPriorOriginEvidence}`,
  );
  console.log(
    `Split resolution contract required: ${report.requiresSplitResolutionContract}`,
  );
  console.log(
    `Invariant violations: ${report.totals.violationCount}`,
  );
  console.log(`Status: ${report.status}`);
  console.log(
    `Single global price merge recommended: ${report.recommendsSingleGlobalPriceMerge}`,
  );
  console.log(
    `Production Level identity changed: ${report.changesLevelIdentity}`,
  );
  console.log(`Report: ${timestampedPath}`);
  console.log(`Latest: ${latestPath}`);

  if (report.status === 'invalid') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
