export const LEVEL_ENGINE_FROZEN_SAMPLE_PATH =
  '/api/v1/level-engine/frozen-sample/latest';

export const LEVEL_ENGINE_FROZEN_SAMPLE_VERSION =
  'level-engine-frozen-sample-v0.1' as const;

export const LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES = [
  '1m',
  '5m',
  '15m',
  '1h',
  '4h',
] as const;

export const LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS = [
  'source_detected_late_or_post_break',
  'causal_track_missing',
  'detector_disappeared',
  'detector_reappeared',
  'selected_cycle_not_current',
  'selected_cycle_role_changed',
  'source_touch_history_discarded',
  'selected_cycle_broke_before_confirmation',
  'selected_cycle_confirmed_at_or_after_break',
  'selected_cycle_not_observed',
] as const;

const LEVEL_ENGINE_KINDS = [
  'support',
  'resistance',
] as const;

const LEVEL_ENGINE_MATURITIES = [
  'candidate',
  'developing',
  'confirmed',
] as const;

const LEVEL_ENGINE_TRANSITIONS = [
  'origin',
  'reclaim',
  'flip',
] as const;

const LEVEL_ENGINE_REVIEW_STATES = [
  'active',
  'broken',
  'stale',
  'pending',
] as const;

export type LevelEngineFrozenSampleTimeframe =
  typeof LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES[number];

export type LevelEngineFrozenSampleDiagnosticFlag =
  typeof LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS[number];

export type LevelEngineFrozenSampleKind =
  typeof LEVEL_ENGINE_KINDS[number];

export type LevelEngineFrozenSampleMaturity =
  typeof LEVEL_ENGINE_MATURITIES[number];

export type LevelEngineFrozenSampleTransition =
  typeof LEVEL_ENGINE_TRANSITIONS[number];

export type LevelEngineFrozenSampleReviewState =
  typeof LEVEL_ENGINE_REVIEW_STATES[number];

export interface LevelEngineFrozenSampleZone {
  readonly low: number;
  readonly reference: number;
  readonly high: number;
}

export interface LevelEngineFrozenSampleCandle {
  readonly openTime: string;
  readonly closeTime: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly isClosed: boolean;
}

export interface LevelEngineFrozenSampleDataset {
  readonly key: string;
  readonly symbol: string;
  readonly sourceTimeframe:
    LevelEngineFrozenSampleTimeframe;
  readonly candles:
    readonly LevelEngineFrozenSampleCandle[];
}

export interface LevelEngineFrozenSampleItem {
  readonly id: string;
  readonly selectionIndex: number;
  readonly datasetKey: string;
  readonly symbol: string;
  readonly sourceTimeframe:
    LevelEngineFrozenSampleTimeframe;
  readonly sourceCandidateId: string;
  readonly selectedCandidateId: string;
  readonly sourceKind:
    LevelEngineFrozenSampleKind;
  readonly selectedKind:
    LevelEngineFrozenSampleKind;
  readonly selectedMaturity:
    LevelEngineFrozenSampleMaturity;
  readonly selectedTransition:
    LevelEngineFrozenSampleTransition;
  readonly reviewState:
    LevelEngineFrozenSampleReviewState;
  readonly selectedZone:
    LevelEngineFrozenSampleZone;
  readonly sourceActiveFrom: string;
  readonly sourceDetectedAt: string;
  readonly selectedActiveFrom: string;
  readonly selectedDetectedAt: string;
  readonly diagnosticFlags:
    readonly LevelEngineFrozenSampleDiagnosticFlag[];
  readonly reviewItem:
    Readonly<Record<string, unknown>>;
}

export interface LevelEngineFrozenSampleSelection {
  readonly strategy:
    'round_robin_symbol_timeframe_then_review_order';
  readonly requestedLimit: number;
  readonly availableItemCount: number;
  readonly selectedItemCount: number;
  readonly omittedItemCount: number;
  readonly datasetCount: number;
  readonly complete: boolean;
}

