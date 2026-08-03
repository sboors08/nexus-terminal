import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples,
  cloneLevelV2ShadowSetupQualityDatasetGroup,
  filterLevelV2ShadowSetupQualityDatasetGroups,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-quality-dataset.js';
import {
  levelV2ShadowSetupQualityDatasetRoutes,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-quality-dataset.routes.js';
import type {
  LevelV2ShadowRuntimeReader,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowSetupQualityLabel,
  LevelV2ShadowSetupQualitySample,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-quality-sample.types.js';

interface SampleOverrides {
  symbol?: string;
  currentKind?:
    'resistance'
    | 'support';
  expectedDirection?:
    'up'
    | 'down';
  confidence?:
    'low'
    | 'medium'
    | 'high';
  label?:
    LevelV2ShadowSetupQualityLabel;
  favorable?: number;
  adverse?: number;
  timeToOutcomeMs?:
    number
    | null;
  durationMs?: number;
  observedPricesCount?: number;
  generatedSecond?: number;
}

function qualitySample(
  id: string,
  overrides:
    SampleOverrides = {},
): LevelV2ShadowSetupQualitySample {
  const label =
    overrides.label
    ?? 'successful';
  const generatedAt =
    new Date(
      Date.UTC(
        2026,
        6,
        1,
        0,
        0,
        overrides.generatedSecond
        ?? 0,
      ),
    ).toISOString();

  return {
    id,
    version:
      'v0.1',
    classifierId:
      `${id}:classifier`,
    levelId:
      `${id}:level`,
    symbol:
      overrides.symbol
      ?? 'BTCUSDT',
    timeframe:
      '1m',
    currentKind:
      overrides.currentKind
      ?? 'resistance',
    expectedDirection:
      overrides.expectedDirection
      ?? 'up',
    generatedAt,
    contextCutoffSequence:
      1,
    qualityLabel:
      label,
    resolved:
      label !== 'unresolved',
    outcomeStatus:
      label === 'successful'
        ? 'successful_continuation'
        : label === 'failed'
          ? 'failed_reversal'
          : label,
    startContext: {
      confidence:
        overrides.confidence
        ?? 'high',
    },
    metrics: {
      maxFavorableExcursionPct:
        overrides.favorable
        ?? 1,
      maxAdverseExcursionPct:
        overrides.adverse
        ?? 0.2,
      timeToOutcomeMs:
        overrides.timeToOutcomeMs
        ?? (
          label === 'unresolved'
            ? null
            : 1_000
        ),
      durationMs:
        overrides.durationMs
        ?? 1_500,
      observedPricesCount:
        overrides.observedPricesCount
        ?? 3,
    },
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
    trainingApplied:
      false,
  } as unknown as
    LevelV2ShadowSetupQualitySample;
}

test(
  'groups quality samples by symbol direction kind and anchor confidence',
  () => {
    const snapshot =
      buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
        [
          qualitySample(
            'sample-a',
          ),
          qualitySample(
            'sample-b',
            {
              label:
                'failed',
            },
          ),
          qualitySample(
            'sample-c',
            {
              symbol:
                'ETHUSDT',
              currentKind:
                'support',
              expectedDirection:
                'down',
              confidence:
                'medium',
            },
          ),
        ],
        null,
        {
          minimumSamplesPerGroup:
            2,
          minimumResolvedSamplesPerGroup:
            2,
          maxGroups:
            10,
          maxSampleIdsPerGroup:
            10,
        },
      );

    assert.equal(
      snapshot.groups.length,
      2,
    );
    assert.equal(
      snapshot.groups[0]
        ?.samplesCount,
      2,
    );
    assert.equal(
      snapshot.groups[0]
        ?.labelCounts.successful,
      1,
    );
    assert.equal(
      snapshot.groups[0]
        ?.labelCounts.failed,
      1,
    );
    assert.equal(
      snapshot.groups[0]
        ?.sufficiency.sufficient,
      true,
    );
    assert.equal(
      snapshot.status.trainingApplied,
      false,
    );
  },
);

test(
  'calculates resolved rates and average and median outcome metrics',
  () => {
    const group =
      buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
        [
          qualitySample(
            'sample-metrics-a',
            {
              favorable:
                1,
              adverse:
                0.2,
              timeToOutcomeMs:
                1_000,
              durationMs:
                2_000,
              observedPricesCount:
                2,
            },
          ),
          qualitySample(
            'sample-metrics-b',
            {
              label:
                'failed',
              favorable:
                3,
              adverse:
                0.8,
              timeToOutcomeMs:
                3_000,
              durationMs:
                4_000,
              observedPricesCount:
                6,
            },
          ),
          qualitySample(
            'sample-metrics-c',
            {
              label:
                'unresolved',
              favorable:
                2,
              adverse:
                0.5,
              durationMs:
                3_000,
              observedPricesCount:
                4,
            },
          ),
        ],
        null,
        {
          minimumSamplesPerGroup:
            3,
          minimumResolvedSamplesPerGroup:
            2,
          maxGroups:
            10,
          maxSampleIdsPerGroup:
            10,
        },
      ).groups[0]!;

    assert.equal(
      group.resolvedRatePct,
      66.66666667,
    );
    assert.equal(
      group.resolvedRates.successfulPct,
      50,
    );
    assert.equal(
      group.resolvedRates.failedPct,
      50,
    );
    assert.equal(
      group.metrics
        .averageMaxFavorableExcursionPct,
      2,
    );
    assert.equal(
      group.metrics
        .medianMaxAdverseExcursionPct,
      0.5,
    );
    assert.equal(
      group.metrics
        .averageTimeToOutcomeMs,
      2_000,
    );
    assert.equal(
      group.metrics
        .medianObservedPricesCount,
      4,
    );
  },
);

