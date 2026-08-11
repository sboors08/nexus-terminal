import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  buildCausalObservationEntryGeometryAnalysisReport,
} from './causal-observation-entry-geometry-analysis.js';
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
        .CAUSAL_OBSERVATION_ENTRY_SOURCE_REPORT
      ?? '.tmp/causal-setup-validation/latest.json',
    );
  const outputDirectory =
    resolve(
      process.cwd(),
      process.env
        .CAUSAL_OBSERVATION_ENTRY_OUTPUT_DIR
      ?? '.tmp/causal-observation-entry-geometry-analysis',
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
    'CAUSAL OBSERVATION ENTRY GEOMETRY ANALYSIS STARTED',
  );
  console.log(
    `Source: ${sourcePath}`,
  );
  console.log(
    `Symbols: ${source.requestedSymbols.join(', ')}`,
  );
  console.log(
    'Replaying saved closed-candle prefixes; no network data is requested.',
  );

  const report =
    buildCausalObservationEntryGeometryAnalysisReport(
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
  const summary =
    Object.freeze({
      version:
        report.version,
      generatedAt:
        report.generatedAt,
      requestedSymbols:
        report.requestedSymbols,
      progressThresholds:
        report.progressThresholds,
      totals:
        report.totals,
      symbols:
        Object.freeze(
          report.symbolReports.map(
            (value) =>
              Object.freeze({
                symbol:
                  value.symbol,
                uniqueLineCount:
                  value.lines.length,
                policies:
                  value.policies,
                churn:
                  value.churn,
              }),
          ),
        ),
      offlineOnly:
        report.offlineOnly,
      changesTradingRules:
        report.changesTradingRules,
      createsLiveSetup:
        report.createsLiveSetup,
      createsSignal:
        report.createsSignal,
      usesFutureCandles:
        report.usesFutureCandles,
      usesFutureCandlesForEntry:
        report.usesFutureCandlesForEntry,
      usesFutureRealtimeEvidence:
        report.usesFutureRealtimeEvidence,
    });
  const summaryJson =
    `${JSON.stringify(summary, null, 2)}\n`;

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
        `summary-${timestamp}.json`,
      ),
      summaryJson,
      'utf8',
    ),
    writeFile(
      resolve(
        outputDirectory,
        'summary-latest.json',
      ),
      summaryJson,
      'utf8',
    ),
  ]);

  console.log('');
  console.log(
    'CAUSAL OBSERVATION ENTRY GEOMETRY ANALYSIS',
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
  console.log(
    `Current Observation replay anomalies: ${report.totals.currentObservationReplayAnomalyCount}`,
  );
  console.table(
    report.totals.policies.map(
      (value) => ({
        policy:
          value.policy,
        entries:
          value.entryCount,
        earlier:
          value.entryBeforeCurrentObservationCount,
        retainedApproach:
          value.retainedCurrentApproachCount,
        lostApproach:
          value.lostCurrentApproachCount,
        sameBar:
          value.sameBarAsCurrentApproachCount,
        falseEarly:
          value
            .falseEarlyObservationWithoutApproachCount,
        medianLeadToApproach:
          value.leadBarsToCurrentApproach
            .medianBars,
        maxLeadToApproach:
          value.leadBarsToCurrentApproach
            .maximumBars,
      }),
    ),
  );
  console.log('');
  console.log(
    'OBSERVATION ELIGIBILITY CHURN',
  );
  console.table([
    report.totals.churn,
  ]);
  console.log('');
  console.log(
    'PER-SYMBOL POLICY COMPARISON',
  );
  console.table(
    report.symbolReports.flatMap(
      (symbol) =>
        symbol.policies.map(
          (policy) => ({
            symbol:
              symbol.symbol,
            lines:
              symbol.lines.length,
            policy:
              policy.policy,
            earlier:
              policy
                .entryBeforeCurrentObservationCount,
            retained:
              policy
                .retainedCurrentApproachCount,
            lost:
              policy
                .lostCurrentApproachCount,
            sameBar:
              policy
                .sameBarAsCurrentApproachCount,
            falseEarly:
              policy
                .falseEarlyObservationWithoutApproachCount,
          })),
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
    `Summary report: ${resolve(outputDirectory, 'summary-latest.json')}`,
  );
  console.log('');
  console.log(
    'CAUSAL OBSERVATION ENTRY GEOMETRY ANALYSIS COMPLETE',
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