export interface LevelEngineFrozenSampleCounts {
  readonly bySymbol:
    Readonly<Record<string, number>>;
  readonly byTimeframe:
    Readonly<Record<string, number>>;
  readonly byReviewState:
    Readonly<Record<string, number>>;
  readonly byTransition:
    Readonly<Record<string, number>>;
  readonly bySelectedCycleConfirmationState:
    Readonly<Record<string, number>>;
  readonly byDiagnosticFlag:
    Readonly<Record<
      LevelEngineFrozenSampleDiagnosticFlag,
      number
    >>;
}

export interface LevelEngineFrozenSample {
  readonly id: string;
  readonly version:
    typeof LEVEL_ENGINE_FROZEN_SAMPLE_VERSION;
  readonly sourceReportVersion: string;
  readonly generatedAt: string;
  readonly requestedSymbols:
    readonly string[];
  readonly requestedTimeframes:
    readonly LevelEngineFrozenSampleTimeframe[];
  readonly appliedOptions:
    Readonly<Record<string, unknown>>;
  readonly selection:
    LevelEngineFrozenSampleSelection;
  readonly datasets:
    readonly LevelEngineFrozenSampleDataset[];
  readonly items:
    readonly LevelEngineFrozenSampleItem[];
  readonly counts:
    LevelEngineFrozenSampleCounts;
  readonly observationalOnly: true;
  readonly createsSetup: false;
  readonly mergesAcrossTimeframes: false;
  readonly usesQualityScore: false;
  readonly usesFutureCandles: false;
  readonly intendedForManualReview: true;
}

export type LevelEngineFrozenSampleFetch =
  typeof globalThis.fetch;

export interface FetchLevelEngineFrozenSampleOptions {
  readonly baseUrl?: string;
  readonly signal?: AbortSignal;
  readonly fetcher?:
    LevelEngineFrozenSampleFetch;
}

type JsonRecord =
  Record<string, unknown>;

function normalizeBaseUrl(
  value: string | undefined,
): string {
  return (
    value
      ?.trim()
      .replace(/\/+$/u, '')
    ?? ''
  );
}

function readRecord(
  value: unknown,
  field: string,
): JsonRecord {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample object: ${field}`,
    );
  }

  return value as JsonRecord;
}

function readArray(
  record: JsonRecord,
  key: string,
): readonly unknown[] {
  const value =
    record[key];

  if (!Array.isArray(value)) {
    throw new Error(
      `Invalid Level Engine frozen sample array: ${key}`,
    );
  }

  return value;
}

function readString(
  record: JsonRecord,
  key: string,
): string {
  const value =
    record[key];

  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample string: ${key}`,
    );
  }

  return value;
}

function readNumber(
  record: JsonRecord,
  key: string,
): number {
  const value =
    record[key];

  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample number: ${key}`,
    );
  }

  return value;
}

function readInteger(
  record: JsonRecord,
  key: string,
): number {
  const value =
    readNumber(
      record,
      key,
    );

  if (
    !Number.isInteger(value)
    || value < 0
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample integer: ${key}`,
    );
  }

  return value;
}

function readBoolean(
  record: JsonRecord,
  key: string,
): boolean {
  const value =
    record[key];

  if (typeof value !== 'boolean') {
    throw new Error(
      `Invalid Level Engine frozen sample boolean: ${key}`,
    );
  }

  return value;
}

function readLiteralBoolean<
  T extends boolean,
>(
  record: JsonRecord,
  key: string,
  expected: T,
): T {
  const value =
    readBoolean(
      record,
      key,
    );

  if (value !== expected) {
    throw new Error(
      `Invalid Level Engine frozen sample invariant: ${key}`,
    );
  }

  return expected;
}

function readEnum<
  T extends readonly string[],
