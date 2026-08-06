import {
  type LevelEngineFrozenSample,
  type LevelEngineFrozenSampleItem,
  type LevelEngineFrozenSampleKind,
  type LevelEngineFrozenSampleTimeframe,
} from '@/shared/api/runtime/levelEngineFrozenSampleApi';

export const LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION =
  1 as const;

export const LEVEL_ENGINE_MANUAL_REVIEW_STORAGE_KEY =
  'nexus.level-engine.manual-review.v1';

export const LEVEL_ENGINE_MANUAL_REVIEW_VERDICTS = [
  'correct',
  'incorrect',
  'needs_review',
] as const;

export const LEVEL_ENGINE_MANUAL_REVIEW_REASON_CODES = [
  'zone_geometry',
  'touch_episodes',
  'lifecycle_split',
  'transition_role',
  'break_detection',
  'causal_timing',
  'market_noise',
  'missing_context',
  'other',
] as const;

export type LevelEngineManualReviewVerdict =
  typeof LEVEL_ENGINE_MANUAL_REVIEW_VERDICTS[number];

export type LevelEngineManualReviewReasonCode =
  typeof LEVEL_ENGINE_MANUAL_REVIEW_REASON_CODES[number];

export interface LevelEngineManualReviewDraft {
  readonly verdict:
    | LevelEngineManualReviewVerdict
    | '';
  readonly reasonCode:
    | LevelEngineManualReviewReasonCode
    | '';
  readonly comment: string;
}

export interface LevelEngineManualReviewAnnotation {
  readonly schemaVersion:
    typeof LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION;
  readonly sampleId: string;
  readonly sampleGeneratedAt: string;
  readonly itemId: string;
  readonly selectionIndex: number;
  readonly symbol: string;
  readonly sourceTimeframe:
    LevelEngineFrozenSampleTimeframe;
  readonly selectedKind:
    LevelEngineFrozenSampleKind;
  readonly selectedTransition: string;
  readonly reviewState: string;
  readonly verdict:
    LevelEngineManualReviewVerdict;
  readonly reasonCode:
    LevelEngineManualReviewReasonCode
    | null;
  readonly comment: string;
  readonly updatedAt: string;
}

export interface LevelEngineManualReviewStore {
  readonly schemaVersion:
    typeof LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION;
  readonly annotations:
    readonly LevelEngineManualReviewAnnotation[];
}

export interface LevelEngineManualReviewSummary {
  readonly total: number;
  readonly reviewed: number;
  readonly remaining: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly needsReview: number;
}

export interface LevelEngineManualReviewExport {
  readonly version:
    'level-engine-manual-review-v0.1';
  readonly generatedAt: string;
  readonly sample: {
    readonly id: string;
    readonly version: string;
    readonly generatedAt: string;
    readonly itemCount: number;
    readonly datasetCount: number;
  };
  readonly summary:
    LevelEngineManualReviewSummary;
  readonly annotations:
    readonly LevelEngineManualReviewAnnotation[];
  readonly observationalOnly: true;
  readonly changesAlgorithm: false;
}

export interface LevelEngineManualReviewStorage {
  getItem(
    key: string,
  ): string | null;
  setItem(
    key: string,
    value: string,
  ): void;
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

function isVerdict(
  value: unknown,
): value is LevelEngineManualReviewVerdict {
  return (
    value === 'correct'
    || value === 'incorrect'
    || value === 'needs_review'
  );
}

function isReasonCode(
  value: unknown,
): value is LevelEngineManualReviewReasonCode {
  return (
    value === 'zone_geometry'
    || value === 'touch_episodes'
    || value === 'lifecycle_split'
    || value === 'transition_role'
    || value === 'break_detection'
    || value === 'causal_timing'
    || value === 'market_noise'
    || value === 'missing_context'
    || value === 'other'
  );
}

function isTimeframe(
  value: unknown,
): value is LevelEngineFrozenSampleTimeframe {
  return (
    value === '1m'
    || value === '5m'
    || value === '15m'
    || value === '1h'
    || value === '4h'
  );
}

function isKind(
  value: unknown,
): value is LevelEngineFrozenSampleKind {
  return (
    value === 'support'
    || value === 'resistance'
  );
}

function annotationKey(
  sampleId: string,
  itemId: string,
): string {
  return `${sampleId}:${itemId}`;
}

function parseAnnotation(
  value: unknown,
): LevelEngineManualReviewAnnotation | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.schemaVersion
      !== LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION
    || typeof value.sampleId !== 'string'
    || typeof value.sampleGeneratedAt !== 'string'
    || typeof value.itemId !== 'string'
    || !Number.isInteger(value.selectionIndex)
    || Number(value.selectionIndex) < 0
    || typeof value.symbol !== 'string'
    || !isTimeframe(value.sourceTimeframe)
    || !isKind(value.selectedKind)
    || typeof value.selectedTransition !== 'string'
    || typeof value.reviewState !== 'string'
    || !isVerdict(value.verdict)
    || !(
      value.reasonCode === null
      || isReasonCode(value.reasonCode)
    )
    || typeof value.comment !== 'string'
    || typeof value.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    schemaVersion:
      LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION,
    sampleId:
      value.sampleId,
    sampleGeneratedAt:
      value.sampleGeneratedAt,
    itemId:
      value.itemId,
    selectionIndex:
      Number(value.selectionIndex),
    symbol:
      value.symbol,
    sourceTimeframe:
      value.sourceTimeframe,
    selectedKind:
      value.selectedKind,
    selectedTransition:
      value.selectedTransition,
    reviewState:
      value.reviewState,
    verdict:
      value.verdict,
    reasonCode:
      value.reasonCode,
    comment:
      value.comment,
    updatedAt:
      value.updatedAt,
  };
}

