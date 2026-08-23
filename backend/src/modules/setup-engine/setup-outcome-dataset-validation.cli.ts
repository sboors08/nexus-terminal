import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import {
  BinanceMarketHistoryClient,
} from '../realtime-market-data/binance-market-history.client.js';
import {
  JsonFileSetupEventHistoryPersistence,
} from './setup-event-history.persistence.js';
import {
  buildSetupOutcomeDatasetValidation,
} from './setup-outcome-dataset-validation.js';

function positiveInteger(
  value:
    string
    | undefined,

  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed =
    Number(
      value,
    );

  return (
    Number.isInteger(parsed)
    && parsed > 0
  )
    ? parsed
    : fallback;
}

async function main():
Promise<void> {
  const historyPath =
    process.env
      .SETUP_EVENT_HISTORY_PERSISTENCE_PATH
    ?? './data/setup-event-history-v1.json';

  const outputPath =
    resolve(
      process.env
        .SETUP_OUTCOME_DATASET_VALIDATION_OUTPUT_PATH
      ?? './.tmp/setup-outcome-dataset-validation/latest.json',
    );

  const history =
    new JsonFileSetupEventHistoryPersistence({
      filePath:
        historyPath,
    });

  const snapshot =
    await history.load();

  const marketHistory =
    new BinanceMarketHistoryClient({
      baseUrl:
        process.env.BINANCE_BASE_URL
        ?? 'https://fapi.binance.com',

      requestTimeoutMs:
        positiveInteger(
          process.env
            .BINANCE_REQUEST_TIMEOUT_MS,
          15_000,
        ),
    });

  const report =
    await buildSetupOutcomeDatasetValidation({
      events:
        snapshot?.events
        ?? [],

      droppedEventsCount:
        snapshot
          ?.droppedEventsCount
        ?? 0,

      historySnapshotFound:
        snapshot !== null,

      snapshotSavedAt:
        snapshot?.savedAt
        ?? null,

      marketHistorySource:
        marketHistory,
    });

  await mkdir(
    dirname(
      outputPath,
    ),
    {
      recursive:
        true,
    },
  );

  await writeFile(
    outputPath,
    `${JSON.stringify(
      report,
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(
    '===== SETUP OUTCOME DATASET / VALIDATION v0.1 =====',
  );

  console.log(
    `Version: ${report.version}`,
  );

  console.log(
    `Status: ${report.status}`,
  );

  console.log(
    `History snapshot found: ${report.source.historySnapshotFound}`,
  );

  console.log(
    `Retained events: ${report.source.retainedEventsCount}`,
  );

  console.log(
    `Candidates: ${report.diagnostics.candidatesCount}`,
  );

  console.log(
    `Terminal candidates: ${report.diagnostics.terminalCandidatesCount}`,
  );

  console.log(
    `Anchored terminal candidates: ${report.diagnostics.anchoredTerminalCandidatesCount}`,
  );

  console.log(
    `Measured candidates: ${report.diagnostics.measuredCandidatesCount}`,
  );

  console.log(
    `Pending windows: ${report.diagnostics.pendingWindowCandidatesCount}`,
  );

  console.log(
    `Missing third-touch anchors: ${report.diagnostics.missingThirdTouchAnchorCount}`,
  );

  console.log(
    `Insufficient candle coverage: ${report.diagnostics.insufficientCandleCoverageCount}`,
  );

  console.log(
    `Market history errors: ${report.diagnostics.marketHistoryErrorCount}`,
  );

  console.log(
    `Multiple terminal anomalies: ${report.diagnostics.multipleTerminalEventsCount}`,
  );

  console.log(
    `Profitability labels applied: ${report.profitabilityLabelApplied}`,
  );

  console.log(
    `Trading rules changed: ${report.changesTradingRules}`,
  );

  console.log(
    `Training applied: ${report.trainingApplied}`,
  );

  console.log(
    `Output: ${outputPath}`,
  );
}

main()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );