import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  buildCausalObservationThresholdCounterfactualValidationReport,
} from './causal-observation-threshold-counterfactual-validation.js';
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
        .CAUSAL_OBSERVATION_THRESHOLD_SOURCE_REPORT
      ?? '.tmp/causal-setup-validation/latest.json',
    );
  const outputDirectory =
    resolve(
      process.cwd(),
      process.env
        .CAUSAL_OBSERVATION_THRESHOLD_OUTPUT_DIR
      ?? '.tmp/causal-observation-threshold-counterfactual-validation',
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
    'CAUSAL OBSERVATION THRESHOLD COUNTERFACTUAL VALIDATION STARTED',
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
    buildCausalObservationThresholdCounterfactualValidationReport(
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
                universeLineCount:
                  value.lines.length,
                policies:
                  value.policies,
                anomalies:
                  value.anomalies,
              }),
          ),
        ),
      offlineOnly:
        report.offlineOnly,
      buildsUniverseFromProductionLevelLines:
        report
          .buildsUniverseFromProductionLevelLines,
      changesTradingRules:
        report.changesTradingRules,
      createsLiveSetup:
        report.createsLiveSetup,
      createsSignal:
        report.createsSignal,
      usesFutureCandlesForEntry:
        report.usesFutureCandlesForEntry,
      usesFutureCandlesForOutcomeEvaluation:
        report
          .usesFutureCandlesForOutcomeEvaluation,
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
    'CAUSAL OBSERVATION THRESHOLD COUNTERFACTUAL VALIDATION',
  );
  console.log(
    `Generated at: ${report.generatedAt}`,
  );
  console.log(
    `Elapsed: ${Math.max(0, Date.now() - startedAt)} ms`,
  );
  console.log(
    `Counterfactual universe lines: ${report.totals.universeLineCount}`,
  );
  console.log(
    `Current candidate lines: ${report.totals.currentCandidateLineCount}`,
  );
  console.log(
    `Non-candidate universe lines: ${report.totals.nonCandidateUniverseLineCount}`,
  );
  console.log(
    `Replay anomalies: ${report.totals.anomalies.totalCount}`,
  );
  console.table(
    report.totals.policies.map(
      (value) => ({
        policy:
          value.policy,
        entries:
          value.entryLineCount,
        current:
          value.currentCandidateEntryLineCount,
        additional:
          value
            .additionalCounterfactualEntryLineCount,
        approached:
          value.approachReachedLineCount,
        noApproach:
          value.noSubsequentApproachLineCount,
        additionalNoApproach:
          value.additionalNoApproachLineCount,
        sameBar:
          value.sameBarApproachLineCount,
        medianLead:
          value.barsToApproach.medianBars,
        disappearances:
          value.churn.disappearanceCount,
        reappearances:
          value.churn.reappearanceCount,
        medianContinuous:
          value
            .continuousObservationBars
            .medianBars,
      }),
    ),
  );
  console.log('');
  console.log(
    'POLICY CHURN ATTRIBUTION',
  );
  console.table(
    report.totals.policies.map(
      (value) => ({
        policy:
          value.policy,
        progressRegression:
          value.churn
            .progressRegressionDisappearanceCount,
        geometryUnavailable:
          value.churn
            .geometryUnavailableDisappearanceCount,
        disappearancePerEntry:
          value.disappearancePerEntryLine,
        reappearancePerEntry:
          value.reappearancePerEntryLine,
      }),
    ),
  );
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
            universe:
              symbol.lines.length,
            policy:
              policy.policy,
            entries:
              policy.entryLineCount,
            additional:
              policy
                .additionalCounterfactualEntryLineCount,
            approached:
              policy.approachReachedLineCount,
            noApproach:
              policy.noSubsequentApproachLineCount,
            sameBar:
              policy.sameBarApproachLineCount,
            disappearances:
              policy.churn.disappearanceCount,
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
    'CAUSAL OBSERVATION THRESHOLD COUNTERFACTUAL VALIDATION COMPLETE',
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
