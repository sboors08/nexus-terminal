import {
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';
import {
  LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS,
  LEVEL_ENGINE_FROZEN_SAMPLE_VERSION,
} from './level-engine-frozen-sample.types.js';
import type {
  LevelEngineFrozenSample,
  LevelEngineFrozenSampleDiagnosticFlag,
} from './level-engine-frozen-sample.types.js';
import {
  LEVEL_ENGINE_TIMEFRAMES,
} from './level-engine.types.js';
import type {
  LevelEngineTimeframe,
} from './level-engine.types.js';

export interface LevelEngineFrozenSampleReader {
  readLatest():
    Promise<LevelEngineFrozenSample | null>;
}

export interface JsonFileLevelEngineFrozenSampleReaderOptions {
  readonly filePath: string;
}

function fail(
  message: string,
): never {
  throw new Error(
    'Level Engine frozen sample reader: ' + message,
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function isNonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === 'string'
    && value.trim().length > 0
  );
}

function isNonNegativeInteger(
  value: unknown,
): value is number {
  return (
    Number.isInteger(value)
    && Number(value) >= 0
  );
}

function isTimeframe(
  value: unknown,
): value is LevelEngineTimeframe {
  return (
    typeof value === 'string'
    && LEVEL_ENGINE_TIMEFRAMES.includes(
      value as LevelEngineTimeframe,
    )
  );
}

function isDiagnosticFlag(
  value: unknown,
): value is LevelEngineFrozenSampleDiagnosticFlag {
  return (
    typeof value === 'string'
    && LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS.includes(
      value as LevelEngineFrozenSampleDiagnosticFlag,
    )
  );
}

function isDataset(
  value: unknown,
): boolean {
  return (
    isRecord(value)
    && isNonEmptyString(value.key)
    && isNonEmptyString(value.symbol)
    && isTimeframe(value.sourceTimeframe)
    && Array.isArray(value.candles)
  );
}

function isItem(
  value: unknown,
): boolean {
  return (
    isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.datasetKey)
    && isNonEmptyString(value.symbol)
    && isTimeframe(value.sourceTimeframe)
    && isRecord(value.selectedZone)
    && Array.isArray(value.diagnosticFlags)
    && value.diagnosticFlags.every(
      isDiagnosticFlag,
    )
    && isRecord(value.reviewItem)
  );
}

export function parseLevelEngineFrozenSample(
  value: unknown,
): LevelEngineFrozenSample {
  if (!isRecord(value)) {
    fail('payload must be an object');
  }

  if (
    value.version
    !== LEVEL_ENGINE_FROZEN_SAMPLE_VERSION
  ) {
    fail('unsupported version');
  }

  if (
    !isNonEmptyString(value.id)
    || !isNonEmptyString(value.sourceReportVersion)
    || !isNonEmptyString(value.generatedAt)
    || !Number.isFinite(
      Date.parse(value.generatedAt),
    )
  ) {
    fail('invalid identity or generatedAt');
  }

  if (
    !Array.isArray(value.requestedSymbols)
    || !value.requestedSymbols.every(
      isNonEmptyString,
    )
    || !Array.isArray(value.requestedTimeframes)
    || !value.requestedTimeframes.every(
      isTimeframe,
    )
  ) {
    fail('invalid requested datasets');
  }

  if (
    !isRecord(value.appliedOptions)
    || !isRecord(value.selection)
    || !Array.isArray(value.datasets)
    || !value.datasets.every(isDataset)
    || !Array.isArray(value.items)
    || !value.items.every(isItem)
    || !isRecord(value.counts)
  ) {
    fail('invalid sample structure');
  }

  if (
    value.selection.strategy
    !== 'round_robin_symbol_timeframe_then_review_order'
    || !isNonNegativeInteger(
      value.selection.selectedItemCount,
    )
    || !isNonNegativeInteger(
      value.selection.datasetCount,
    )
    || value.selection.selectedItemCount
      !== value.items.length
    || value.selection.datasetCount
      !== value.datasets.length
  ) {
    fail('invalid selection metadata');
  }

  if (
    value.observationalOnly !== true
    || value.createsSetup !== false
    || value.mergesAcrossTimeframes !== false
    || value.usesQualityScore !== false
    || value.usesFutureCandles !== false
    || value.intendedForManualReview !== true
  ) {
    fail('invalid safety guarantees');
  }

  return value as unknown as
    LevelEngineFrozenSample;
}

export class JsonFileLevelEngineFrozenSampleReader
implements LevelEngineFrozenSampleReader {
  readonly #filePath: string;

  constructor(
    options:
      JsonFileLevelEngineFrozenSampleReaderOptions,
  ) {
    const filePath =
      options.filePath.trim();

    if (filePath.length === 0) {
      fail('filePath cannot be empty');
    }

    this.#filePath =
      resolve(filePath);
  }

  async readLatest():
  Promise<LevelEngineFrozenSample | null> {
    let serialized: string;

    try {
      serialized =
        await readFile(
          this.#filePath,
          'utf8',
        );
    } catch (error: unknown) {
      if (
        typeof error === 'object'
        && error !== null
        && 'code' in error
        && (
          error as {
            readonly code?: unknown;
          }
        ).code === 'ENOENT'
      ) {
        return null;
      }

      throw error;
    }

    const value: unknown =
      JSON.parse(serialized);

    return parseLevelEngineFrozenSample(
      value,
    );
  }
}