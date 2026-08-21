import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
} from '../src/modules/setup-engine/causal-setup-adapter.types.js';
import {
  projectCurrentSetupCandidateEpisodes,
} from '../src/modules/setup-engine/setup-candidate-current-episode-projection.js';
import {
  SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION,
} from '../src/modules/setup-engine/setup-candidate-current-episode-projection.types.js';
import type {
  SetupEngineSetupType,
  SetupEngineState,
} from '../src/modules/setup-engine/setup-engine.types.js';

function createCandidate(
  input: {
    id: string;
    symbol?: string;
    lineId?: string;
    setupType?:
      SetupEngineSetupType;
    startedAt?: string;
    updatedAt?: string;
    centerPrice?: number;
  },
): SetupEngineState {
  const symbol =
    input.symbol
    ?? 'SOLUSDT';
  const setupType =
    input.setupType
    ?? 'level_breakout';
  const startedAt =
    input.startedAt
    ?? '2026-08-21T12:00:00.000Z';
  const centerPrice =
    input.centerPrice
    ?? 100;

  return {
    id: input.id,
    symbol,
    timeframe: '1m',
    setupType,
    direction:
      setupType === 'level_breakout'
        ? 'long'
        : 'short',
    stage:
      'LEVEL_CONFIRMED',
    outcome: null,
    level: {
      kind: 'resistance',
      centerPrice,
      zoneLow: centerPrice,
      zoneHigh: centerPrice,
      touches: 3,
      confirmedAt:
        '2026-08-21T10:00:00.000Z',
    },
    currentPrice:
      centerPrice - 1,
    distanceToLevelPct: 1,
    createdAt: startedAt,
    updatedAt:
      input.updatedAt
      ?? startedAt,
    expiresAt:
      '2026-08-21T18:00:00.000Z',
    ...(input.lineId
      ? {
          episode: {
            version:
              SETUP_CANDIDATE_EPISODE_CONTRACT_VERSION,
            id: input.id,
            lineId:
              input.lineId,
            setupType,
            startedAt,
            departureExtremumObservedAt:
              '2026-08-21T11:59:00.000Z',
            boundary:
              'observation_threshold_reentry',
            restartDeterministic: true,
            usesFutureCandles: false,
          },
        }
      : {}),
  };
}

test(
  'projects the newest episode for one symbol, line and setup type',
  () => {
    const oldEpisode =
      createCandidate({
        id: 'old-episode',
        lineId: 'line-sol-resistance',
        startedAt:
          '2026-08-21T12:00:00.000Z',
      });
    const currentEpisode =
      createCandidate({
        id: 'current-episode',
        lineId: 'line-sol-resistance',
        startedAt:
          '2026-08-21T13:00:00.000Z',
      });

    const result =
      projectCurrentSetupCandidateEpisodes([
        oldEpisode,
        currentEpisode,
      ]);

    assert.deepEqual(
      result.candidates.map(
        (candidate) =>
          candidate.id,
      ),
      [
        'current-episode',
      ],
    );
    assert.equal(
      result.supersededEpisodesCount,
      1,
    );
  },
);

test(
  'keeps independent line ids even when their displayed levels match',
  () => {
    const result =
      projectCurrentSetupCandidateEpisodes([
        createCandidate({
          id: 'line-a-episode',
          lineId: 'line-a',
          centerPrice: 100,
        }),
        createCandidate({
          id: 'line-b-episode',
          lineId: 'line-b',
          centerPrice: 100,
        }),
      ]);

    assert.deepEqual(
      result.candidates.map(
        (candidate) =>
          candidate.id,
      ),
      [
        'line-a-episode',
        'line-b-episode',
      ],
    );
  },
);

test(
  'keeps breakout and bounce projections separate for the same line',
  () => {
    const result =
      projectCurrentSetupCandidateEpisodes([
        createCandidate({
          id: 'breakout-episode',
          lineId: 'line-a',
          setupType:
            'level_breakout',
        }),
        createCandidate({
          id: 'bounce-episode',
          lineId: 'line-a',
          setupType:
            'level_bounce',
        }),
      ]);

    assert.equal(
      result.candidates.length,
      2,
    );
  },
);

test(
  'keeps symbols separate when a line id is reused',
  () => {
    const result =
      projectCurrentSetupCandidateEpisodes([
        createCandidate({
          id: 'sol-episode',
          symbol: 'SOLUSDT',
          lineId: 'line-a',
        }),
        createCandidate({
          id: 'eth-episode',
          symbol: 'ETHUSDT',
          lineId: 'line-a',
        }),
      ]);

    assert.equal(
      result.candidates.length,
      2,
    );
  },
);

test(
  'preserves legacy candidates without episode identity',
  () => {
    const result =
      projectCurrentSetupCandidateEpisodes([
        createCandidate({
          id: 'legacy-a',
        }),
        createCandidate({
          id: 'legacy-b',
        }),
      ]);

    assert.deepEqual(
      result.candidates.map(
        (candidate) =>
          candidate.id,
      ),
      [
        'legacy-a',
        'legacy-b',
      ],
    );
  },
);

test(
  'uses updated time and id as deterministic equal-boundary tie breakers',
  () => {
    const result =
      projectCurrentSetupCandidateEpisodes([
        createCandidate({
          id: 'episode-a',
          lineId: 'line-a',
          updatedAt:
            '2026-08-21T12:01:00.000Z',
        }),
        createCandidate({
          id: 'episode-b',
          lineId: 'line-a',
          updatedAt:
            '2026-08-21T12:02:00.000Z',
        }),
      ]);

    assert.equal(
      result.candidates[0]?.id,
      'episode-b',
    );
  },
);

test(
  'reports a versioned observational projection contract',
  () => {
    const source = [
      createCandidate({
        id: 'episode-a',
        lineId: 'line-a',
      }),
    ];
    const result =
      projectCurrentSetupCandidateEpisodes(
        source,
      );

    assert.equal(
      result.version,
      SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION,
    );
    assert.equal(
      result.sourceCandidatesCount,
      1,
    );
    assert.equal(
      result.currentCandidatesCount,
      1,
    );
    assert.equal(
      result.preservesHistory,
      true,
    );
    assert.equal(
      result.changesDecisionRules,
      false,
    );
    assert.equal(
      result.createsTradeOrder,
      false,
    );
    assert.equal(
      source.length,
      1,
    );
  },
);

test(
  'rejects an invalid episode boundary timestamp',
  () => {
    assert.throws(
      () =>
        projectCurrentSetupCandidateEpisodes([
          createCandidate({
            id: 'invalid-episode',
            lineId: 'line-a',
            startedAt: 'invalid',
          }),
        ]),
      /Invalid current-episode projection timestamp: episode.startedAt/,
    );
  },
);