export function createEmptyLevelEngineManualReviewStore():
LevelEngineManualReviewStore {
  return {
    schemaVersion:
      LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION,
    annotations: [],
  };
}

export function parseLevelEngineManualReviewStore(
  rawValue: string | null,
): LevelEngineManualReviewStore {
  if (!rawValue) {
    return createEmptyLevelEngineManualReviewStore();
  }

  let parsed: unknown;

  try {
    parsed =
      JSON.parse(rawValue);
  } catch {
    return createEmptyLevelEngineManualReviewStore();
  }

  if (
    !isRecord(parsed)
    || parsed.schemaVersion
      !== LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION
    || !Array.isArray(parsed.annotations)
  ) {
    return createEmptyLevelEngineManualReviewStore();
  }

  let store =
    createEmptyLevelEngineManualReviewStore();

  for (
    const rawAnnotation
    of parsed.annotations
  ) {
    const annotation =
      parseAnnotation(rawAnnotation);

    if (!annotation) {
      continue;
    }

    store =
      upsertLevelEngineManualReview(
        store,
        annotation,
      );
  }

  return store;
}

export function loadLevelEngineManualReviewStore(
  storage: LevelEngineManualReviewStorage,
): LevelEngineManualReviewStore {
  return parseLevelEngineManualReviewStore(
    storage.getItem(
      LEVEL_ENGINE_MANUAL_REVIEW_STORAGE_KEY,
    ),
  );
}

export function persistLevelEngineManualReviewStore(
  storage: LevelEngineManualReviewStorage,
  store: LevelEngineManualReviewStore,
): void {
  storage.setItem(
    LEVEL_ENGINE_MANUAL_REVIEW_STORAGE_KEY,
    JSON.stringify(store),
  );
}

export function findLevelEngineManualReview(
  store: LevelEngineManualReviewStore,
  sampleId: string,
  itemId: string,
): LevelEngineManualReviewAnnotation | null {
  return (
    store.annotations.find(
      (annotation) =>
        annotation.sampleId === sampleId
        && annotation.itemId === itemId,
    )
    ?? null
  );
}

export function draftFromLevelEngineManualReview(
  annotation:
    LevelEngineManualReviewAnnotation
    | null,
): LevelEngineManualReviewDraft {
  if (!annotation) {
    return {
      verdict: '',
      reasonCode: '',
      comment: '',
    };
  }

  return {
    verdict:
      annotation.verdict,
    reasonCode:
      annotation.reasonCode
      ?? '',
    comment:
      annotation.comment,
  };
}