test(
  'marks small groups insufficient instead of presenting reliable conclusions',
  () => {
    const snapshot =
      buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
        [
          qualitySample(
            'sample-small-a',
          ),
          qualitySample(
            'sample-small-b',
            {
              label:
                'unresolved',
            },
          ),
        ],
        null,
        {
          minimumSamplesPerGroup:
            3,
          minimumResolvedSamplesPerGroup:
            2,
          maxGroups:
            10,
          maxSampleIdsPerGroup:
            10,
        },
      );
    const group =
      snapshot.groups[0]!;

    assert.equal(
      group.sufficiency.sufficient,
      false,
    );
    assert.deepEqual(
      group.sufficiency.reasons,
      [
        'insufficient_total_samples',
        'insufficient_resolved_samples',
      ],
    );
    assert.equal(
      snapshot.status.sufficientGroupsCount,
      0,
    );
    assert.equal(
      snapshot.status.insufficientGroupsCount,
      1,
    );
  },
);

test(
  'bounds retained groups and sample ids and returns defensive copies',
  () => {
    const snapshot =
      buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
        [
          qualitySample(
            'sample-bound-a',
            {
              generatedSecond:
                1,
            },
          ),
          qualitySample(
            'sample-bound-b',
            {
              generatedSecond:
                2,
            },
          ),
          qualitySample(
            'sample-bound-c',
            {
              generatedSecond:
                3,
            },
          ),
          qualitySample(
            'sample-bound-d',
            {
              symbol:
                'ETHUSDT',
              currentKind:
                'support',
              expectedDirection:
                'down',
            },
          ),
        ],
        null,
        {
          minimumSamplesPerGroup:
            1,
          minimumResolvedSamplesPerGroup:
            1,
          maxGroups:
            1,
          maxSampleIdsPerGroup:
            2,
        },
      );
    const original =
      snapshot.groups[0]!;
    const copy =
      cloneLevelV2ShadowSetupQualityDatasetGroup(
        original,
      );

    (copy.sampleIds as string[]).push(
      'mutated',
    );
    (copy.sufficiency.reasons as string[]).push(
      'mutated',
    );

    assert.equal(
      snapshot.status.droppedGroupsCount,
      1,
    );
    assert.equal(
      original.sampleIds.length,
      2,
    );
    assert.equal(
      original.sampleIdsTruncated,
      true,
    );
    assert.equal(
      original.sampleIds.includes(
        'mutated',
      ),
      false,
    );
    assert.equal(
      original.sufficiency.reasons.includes(
        'mutated',
      ),
      false,
    );
  },
);