>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (
    typeof value !== 'string'
    || !allowed.includes(
      value as T[number],
    )
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample enum: ${field}`,
    );
  }

  return value as T[number];
}

function readStringArray(
  record: JsonRecord,
  key: string,
): readonly string[] {
  return readArray(
    record,
    key,
  ).map(
    (
      value,
      index,
    ) => {
      if (
        typeof value !== 'string'
        || value.trim().length === 0
      ) {
        throw new Error(
          `Invalid Level Engine frozen sample string: ${key}[${index}]`,
        );
      }

      return value;
    },
  );
}

function readEnumArray<
  T extends readonly string[],
>(
  record: JsonRecord,
  key: string,
  allowed: T,
): readonly T[number][] {
  return readArray(
    record,
    key,
  ).map(
    (
      value,
      index,
    ) =>
      readEnum(
        value,
        allowed,
        `${key}[${index}]`,
      ),
  );
}

function parseZone(
  value: unknown,
  field: string,
): LevelEngineFrozenSampleZone {
  const record =
    readRecord(
      value,
      field,
    );

  const low =
    readNumber(
      record,
      'low',
    );
  const reference =
    readNumber(
      record,
      'reference',
    );
  const high =
    readNumber(
      record,
      'high',
    );

  if (
    low > reference
    || reference > high
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample zone: ${field}`,
    );
  }

  return {
    low,
    reference,
    high,
  };
}

function parseCandle(
  value: unknown,
  index: number,
): LevelEngineFrozenSampleCandle {
  const record =
    readRecord(
      value,
      `candle[${index}]`,
    );

  const open =
    readNumber(
      record,
      'open',
    );
  const high =
    readNumber(
      record,
      'high',
    );
  const low =
    readNumber(
      record,
      'low',
    );
  const close =
    readNumber(
      record,
      'close',
    );

  if (
    low > high
    || open < low
    || open > high
    || close < low
    || close > high
  ) {
    throw new Error(
      `Invalid Level Engine frozen sample candle geometry: ${index}`,
    );
  }

  return {
    openTime:
      readString(
        record,
        'openTime',
      ),
    closeTime:
      readString(
        record,
        'closeTime',
      ),
    open,
    high,
    low,
    close,
    isClosed:
      readBoolean(
        record,
        'isClosed',
      ),
  };
}

function parseDataset(
  value: unknown,
  index: number,
): LevelEngineFrozenSampleDataset {
  const record =
    readRecord(
      value,
      `dataset[${index}]`,
    );

  return {
    key:
      readString(
        record,
        'key',
      ),
    symbol:
      readString(
        record,
        'symbol',
      ),
    sourceTimeframe:
      readEnum(
        record.sourceTimeframe,
        LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES,
        `dataset[${index}].sourceTimeframe`,
      ),
    candles:
      readArray(
        record,
        'candles',
      ).map(
        parseCandle,
      ),
  };
}

function parseItem(
  value: unknown,
  index: number,
): LevelEngineFrozenSampleItem {
  const record =
    readRecord(
      value,
      `item[${index}]`,
    );

  return {
    id:
      readString(
        record,
        'id',
      ),
    selectionIndex:
      readInteger(
        record,
        'selectionIndex',
      ),
    datasetKey:
      readString(
        record,
        'datasetKey',
      ),
    symbol:
      readString(
        record,
        'symbol',
      ),
    sourceTimeframe:
      readEnum(
        record.sourceTimeframe,
        LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES,
        `item[${index}].sourceTimeframe`,
      ),
    sourceCandidateId:
      readString(
        record,
        'sourceCandidateId',
      ),
    selectedCandidateId:
      readString(
        record,
        'selectedCandidateId',
      ),
    sourceKind:
      readEnum(
        record.sourceKind,
        LEVEL_ENGINE_KINDS,
        `item[${index}].sourceKind`,
      ),
    selectedKind:
      readEnum(
        record.selectedKind,
        LEVEL_ENGINE_KINDS,
        `item[${index}].selectedKind`,
      ),
    selectedMaturity:
      readEnum(
        record.selectedMaturity,
        LEVEL_ENGINE_MATURITIES,
        `item[${index}].selectedMaturity`,
      ),
    selectedTransition:
      readEnum(
        record.selectedTransition,
        LEVEL_ENGINE_TRANSITIONS,
        `item[${index}].selectedTransition`,
      ),
    reviewState:
      readEnum(
        record.reviewState,
        LEVEL_ENGINE_REVIEW_STATES,
        `item[${index}].reviewState`,
      ),
    selectedZone:
      parseZone(
        record.selectedZone,
        `item[${index}].selectedZone`,
      ),
    sourceActiveFrom:
      readString(
        record,
        'sourceActiveFrom',
      ),
    sourceDetectedAt:
      readString(
        record,
        'sourceDetectedAt',
      ),
    selectedActiveFrom:
      readString(
        record,
        'selectedActiveFrom',
      ),
    selectedDetectedAt:
      readString(
        record,
        'selectedDetectedAt',
      ),
    diagnosticFlags:
      readEnumArray(
        record,
        'diagnosticFlags',
        LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS,
      ),
    reviewItem:
      readRecord(
        record.reviewItem,
        `item[${index}].reviewItem`,
      ),
  };
}