export function createLevelEngineManualReview(
  sample: LevelEngineFrozenSample,
  item: LevelEngineFrozenSampleItem,
  draft: LevelEngineManualReviewDraft,
  updatedAt =
    new Date().toISOString(),
): LevelEngineManualReviewAnnotation {
  if (
    !sample.items.some(
      (sampleItem) =>
        sampleItem.id === item.id,
    )
  ) {
    throw new Error(
      'Manual review item does not belong to the frozen sample',
    );
  }

  if (!isVerdict(draft.verdict)) {
    throw new Error(
      'Manual review verdict is required',
    );
  }

  const reasonCode =
    draft.reasonCode === ''
      ? null
      : draft.reasonCode;

  if (
    draft.verdict !== 'correct'
    && !reasonCode
  ) {
    throw new Error(
      'Manual review reason is required for this verdict',
    );
  }

  if (
    reasonCode !== null
    && !isReasonCode(reasonCode)
  ) {
    throw new Error(
      'Manual review reason is invalid',
    );
  }

  const comment =
    draft.comment.trim();

  if (comment.length > 2_000) {
    throw new Error(
      'Manual review comment exceeds 2000 characters',
    );
  }

  return {
    schemaVersion:
      LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION,
    sampleId:
      sample.id,
    sampleGeneratedAt:
      sample.generatedAt,
    itemId:
      item.id,
    selectionIndex:
      item.selectionIndex,
    symbol:
      item.symbol,
    sourceTimeframe:
      item.sourceTimeframe,
    selectedKind:
      item.selectedKind,
    selectedTransition:
      item.selectedTransition,
    reviewState:
      item.reviewState,
    verdict:
      draft.verdict,
    reasonCode,
    comment,
    updatedAt,
  };
}

export function upsertLevelEngineManualReview(
  store: LevelEngineManualReviewStore,
  annotation:
    LevelEngineManualReviewAnnotation,
): LevelEngineManualReviewStore {
  const key =
    annotationKey(
      annotation.sampleId,
      annotation.itemId,
    );

  const nextAnnotations =
    store.annotations.filter(
      (current) =>
        annotationKey(
          current.sampleId,
          current.itemId,
        ) !== key,
    );

  nextAnnotations.push(annotation);
  nextAnnotations.sort(
    (left, right) =>
      left.sampleId.localeCompare(
        right.sampleId,
      )
      || left.selectionIndex
        - right.selectionIndex,
  );

  return {
    schemaVersion:
      LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION,
    annotations:
      nextAnnotations,
  };
}

export function removeLevelEngineManualReview(
  store: LevelEngineManualReviewStore,
  sampleId: string,
  itemId: string,
): LevelEngineManualReviewStore {
  return {
    schemaVersion:
      LEVEL_ENGINE_MANUAL_REVIEW_SCHEMA_VERSION,
    annotations:
      store.annotations.filter(
        (annotation) =>
          !(
            annotation.sampleId === sampleId
            && annotation.itemId === itemId
          ),
      ),
  };
}

export function summarizeLevelEngineManualReviews(
  sample: LevelEngineFrozenSample,
  store: LevelEngineManualReviewStore,
): LevelEngineManualReviewSummary {
  const itemIds =
    new Set(
      sample.items.map(
        (item) =>
          item.id,
      ),
    );

  const annotations =
    store.annotations.filter(
      (annotation) =>
        annotation.sampleId === sample.id
        && itemIds.has(annotation.itemId),
    );

  const correct =
    annotations.filter(
      (annotation) =>
        annotation.verdict === 'correct',
    ).length;
  const incorrect =
    annotations.filter(
      (annotation) =>
        annotation.verdict === 'incorrect',
    ).length;
  const needsReview =
    annotations.filter(
      (annotation) =>
        annotation.verdict === 'needs_review',
    ).length;

  return {
    total:
      sample.items.length,
    reviewed:
      annotations.length,
    remaining:
      Math.max(
        0,
        sample.items.length
        - annotations.length,
      ),
    correct,
    incorrect,
    needsReview,
  };
}

export function buildLevelEngineManualReviewExport(
  sample: LevelEngineFrozenSample,
  store: LevelEngineManualReviewStore,
  generatedAt =
    new Date().toISOString(),
): LevelEngineManualReviewExport {
  const itemIds =
    new Set(
      sample.items.map(
        (item) =>
          item.id,
      ),
    );

  const annotations =
    store.annotations
      .filter(
        (annotation) =>
          annotation.sampleId === sample.id
          && itemIds.has(
            annotation.itemId,
          ),
      )
      .sort(
        (left, right) =>
          left.selectionIndex
          - right.selectionIndex,
      );

  return {
    version:
      'level-engine-manual-review-v0.1',
    generatedAt,
    sample: {
      id:
        sample.id,
      version:
        sample.version,
      generatedAt:
        sample.generatedAt,
      itemCount:
        sample.items.length,
      datasetCount:
        sample.datasets.length,
    },
    summary:
      summarizeLevelEngineManualReviews(
        sample,
        store,
      ),
    annotations,
    observationalOnly:
      true,
    changesAlgorithm:
      false,
  };
}

export function createLevelEngineManualReviewExportFileName(
  sample: LevelEngineFrozenSample,
): string {
  const safeSampleId =
    sample.id.replace(
      /[^a-zA-Z0-9._-]+/gu,
      '-',
    );

  return `${safeSampleId}-manual-review.json`;
}
