import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEVEL_ENGINE_FROZEN_SAMPLE_PATH,
  fetchLevelEngineFrozenSample,
  findLevelEngineFrozenSampleDataset,
  parseLevelEngineFrozenSample,
} from '../node_modules/.tmp/realtime-test/api/runtime/levelEngineFrozenSampleApi.js';

function createSample() {
  return {
    id:
      'level-engine-frozen-sample-test',
    version:
      'level-engine-frozen-sample-v0.1',
    sourceReportVersion:
      'level-engine-causal-replay-real-data-validation-v0.1',
    generatedAt:
      '2026-08-05T12:00:00.000Z',
    requestedSymbols: [
      'BTCUSDT',
    ],
    requestedTimeframes: [
      '1m',
    ],
    appliedOptions: {
      detector: {
        atrPeriod:
          14,
      },
    },
    selection: {
      strategy:
        'round_robin_symbol_timeframe_then_review_order',
      requestedLimit:
        1,
      availableItemCount:
        1,
      selectedItemCount:
        1,
      omittedItemCount:
        0,
      datasetCount:
        1,
      complete:
        true,
    },
    datasets: [
      {
        key:
          'BTCUSDT:1m',
        symbol:
          'BTCUSDT',
        sourceTimeframe:
          '1m',
        candles: [
          {
            openTime:
              '2026-08-05T11:59:00.000Z',
            closeTime:
              '2026-08-05T11:59:59.999Z',
            open:
              100,
            high:
              102,
            low:
              99,
            close:
              101,
            isClosed:
              true,
          },
        ],
      },
    ],
    items: [
      {
        id:
          'sample-item-0',
        selectionIndex:
          0,
        datasetKey:
          'BTCUSDT:1m',
        symbol:
          'BTCUSDT',
        sourceTimeframe:
          '1m',
        sourceCandidateId:
          'source-candidate-1',
        selectedCandidateId:
          'selected-candidate-1',
        sourceKind:
          'resistance',
        selectedKind:
          'support',
        selectedMaturity:
          'confirmed',
        selectedTransition:
          'flip',
        reviewState:
          'active',
        selectedZone: {
          low:
            99,
          reference:
            100,
          high:
            101,
        },
        sourceActiveFrom:
          '2026-08-05T11:55:00.000Z',
        sourceDetectedAt:
          '2026-08-05T11:56:00.000Z',
        selectedActiveFrom:
          '2026-08-05T11:57:00.000Z',
        selectedDetectedAt:
          '2026-08-05T11:58:00.000Z',
        diagnosticFlags: [
          'selected_cycle_role_changed',
        ],
        reviewItem: {
          causalReplayDiagnostic: {
            trackFound:
              true,
          },
        },
      },
    ],
    counts: {
      bySymbol: {
        BTCUSDT:
          1,
      },
      byTimeframe: {
        '1m':
          1,
      },
      byReviewState: {
        active:
          1,
      },
      byTransition: {
        flip:
          1,
      },
      bySelectedCycleConfirmationState: {
        confirmed_unbroken:
          1,
      },
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
          1,
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
  };
}

test(
  'fetches and validates the Level Engine frozen sample',
  async () => {
    let requestedUrl = '';

    const sample =
      await fetchLevelEngineFrozenSample({
        baseUrl:
          'http://localhost:4100/',
        fetcher:
          async (
            input,
            init,
          ) => {
            requestedUrl =
              String(input);

            assert.equal(
              init?.method,
              'GET',
            );

            assert.equal(
              new Headers(
                init?.headers,
              ).get('accept'),
              'application/json',
            );

            return new Response(
              JSON.stringify(
                createSample(),
              ),
              {
                status:
                  200,
                headers: {
                  'content-type':
                    'application/json',
                },
              },
            );
          },
      });

    assert.equal(
      requestedUrl,
      'http://localhost:4100'
        + LEVEL_ENGINE_FROZEN_SAMPLE_PATH,
    );

    assert.equal(
      sample.items.length,
      1,
    );

    const dataset =
      findLevelEngineFrozenSampleDataset(
        sample,
        sample.items[0],
      );

    assert.equal(
      dataset.key,
      'BTCUSDT:1m',
    );

    assert.equal(
      dataset.candles.length,
      1,
    );

    assert.equal(
      dataset.candles[0].isClosed,
      true,
    );
  },
);

test(
  'rejects a frozen sample that uses future candles',
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
      /usesFutureCandles/u,
    );
  },
);

test(
  'rejects a frozen sample with a missing dataset reference',
  () => {
    const source =
      createSample();

    const sample = {
      ...source,
      items: [
        {
          ...source.items[0],
          datasetKey:
            'SOLUSDT:5m',
        },
      ],
    };

    assert.throws(
      () =>
        parseLevelEngineFrozenSample(
          sample,
        ),
      /dataset reference/u,
    );
  },
);

test(
  'reports a frozen sample HTTP error',
  async () => {
    await assert.rejects(
      () =>
        fetchLevelEngineFrozenSample({
          fetcher:
            async () =>
              new Response(
                JSON.stringify({
                  error:
                    'level_engine_frozen_sample_not_found',
                }),
                {
                  status:
                    404,
                  headers: {
                    'content-type':
                      'application/json',
                  },
                },
              ),
        }),
      /status 404/u,
    );
  },
);