function parseNumberRecord(
  value: unknown,
  field: string,
): Readonly<Record<string, number>> {
  const record =
    readRecord(
      value,
      field,
    );

  return Object.fromEntries(
    Object.entries(
      record,
    ).map(
      (
        [
          key,
          item,
        ],
      ) => {
        if (
          typeof item !== 'number'
          || !Number.isInteger(item)
          || item < 0
        ) {
          throw new Error(
            `Invalid Level Engine frozen sample count: ${field}.${key}`,
          );
        }

        return [
          key,
          item,
        ];
      },
    ),
  );
}

function parseDiagnosticCounts(
  value: unknown,
): Readonly<Record<
  LevelEngineFrozenSampleDiagnosticFlag,
  number
>> {
  const record =
    parseNumberRecord(
      value,
      'counts.byDiagnosticFlag',
    );

  return Object.fromEntries(
    LEVEL_ENGINE_FROZEN_SAMPLE_DIAGNOSTIC_FLAGS.map(
      (flag) => [
        flag,
        record[flag] ?? 0,
      ],
    ),
  ) as Readonly<Record<
    LevelEngineFrozenSampleDiagnosticFlag,
    number
  >>;
}

function parseSelection(
  value: unknown,
): LevelEngineFrozenSampleSelection {
  const record =
    readRecord(
      value,
      'selection',
    );

  const strategy =
    readString(
      record,
      'strategy',
    );

  if (
    strategy
    !== 'round_robin_symbol_timeframe_then_review_order'
  ) {
    throw new Error(
      'Invalid Level Engine frozen sample selection strategy',
    );
  }

  return {
    strategy,
    requestedLimit:
      readInteger(
        record,
        'requestedLimit',
      ),
    availableItemCount:
      readInteger(
        record,
        'availableItemCount',
      ),
    selectedItemCount:
      readInteger(
        record,
        'selectedItemCount',
      ),
    omittedItemCount:
      readInteger(
        record,
        'omittedItemCount',
      ),
    datasetCount:
      readInteger(
        record,
        'datasetCount',
      ),
    complete:
      readBoolean(
        record,
        'complete',
      ),
  };
}

function parseCounts(
  value: unknown,
): LevelEngineFrozenSampleCounts {
  const record =
    readRecord(
      value,
      'counts',
    );

  return {
    bySymbol:
      parseNumberRecord(
        record.bySymbol,
        'counts.bySymbol',
      ),
    byTimeframe:
      parseNumberRecord(
        record.byTimeframe,
        'counts.byTimeframe',
      ),
    byReviewState:
      parseNumberRecord(
        record.byReviewState,
        'counts.byReviewState',
      ),
    byTransition:
      parseNumberRecord(
        record.byTransition,
        'counts.byTransition',
      ),
    bySelectedCycleConfirmationState:
      parseNumberRecord(
        record.bySelectedCycleConfirmationState,
        'counts.bySelectedCycleConfirmationState',
      ),
    byDiagnosticFlag:
      parseDiagnosticCounts(
        record.byDiagnosticFlag,
      ),
  };
}

