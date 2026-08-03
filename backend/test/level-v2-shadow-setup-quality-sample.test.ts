import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import {
  buildLevelV2ShadowSetupQualitySampleFromHistories,
  buildLevelV2ShadowSetupQualitySampleSnapshotFromHistories,
  cloneLevelV2ShadowSetupQualitySample,
  filterLevelV2ShadowSetupQualitySamples,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-quality-sample.js';
import {
  levelV2ShadowSetupQualitySampleRoutes,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-quality-sample.routes.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryEntry,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-confirmation-candidate-history.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowSetupOutcomeHistoryEntry,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-outcome-history.types.js';
import type {
  LevelV2ShadowSetupOutcomeStatus,
} from '../src/modules/setup-engine/level-v2/level-v2-shadow-setup-outcome-observation.types.js';

function candidateEntry(
  classifierId: string,
  sequence: number,
  verdict = 'supported',
): LevelV2ShadowConfirmationCandidateHistoryEntry {
  const capturedAt =
    new Date(
      Date.UTC(
        2026,
        6,
        1,
        0,
        0,
        sequence,
      ),
    ).toISOString();

  return {
    id:
      `${classifierId}:confirmation-candidate-history:${sequence}`,
    sequence,
    classifierId,
    levelId:
      `${classifierId}:level`,
    symbol:
      classifierId.startsWith('down')
        ? 'ETHUSDT'
        : 'BTCUSDT',
    timeframe:
      '1m',
    capturedAt,
    candidate: {
      id:
        `${classifierId}:candidate:${sequence}`,
      classifierId,
      levelId:
        `${classifierId}:level`,
      symbol:
        classifierId.startsWith('down')
          ? 'ETHUSDT'
          : 'BTCUSDT',
      timeframe:
        '1m',
      currentKind:
        classifierId.startsWith('down')
          ? 'support'
          : 'resistance',
      latestSequence:
        sequence,
      capturedAt,
      latestClassificationStatus:
        'BREAKOUT_CONFIRMED',
      expectedDirection:
        classifierId.startsWith('down')
          ? 'down'
          : 'up',
      priceAcceptance:
        true,
      behavior:
        'directional_continuation',
      behaviorConfidence:
        'high',
      aggressionSide:
        classifierId.startsWith('down')
          ? 'sell'
          : 'buy',
      priceDirection:
        classifierId.startsWith('down')
          ? 'down'
          : 'up',
      postEventReaction:
        'continuation',
      verdict,
      confidence:
        'high',
      reasons: [
        `reason-${sequence}`,
      ],
      evidence: {
        latestAvailability:
          'complete',
        latestEvidenceCapturedAt:
          capturedAt,
        marketEvidenceEntriesCount:
          sequence,
        usableTapeEntriesCount:
          sequence,
        completeEntriesCount:
          sequence,
        behaviorHistoryEntriesCount:
          sequence,
        stableBehaviorEntriesCount:
          sequence,
        contradictoryBehaviorEntriesCount:
          0,
        netPriceChangePct:
          0.2,
        latestOrderBookImbalancePct:
          12,
      },
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      tradeConfirmation:
        false,
    },
    changes: {} as
      LevelV2ShadowConfirmationCandidateHistoryEntry[
        'changes'
      ],
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    tradeConfirmation:
      false,
  } as unknown as
    LevelV2ShadowConfirmationCandidateHistoryEntry;
}

function outcomeEntry(
  classifierId: string,
  sequence: number,
  anchor:
    LevelV2ShadowConfirmationCandidateHistoryEntry,
  status:
    LevelV2ShadowSetupOutcomeStatus,
): LevelV2ShadowSetupOutcomeHistoryEntry {
  const capturedAt =
    new Date(
      Date.UTC(
        2026,
        6,
        1,
        0,
        10,
        sequence,
      ),
    ).toISOString();
  const entryPrice = 100;
  const latestPrice =
    status === 'failed_reversal'
      ? 99
      : status === 'pending'
        ? 100.1
        : 101;

  return {
    id:
      `${classifierId}:setup-outcome-history:${sequence}`,
    sequence,
    classifierId,
    levelId:
      anchor.levelId,
    symbol:
      anchor.symbol,
    timeframe:
      '1m',
    capturedAt,
    latestPriceChangePct:
      latestPrice
      - entryPrice,
    observation: {
      id:
        `${classifierId}:setup-outcome`,
      classifierId,
      levelId:
        anchor.levelId,
      symbol:
        anchor.symbol,
      timeframe:
        '1m',
      currentKind:
        anchor.candidate.currentKind,
      expectedDirection:
        anchor.candidate
          .expectedDirection,
      anchorCandidateHistoryEntryId:
        anchor.id,
      anchorCandidateId:
        anchor.candidate.id,
      anchorConfidence:
        anchor.candidate.confidence,
      startedAt:
        anchor.capturedAt,
      startedSequence:
        anchor.candidate
          .latestSequence,
      windowEndsAt:
        new Date(
          Date.parse(
            anchor.capturedAt,
          )
          + 60_000,
        ).toISOString(),
      entryPrice,
      latestPrice,
      latestPriceAt:
        capturedAt,
      latestSourceObservedAt:
        capturedAt,
      observedPricesCount:
        sequence,
      durationMs:
        10_000,
      observationWindowElapsed:
        status !== 'pending',
      levelReferencePrice:
        100,
      levelBoundaryPrice:
        100,
      levelGeometryAvailable:
        true,
      maxFavorableExcursionPct:
        status === 'failed_reversal'
          ? 0.1
          : 1,
      maxAdverseExcursionPct:
        status === 'failed_reversal'
          ? 1
          : 0.2,
      maxFavorablePrice:
        101,
      maxAdversePrice:
        99,
      continuationReached:
        status === 'successful_continuation'
        || status === 'mixed',
      continuationReachedAt:
        status === 'successful_continuation'
        || status === 'mixed'
          ? capturedAt
          : null,
      adverseThresholdReached:
        status === 'failed_reversal'
        || status === 'mixed',
      adverseThresholdReachedAt:
        status === 'failed_reversal'
        || status === 'mixed'
          ? capturedAt
          : null,
      returnedInsideLevel:
        status === 'failed_reversal'
        || status === 'mixed',
      returnedInsideLevelAt:
        status === 'failed_reversal'
        || status === 'mixed'
          ? capturedAt
          : null,
      failureConditionReached:
        status === 'failed_reversal'
        || status === 'mixed',
      failureConditionReachedAt:
        status === 'failed_reversal'
        || status === 'mixed'
          ? capturedAt
          : null,
      status,
      resolvedAt:
        status === 'pending'
          ? null
          : capturedAt,
      timeToOutcomeMs:
        status === 'pending'
          ? null
          : 10_000,
      reasons: [
        status,
      ],
      options: {
        successThresholdPct:
          0.5,
        failureThresholdPct:
          0.5,
        maxObservationMs:
          60_000,
      },
      observationalOnly:
        true,
      changesBreakClassification:
        false,
      changesProductionSetup:
        false,
      tradeExecution:
        false,
    },
    changes: {} as
      LevelV2ShadowSetupOutcomeHistoryEntry[
        'changes'
      ],
    observationalOnly:
      true,
    changesBreakClassification:
      false,
    changesProductionSetup:
      false,
    tradeExecution:
      false,
  } as unknown as
    LevelV2ShadowSetupOutcomeHistoryEntry;
}

test(
  'maps outcome statuses to immutable quality labels without enabling training',
  () => {
    const statuses:
    readonly LevelV2ShadowSetupOutcomeStatus[] = [
      'successful_continuation',
      'failed_reversal',
      'mixed',
      'pending',
    ];
    const candidates =
      statuses.map(
        (
          _status,
          index,
        ) =>
          candidateEntry(
            `classifier-${index}`,
            index + 1,
          ),
      );
    const outcomes =
      statuses.map(
        (
          status,
          index,
        ) =>
          outcomeEntry(
            `classifier-${index}`,
            index + 1,
            candidates[index]!,
            status,
          ),
      );
    const result =
      buildLevelV2ShadowSetupQualitySampleFromHistories(
        candidates,
        outcomes,
      );
    const labels =
      new Set(
        result.samples.map(
          (sample) =>
            sample.qualityLabel,
        ),
      );

    assert.deepEqual(
      labels,
      new Set([
        'successful',
        'failed',
        'mixed',
        'unresolved',
      ]),
    );
    assert.equal(
      result.samples.every(
        (sample) =>
          sample.observationalOnly
          && !sample.changesProductionSetup
          && !sample.tradeExecution
          && !sample.trainingApplied,
      ),
      true,
    );
  },
);

test(
  'keeps only pre-outcome confirmation history and the exact supported anchor',
  () => {
    const first =
      candidateEntry(
        'classifier-a',
        1,
        'insufficient_data',
      );
    const anchor =
      candidateEntry(
        'classifier-a',
        2,
        'supported',
      );
    const later =
      candidateEntry(
        'classifier-a',
        3,
        'contradicted',
      );
    const outcome =
      outcomeEntry(
        'classifier-a',
        1,
        anchor,
        'successful_continuation',
      );
    const sample =
      buildLevelV2ShadowSetupQualitySampleFromHistories(
        [
          first,
          anchor,
          later,
        ],
        [
          outcome,
        ],
      ).samples[0]!;

    assert.equal(
      sample.anchorCandidateHistoryEntry.id,
      anchor.id,
    );
    assert.deepEqual(
      sample.confirmationHistory.map(
        (entry) =>
          entry.id,
      ),
      [
        first.id,
        anchor.id,
      ],
    );
    assert.equal(
      sample.preOutcomeContextOnly,
      true,
    );
  },
);

test(
  'returns defensive quality sample copies',
  () => {
    const anchor =
      candidateEntry(
        'classifier-copy',
        1,
      );
    const outcome =
      outcomeEntry(
        'classifier-copy',
        1,
        anchor,
        'mixed',
      );
    const original =
      buildLevelV2ShadowSetupQualitySampleFromHistories(
        [
          anchor,
        ],
        [
          outcome,
        ],
      ).samples[0]!;
    const copy =
      cloneLevelV2ShadowSetupQualitySample(
        original,
      );

    (copy.startContext.reasons as string[]).push(
      'mutated',
    );
    (copy.finalOutcome.reasons as string[]).push(
      'mutated',
    );

    assert.deepEqual(
      original.startContext.reasons,
      [
        'reason-1',
      ],
    );
    assert.deepEqual(
      original.finalOutcome.reasons,
      [
        'mixed',
      ],
    );
  },
);

test(
  'filters samples by label direction status and classifier before limit',
  () => {
    const up =
      candidateEntry(
        'up-classifier',
        1,
      );
    const down =
      candidateEntry(
        'down-classifier',
        1,
      );
    const snapshot =
      buildLevelV2ShadowSetupQualitySampleSnapshotFromHistories(
        [
          up,
          down,
        ],
        [
          outcomeEntry(
            'up-classifier',
            1,
            up,
            'successful_continuation',
          ),
          outcomeEntry(
            'down-classifier',
            2,
            down,
            'failed_reversal',
          ),
        ],
      );
    const filtered =
      filterLevelV2ShadowSetupQualitySamples(
        snapshot.samples,
        {
          symbol:
            null,
          classifierId:
            'down-classifier',
          qualityLabel:
            'failed',
          expectedDirection:
            'down',
          outcomeStatus:
            'failed_reversal',
          limit:
            1,
        },
      );

    assert.equal(
      filtered.length,
      1,
    );
    assert.equal(
      filtered[0]?.classifierId,
      'down-classifier',
    );
  },
);

test(
  'reports missing anchors and aggregates sample diagnostics',
  () => {
    const anchor =
      candidateEntry(
        'classifier-diagnostics',
        1,
      );
    const missingAnchor =
      candidateEntry(
        'classifier-missing',
        1,
      );
    const validOutcome =
      outcomeEntry(
        'classifier-diagnostics',
        1,
        anchor,
        'successful_continuation',
      );
    const invalidOutcome =
      outcomeEntry(
        'classifier-missing',
        2,
        missingAnchor,
        'pending',
      );
    invalidOutcome.observation = {
      ...invalidOutcome.observation,
      anchorCandidateHistoryEntryId:
        'missing-anchor-id',
    };
    const snapshot =
      buildLevelV2ShadowSetupQualitySampleSnapshotFromHistories(
        [
          anchor,
        ],
        [
          validOutcome,
          invalidOutcome,
        ],
        20,
        2,
      );

    assert.equal(
      snapshot.status.samplesCount,
      1,
    );
    assert.equal(
      snapshot.status
        .missingAnchorCandidatesCount,
      1,
    );
    assert.equal(
      snapshot.diagnostics
        .labelCounts.successful,
      1,
    );
    assert.equal(
      snapshot.diagnostics
        .averageMaxFavorableExcursionPct,
      1,
    );
  },
);

test(
  'returns unavailable when the quality sample source reader is missing',
  async () => {
    const app =
      Fastify();

    await app.register(
      levelV2ShadowSetupQualitySampleRoutes,
      {},
    );

    const response =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-samples',
      });

    assert.equal(
      response.statusCode,
      503,
    );
    await app.close();
  },
);

test(
  'exposes empty quality sample status list and validates filters',
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
      levelV2ShadowSetupQualitySampleRoutes,
      {
        levelV2ShadowRuntimeReader:
          runtime,
      },
    );

    const valid =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-samples?qualityLabel=unresolved&limit=10',
      });
    const invalid =
      await app.inject({
        method:
          'GET',
        url:
          '/setups/levels-v2/shadow/setup-quality-samples?qualityLabel=unknown',
      });

    assert.equal(
      valid.statusCode,
      200,
    );
    assert.equal(
      valid.json().count,
      0,
    );
    assert.equal(
      invalid.statusCode,
      400,
    );
    await app.close();
  },
);
