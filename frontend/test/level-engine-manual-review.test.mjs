import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEVEL_ENGINE_MANUAL_REVIEW_STORAGE_KEY,
  buildLevelEngineManualReviewExport,
  createEmptyLevelEngineManualReviewStore,
  createLevelEngineManualReview,
  createLevelEngineManualReviewExportFileName,
  draftFromLevelEngineManualReview,
  findLevelEngineManualReview,
  loadLevelEngineManualReviewStore,
  parseLevelEngineManualReviewStore,
  persistLevelEngineManualReviewStore,
  removeLevelEngineManualReview,
  summarizeLevelEngineManualReviews,
  upsertLevelEngineManualReview,
} from '../node_modules/.tmp/realtime-test/level-engine/levelEngineManualReview.js';

function createFixture() {
  const firstItem = {
    id:
      'review-item-0',
    selectionIndex:
      0,
    datasetKey:
      'BTCUSDT:1m',
    symbol:
      'BTCUSDT',
    sourceTimeframe:
      '1m',
    selectedKind:
      'support',
    selectedTransition:
      'origin',
    reviewState:
      'active',
  };

  const secondItem = {
    ...firstItem,
    id:
      'review-item-1',
    selectionIndex:
      1,
    selectedKind:
      'resistance',
    selectedTransition:
      'flip',
    reviewState:
      'broken',
  };

  const sample = {
    id:
      'level-engine/frozen sample:test',
    version:
      'level-engine-frozen-sample-v0.1',
    generatedAt:
      '2026-08-06T12:00:00.000Z',
    items: [
      firstItem,
      secondItem,
    ],
    datasets: [
      {
        key:
          'BTCUSDT:1m',
      },
    ],
  };

  return {
    sample,
    firstItem,
    secondItem,
  };
}

function createStorage() {
  const values =
    new Map();

  return {
    getItem(
      key,
    ) {
      return values.get(key)
        ?? null;
    },
    setItem(
      key,
      value,
    ) {
      values.set(
        key,
        value,
      );
    },
    values,
  };
}

test(
  'creates a typed manual review annotation',
  () => {
    const {
      sample,
      firstItem,
    } =
      createFixture();

    const annotation =
      createLevelEngineManualReview(
        sample,
        firstItem,
        {
          verdict:
            'incorrect',
          reasonCode:
            'zone_geometry',
          comment:
            '  Zone is too wide.  ',
        },
        '2026-08-06T13:00:00.000Z',
      );

    assert.equal(
      annotation.sampleId,
      sample.id,
    );
    assert.equal(
      annotation.itemId,
      firstItem.id,
    );
    assert.equal(
      annotation.verdict,
      'incorrect',
    );
    assert.equal(
      annotation.reasonCode,
      'zone_geometry',
    );
    assert.equal(
      annotation.comment,
      'Zone is too wide.',
    );
    assert.equal(
      annotation.updatedAt,
      '2026-08-06T13:00:00.000Z',
    );
  },
);

test(
  'requires a reason for incorrect and needs-review verdicts',
  () => {
    const {
      sample,
      firstItem,
    } =
      createFixture();

    assert.throws(
      () =>
        createLevelEngineManualReview(
          sample,
          firstItem,
          {
            verdict:
              'incorrect',
            reasonCode:
              '',
            comment:
              '',
          },
        ),
      /reason is required/u,
    );

    assert.doesNotThrow(
      () =>
        createLevelEngineManualReview(
          sample,
          firstItem,
          {
            verdict:
              'correct',
            reasonCode:
              '',
            comment:
              '',
          },
        ),
    );
  },
);

