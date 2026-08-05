import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  tmpdir,
} from 'node:os';
import {
  join,
} from 'node:path';
import test from 'node:test';

import Fastify from 'fastify';

import {
  levelEngineFrozenSampleReadRoutes,
} from '../src/modules/level-engine/level-engine-frozen-sample-read.routes.js';
import {
  JsonFileLevelEngineFrozenSampleReader,
  parseLevelEngineFrozenSample,
} from '../src/modules/level-engine/level-engine-frozen-sample-reader.js';
import type {
  LevelEngineFrozenSample,
} from '../src/modules/level-engine/level-engine-frozen-sample.types.js';

function createSample():
LevelEngineFrozenSample {
  return {
    id:
      'level-engine-frozen-sample-test',
    version:
      'level-engine-frozen-sample-v0.1',
    sourceReportVersion:
      'test-report-v0.1',
    generatedAt:
      '2026-08-05T12:00:00.000Z',
    requestedSymbols: [
      'BTCUSDT',
    ],
    requestedTimeframes: [
      '1m',
    ],
    appliedOptions: {},
    selection: {
      strategy:
        'round_robin_symbol_timeframe_then_review_order',
      requestedLimit:
        120,
      availableItemCount:
        0,
      selectedItemCount:
        0,
      omittedItemCount:
        0,
      datasetCount:
        0,
      complete:
        true,
    },
    datasets: [],
    items: [],
    counts: {
      bySymbol: {},
      byTimeframe: {},
      byReviewState: {},
      byTransition: {},
      bySelectedCycleConfirmationState: {},
      byDiagnosticFlag: {
        source_detected_late_or_post_break:
          0,
        causal_track_missing:
          0,
        detector_disappeared:
          0,
        detector_reappeared:
          0,
        selected_cycle_not_current:
          0,
        selected_cycle_role_changed:
          0,
        source_touch_history_discarded:
          0,
        selected_cycle_broke_before_confirmation:
          0,
        selected_cycle_confirmed_at_or_after_break:
          0,
        selected_cycle_not_observed:
          0,
      },
    },
    observationalOnly:
      true,
    createsSetup:
      false,
    mergesAcrossTimeframes:
      false,
    usesQualityScore:
      false,
    usesFutureCandles:
      false,
    intendedForManualReview:
      true,
  } as LevelEngineFrozenSample;
}

test(
  'parses a valid Level Engine frozen sample',
  () => {
    const sample =
      createSample();

    assert.equal(
      parseLevelEngineFrozenSample(
        sample,
      ),
      sample,
    );
  },
);

test(
  'rejects a frozen sample with invalid safety guarantees',
  () => {
    const sample = {
      ...createSample(),
      usesFutureCandles:
        true,
    };

    assert.throws(
      () =>
        parseLevelEngineFrozenSample(
          sample,
        ),
      /invalid safety guarantees/,
    );
  },
);

test(
  'returns null when the latest frozen sample file is missing',
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-level-engine-missing-',
        ),
      );

    try {
      const reader =
        new JsonFileLevelEngineFrozenSampleReader({
          filePath:
            join(
              directory,
              'missing.json',
            ),
        });

      assert.equal(
        await reader.readLatest(),
        null,
      );
    } finally {
      await rm(
        directory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);

test(
  'reads and validates the latest frozen sample file',
  async () => {
    const directory =
      await mkdtemp(
        join(
          tmpdir(),
          'nexus-level-engine-sample-',
        ),
      );
    const filePath =
      join(
        directory,
        'latest-frozen-sample.json',
      );
    const sample =
      createSample();

    try {
      await writeFile(
        filePath,
        JSON.stringify(sample),
        'utf8',
      );

      const reader =
        new JsonFileLevelEngineFrozenSampleReader({
          filePath,
        });

      assert.deepEqual(
        await reader.readLatest(),
        sample,
      );
    } finally {
      await rm(
        directory,
        {
          recursive:
            true,
          force:
            true,
        },
      );
    }
  },
);

test(
  'returns the latest frozen sample through the read API',
  async () => {
    const sample =
      createSample();
    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      levelEngineFrozenSampleReadRoutes,
      {
        levelEngineFrozenSampleReader: {
          async readLatest() {
            return sample;
          },
        },
      },
    );

    try {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            '/level-engine/frozen-sample/latest',
        });

      assert.equal(
        response.statusCode,
        200,
      );
      assert.deepEqual(
        response.json(),
        sample,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  'returns 404 when the latest frozen sample does not exist',
  async () => {
    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      levelEngineFrozenSampleReadRoutes,
      {
        levelEngineFrozenSampleReader: {
          async readLatest() {
            return null;
          },
        },
      },
    );

    try {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            '/level-engine/frozen-sample/latest',
        });
      const payload =
        response.json();

      assert.equal(
        response.statusCode,
        404,
      );
      assert.equal(
        payload.error,
        'level_engine_frozen_sample_not_found',
      );
    } finally {
      await app.close();
    }
  },
);

test(
  'returns 503 when the frozen sample cannot be read',
  async () => {
    const app =
      Fastify({
        logger:
          false,
      });

    await app.register(
      levelEngineFrozenSampleReadRoutes,
      {
        levelEngineFrozenSampleReader: {
          async readLatest() {
            throw new Error(
              'broken file',
            );
          },
        },
      },
    );

    try {
      const response =
        await app.inject({
          method:
            'GET',
          url:
            '/level-engine/frozen-sample/latest',
        });
      const payload =
        response.json();

      assert.equal(
        response.statusCode,
        503,
      );
      assert.equal(
        payload.error,
        'level_engine_frozen_sample_unavailable',
      );
    } finally {
      await app.close();
    }
  },
);