export function parseLevelEngineFrozenSample(
  value: unknown,
): LevelEngineFrozenSample {
  const record =
    readRecord(
      value,
      'root',
    );

  const version =
    readString(
      record,
      'version',
    );

  if (
    version
    !== LEVEL_ENGINE_FROZEN_SAMPLE_VERSION
  ) {
    throw new Error(
      'Unsupported Level Engine frozen sample version',
    );
  }

  const datasets =
    readArray(
      record,
      'datasets',
    ).map(
      parseDataset,
    );

  const items =
    readArray(
      record,
      'items',
    ).map(
      parseItem,
    );

  const selection =
    parseSelection(
      record.selection,
    );

  if (
    selection.datasetCount
    !== datasets.length
    || selection.selectedItemCount
      !== items.length
  ) {
    throw new Error(
      'Invalid Level Engine frozen sample selection counts',
    );
  }

  const datasetsByKey =
    new Map(
      datasets.map(
        (dataset) => [
          dataset.key,
          dataset,
        ] as const,
      ),
    );

  for (const item of items) {
    const dataset =
      datasetsByKey.get(
        item.datasetKey,
      );

    if (
      !dataset
      || dataset.symbol !== item.symbol
      || dataset.sourceTimeframe
        !== item.sourceTimeframe
    ) {
      throw new Error(
        `Invalid Level Engine frozen sample dataset reference: ${item.id}`,
      );
    }
  }

  return {
    id:
      readString(
        record,
        'id',
      ),
    version:
      LEVEL_ENGINE_FROZEN_SAMPLE_VERSION,
    sourceReportVersion:
      readString(
        record,
        'sourceReportVersion',
      ),
    generatedAt:
      readString(
        record,
        'generatedAt',
      ),
    requestedSymbols:
      readStringArray(
        record,
        'requestedSymbols',
      ),
    requestedTimeframes:
      readEnumArray(
        record,
        'requestedTimeframes',
        LEVEL_ENGINE_FROZEN_SAMPLE_TIMEFRAMES,
      ),
    appliedOptions:
      readRecord(
        record.appliedOptions,
        'appliedOptions',
      ),
    selection,
    datasets,
    items,
    counts:
      parseCounts(
        record.counts,
      ),
    observationalOnly:
      readLiteralBoolean(
        record,
        'observationalOnly',
        true,
      ),
    createsSetup:
      readLiteralBoolean(
        record,
        'createsSetup',
        false,
      ),
    mergesAcrossTimeframes:
      readLiteralBoolean(
        record,
        'mergesAcrossTimeframes',
        false,
      ),
    usesQualityScore:
      readLiteralBoolean(
        record,
        'usesQualityScore',
        false,
      ),
    usesFutureCandles:
      readLiteralBoolean(
        record,
        'usesFutureCandles',
        false,
      ),
    intendedForManualReview:
      readLiteralBoolean(
        record,
        'intendedForManualReview',
        true,
      ),
  };
}

export function findLevelEngineFrozenSampleDataset(
  sample: LevelEngineFrozenSample,
  item: LevelEngineFrozenSampleItem,
): LevelEngineFrozenSampleDataset {
  const dataset =
    sample.datasets.find(
      (candidate) =>
        candidate.key
        === item.datasetKey,
    );

  if (!dataset) {
    throw new Error(
      `Level Engine frozen sample dataset was not found: ${item.datasetKey}`,
    );
  }

  return dataset;
}

const defaultFetch:
LevelEngineFrozenSampleFetch = (
  input,
  init,
) =>
  globalThis.fetch(
    input,
    init,
  );

export async function fetchLevelEngineFrozenSample(
  options:
    FetchLevelEngineFrozenSampleOptions = {},
): Promise<LevelEngineFrozenSample> {
  const response =
    await (
      options.fetcher
      ?? defaultFetch
    )(
      normalizeBaseUrl(
        options.baseUrl,
      )
      + LEVEL_ENGINE_FROZEN_SAMPLE_PATH,
      {
        method:
          'GET',
        headers: {
          accept:
            'application/json',
        },
        ...(
          options.signal
            ? {
                signal:
                  options.signal,
              }
            : {}
        ),
      },
    );

  let payload:
    unknown;

  try {
    payload =
      await response.json();
  } catch {
    throw new Error(
      'Level Engine frozen sample returned invalid JSON',
    );
  }

  if (!response.ok) {
    throw new Error(
      `Level Engine frozen sample request failed with status ${response.status}`,
    );
  }

  return parseLevelEngineFrozenSample(
    payload,
  );
}