test(
  'filters groups before applying the result limit',
  () => {
    const snapshot =
      buildLevelV2ShadowSetupQualityDatasetSnapshotFromSamples(
        [
          qualitySample(
            'sample-filter-up',
          ),
          qualitySample(
            'sample-filter-down-a',
            {
              symbol:
                'ETHUSDT',
              currentKind:
                'support',
              expectedDirection:
                'down',
              confidence:
                'medium',
            },
          ),
          qualitySample(
            'sample-filter-down-b',
            {
              symbol:
                'ETHUSDT',
              currentKind:
                'support',
              expectedDirection:
                'down',
              confidence:
                'medium',
            },
          ),
        ],
        null,
        {
          minimumSamplesPerGroup:
            2,
          minimumResolvedSamplesPerGroup:
            2,
          maxGroups:
            10,
          maxSampleIdsPerGroup:
            10,
        },
      );
    const filtered =
      filterLevelV2ShadowSetupQualityDatasetGroups(
        snapshot.groups,
        {
          symbol:
            'ETHUSDT',
          currentKind:
            'support',
          expectedDirection:
            'down',
          anchorConfidence:
            'medium',
          sufficient:
            true,
          minimumSamples:
            2,
          limit:
            1,
        },
      );

    assert.equal(
      filtered.length,
      1,
    );
    assert.equal(
      filtered[0]?.key.symbol,
      'ETHUSDT',
    );
    assert.equal(
      filtered[0]?.samplesCount,
      2,
    );
  },
);

test(
  'returns unavailable when the quality dataset source reader is missing',
  async () => {
    const app =
      Fastify();

    await app.register(
      levelV2ShadowSetupQualityDatasetRoutes,
      {},
    );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-dataset',
      });

    assert.equal(
      response.statusCode,
      503,
    );
    await app.close();
  },
);

test(
  'exposes empty quality dataset status list diagnostics and validates filters',
  async () => {
    const runtime:
    LevelV2ShadowRuntimeReader = {
      getStatus: () => ({
        state:
          'running',
        snapshotsCount:
          0,
        levelsCount:
          0,
        eligibleLevelsCount:
          0,
        scansCount:
          0,
        failedScans:
          0,
        lastScanAt:
          null,
        lastTriggerSource:
          null,
        lastError:
          null,
      }),
      getSnapshots: () => [],
      getSnapshot: () => null,
      getMarketEvidenceHistory:
        () => [],
    };
    const app =
      Fastify();

    await app.register(
      levelV2ShadowSetupQualityDatasetRoutes,
      {
        levelV2ShadowRuntimeReader:
          runtime,
      },
    );

    const status =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-dataset/status',
      });
    const list =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-dataset?sufficient=false&limit=10',
      });
    const diagnostics =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-dataset/diagnostics',
      });
    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-dataset?currentKind=unknown',
      });

    assert.equal(
      status.statusCode,
      200,
    );
    assert.equal(
      status.json().groupsCount,
      0,
    );
    assert.equal(
      list.statusCode,
      200,
    );
    assert.equal(
      list.json().count,
      0,
    );
    assert.equal(
      diagnostics.statusCode,
      200,
    );
    assert.equal(
      diagnostics.json().groupsCount,
      0,
    );
    assert.equal(
      invalid.statusCode,
      400,
    );
    await app.close();
  },
);
