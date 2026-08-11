import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  buildCausalStageBoundaryAnalysisReport,
} from './causal-stage-boundary-analysis.js';
import type {
  CausalSetupRealDataValidationReport,
} from './causal-setup-real-data-validation.types.js';

function safeTimestamp(
  value: string,
): string {
  return value.replace(
    /[:.]/g,
    '-',
  );
}

async function main(): Promise<void> {
  const sourcePath =
    resolve(
      process.cwd(),
      process.env
        .CAUSAL_STAGE_BOUNDARY_SOURCE_REPORT
      ?? '.tmp/causal-setup-validation/latest.json',
    );
  const outputDirectory =
    resolve(
      process.cwd(),
      process.env
        .CAUSAL_STAGE_BOUNDARY_OUTPUT_DIR
      ?? '.tmp/causal-stage-boundary-analysis',
    );
  const serializedSource =
    await readFile(
      sourcePath,
      'utf8',
    );
  const source =
    JSON.parse(
      serializedSource,
    ) as CausalSetupRealDataValidationReport;
  const startedAt =
    Date.now();
  const progressStepBySymbol =
    new Map<string, number>();

  console.log('');
  console.log(
    'CAUSAL STAGE BOUNDARY ANALYSIS STARTED',
  );
  console.log(
    `Source: ${sourcePath}`,
  );
  console.log(
    `Symbols: ${source.requestedSymbols.join(', ')}`,
  );
  console.log(
    'Replaying saved closed-candle datasets; no network data is requested.',
  );

  const report =
    buildCausalStageBoundaryAnalysisReport(
      source,
      {
        onReplayProgress:
          (progress) => {
            const interval =
              Math.max(
                1,
                Math.floor(
                  progress.totalStepCount
                  / 20,
                ),
              );
            const previous =
              progressStepBySymbol.get(
                progress.symbol,
              )
              ?? 0;
            const shouldPrint =
              progress.completedStepCount
                === 1
              || progress.completedStepCount
                === progress.totalStepCount
              || progress.completedStepCount
                - previous >= interval;

            if (!shouldPrint) {
              return;
            }

            progressStepBySymbol.set(
              progress.symbol,
              progress.completedStepCount,
            );
            const percent =
              Math.floor(
                progress.completedStepCount
                / progress.totalStepCount
                * 100,
              );

            console.log(
              `[${progress.symbol}] ${progress.completedStepCount}/${progress.totalStepCount} steps (${percent}%)`,
            );
          },
      },
    );
  const timestamp =
    safeTimestamp(
      report.generatedAt,
    );
  const reportJson =
    `${JSON.stringify(report, null, 2)}\n`;
  const churn =
    Object.freeze({
      version:
        report.version,
      generatedAt:
        report.generatedAt,
      totals:
        report.totals.churn,
      lines:
        Object.freeze(
          report.symbolReports
            .flatMap(
              (symbolReport) =>
                symbolReport.lines,
            )
            .map(
              (line) =>
                Object.freeze({
                  symbol:
                    line.symbol,
                  lineId:
                    line.lineId,
                  levelKind:
                    line.levelKind,
                  levelPrice:
                    line.levelPrice,
                  ...line.churn,
                }),
            ),
        ),
    });
  const churnJson =
    `${JSON.stringify(churn, null, 2)}\n`;

  await mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );
  await Promise.all([
    writeFile(
      resolve(
        outputDirectory,
        `report-${timestamp}.json`,
      ),
      reportJson,
      'utf8',
    ),
    writeFile(
      resolve(
        outputDirectory,
        'latest.json',
      ),
      reportJson,
      'utf8',
    ),
    writeFile(
      resolve(
        outputDirectory,
        `churn-${timestamp}.json`,
      ),
      churnJson,
      'utf8',
    ),
    writeFile(
      resolve(
        outputDirectory,
        'churn-latest.json',
      ),
      churnJson,
      'utf8',
    ),
  ]);

  console.log('');
  console.log(
    'CAUSAL STAGE BOUNDARY ANALYSIS',
  );
  console.log(
    `Source: ${sourcePath}`,
  );
  console.log(
    `Generated at: ${report.generatedAt}`,
  );
  console.log(
    `Elapsed: ${Math.max(0, Date.now() - startedAt)} ms`,
  );
  console.log(
    `Unique candidate lines: ${report.totals.uniqueLineCount}`,
  );
  console.log(
    `Candidate pair anomalies: ${report.totals.candidatePairAnomalyCount}`,
  );
  console.table([
    report.totals.current,
    report.totals.nextClosedCandle,
    report.totals
      .outsideToInsideCrossing,
  ].map(
    (value) => ({
      policy:
        value.policy,
      approach:
        value.approachCount,
      sameBar:
        value.sameBarApproachCount,
      delayed:
        value.delayedApproachCount,
      never:
        value.neverApproachCount,
      retainedCurrent:
        value.retainedCurrentApproachCount,
      delayedFromCurrent:
        value.delayedFromCurrentCount,
      lostFromCurrent:
        value.lostFromCurrentCount,
      newVsCurrent:
        value.newComparedWithCurrentCount,
      medianLag:
        value.observationToApproachBars
          .medianBars,
      maxLag:
        value.observationToApproachBars
          .maximumBars,
    }),
  ));
  console.log('');
  console.log('SAME-BAR REASONS');
  console.table([
    report.totals.sameBarReasons,
  ]);
  console.log('');
  console.log('LIFECYCLE CHURN');
  console.table([
    report.totals.churn,
  ]);
  console.log('');
  console.log(
    'PER-SYMBOL POLICY COMPARISON',
  );
  console.table(
    report.symbolReports.map(
      (value) => ({
        symbol:
          value.symbol,
        lines:
          value.lines.length,
        current:
          value.current.approachCount,
        currentSameBar:
          value.current.sameBarApproachCount,
        nextCandle:
          value.nextClosedCandle
            .approachCount,
        nextLost:
          value.nextClosedCandle
            .lostFromCurrentCount,
        crossing:
          value.outsideToInsideCrossing
            .approachCount,
        crossingLost:
          value.outsideToInsideCrossing
            .lostFromCurrentCount,
        churnLines:
          value.churn
            .linesWithReappearance,
      }),
    ),
  );
  console.log('');
  console.log(
    'Trading rules changed: no',
  );
  console.log(
    'Production runtime changed: no',
  );
  console.log(
    `Full report: ${resolve(outputDirectory, 'latest.json')}`,
  );
  console.log(
    `Churn dataset: ${resolve(outputDirectory, 'churn-latest.json')}`,
  );
  console.log('');
  console.log(
    'CAUSAL STAGE BOUNDARY ANALYSIS COMPLETE',
  );
}

main().catch(
  (error: unknown) => {
    const message =
      error instanceof Error
        ? error.stack
          ?? error.message
        : String(error);

    console.error(message);
    process.exitCode = 1;
  },
);