test(
  'upserts reviews and calculates sample progress',
  () => {
    const {
      sample,
      firstItem,
      secondItem,
    } =
      createFixture();

    const firstReview =
      createLevelEngineManualReview(
        sample,
        firstItem,
        {
          verdict:
            'correct',
          reasonCode:
            '',
          comment:
            '',
        },
        '2026-08-06T13:00:00.000Z',
      );

    const updatedFirstReview =
      createLevelEngineManualReview(
        sample,
        firstItem,
        {
          verdict:
            'needs_review',
          reasonCode:
            'missing_context',
          comment:
            'Need more candles.',
        },
        '2026-08-06T13:05:00.000Z',
      );

    const secondReview =
      createLevelEngineManualReview(
        sample,
        secondItem,
        {
          verdict:
            'incorrect',
          reasonCode:
            'break_detection',
          comment:
            '',
        },
        '2026-08-06T13:10:00.000Z',
      );

    let store =
      createEmptyLevelEngineManualReviewStore();

    store =
      upsertLevelEngineManualReview(
        store,
        firstReview,
      );
    store =
      upsertLevelEngineManualReview(
        store,
        updatedFirstReview,
      );
    store =
      upsertLevelEngineManualReview(
        store,
        secondReview,
      );

    assert.equal(
      store.annotations.length,
      2,
    );

    assert.deepEqual(
      draftFromLevelEngineManualReview(
        findLevelEngineManualReview(
          store,
          sample.id,
          firstItem.id,
        ),
      ),
      {
        verdict:
          'needs_review',
        reasonCode:
          'missing_context',
        comment:
          'Need more candles.',
      },
    );

    assert.deepEqual(
      summarizeLevelEngineManualReviews(
        sample,
        store,
      ),
      {
        total:
          2,
        reviewed:
          2,
        remaining:
          0,
        correct:
          0,
        incorrect:
          1,
        needsReview:
          1,
      },
    );
  },
);

test(
  'persists, loads and removes browser-local reviews',
  () => {
    const {
      sample,
      firstItem,
    } =
      createFixture();
    const storage =
      createStorage();

    const annotation =
      createLevelEngineManualReview(
        sample,
        firstItem,
        {
          verdict:
            'correct',
          reasonCode:
            '',
          comment:
            'Looks causal.',
        },
        '2026-08-06T13:00:00.000Z',
      );

    const store =
      upsertLevelEngineManualReview(
        createEmptyLevelEngineManualReviewStore(),
        annotation,
      );

    persistLevelEngineManualReviewStore(
      storage,
      store,
    );

    assert.ok(
      storage.values.has(
        LEVEL_ENGINE_MANUAL_REVIEW_STORAGE_KEY,
      ),
    );

    const loaded =
      loadLevelEngineManualReviewStore(
        storage,
      );

    assert.deepEqual(
      loaded,
      store,
    );

    const removed =
      removeLevelEngineManualReview(
        loaded,
        sample.id,
        firstItem.id,
      );

    assert.equal(
      removed.annotations.length,
      0,
    );

    assert.deepEqual(
      parseLevelEngineManualReviewStore(
        '{invalid json',
      ),
      createEmptyLevelEngineManualReviewStore(),
    );
  },
);

test(
  'exports only annotations belonging to the active sample',
  () => {
    const {
      sample,
      firstItem,
    } =
      createFixture();

    const activeAnnotation =
      createLevelEngineManualReview(
        sample,
        firstItem,
        {
          verdict:
            'correct',
          reasonCode:
            '',
          comment:
            '',
        },
        '2026-08-06T13:00:00.000Z',
      );

    const foreignAnnotation = {
      ...activeAnnotation,
      sampleId:
        'another-sample',
      itemId:
        'foreign-item',
    };

    const store = {
      schemaVersion:
        1,
      annotations: [
        foreignAnnotation,
        activeAnnotation,
      ],
    };

    const exported =
      buildLevelEngineManualReviewExport(
        sample,
        store,
        '2026-08-06T14:00:00.000Z',
      );

    assert.equal(
      exported.version,
      'level-engine-manual-review-v0.1',
    );
    assert.equal(
      exported.annotations.length,
      1,
    );
    assert.equal(
      exported.annotations[0].itemId,
      firstItem.id,
    );
    assert.equal(
      exported.summary.reviewed,
      1,
    );
    assert.equal(
      exported.summary.remaining,
      1,
    );
    assert.equal(
      exported.observationalOnly,
      true,
    );
    assert.equal(
      exported.changesAlgorithm,
      false,
    );

    assert.equal(
      createLevelEngineManualReviewExportFileName(
        sample,
      ),
      'level-engine-frozen-sample-test-manual-review.json',
    );
  },
);
