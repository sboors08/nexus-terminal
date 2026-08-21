import type {
  SetupEngineState,
} from './setup-engine.types.js';
import {
  SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION,
} from './setup-candidate-current-episode-projection.types.js';
import type {
  SetupCandidateCurrentEpisodeProjectionResult,
} from './setup-candidate-current-episode-projection.types.js';

function projectionKey(
  candidate: SetupEngineState,
): string | null {
  const episode =
    candidate.episode;

  if (!episode) {
    return null;
  }

  if (episode.lineId.trim().length === 0) {
    throw new Error(
      'Current-episode projection line id cannot be empty',
    );
  }

  if (
    episode.setupType
    !== candidate.setupType
  ) {
    throw new Error(
      'Current-episode projection setup type must match candidate identity',
    );
  }

  timestamp(
    episode.startedAt,
    'episode.startedAt',
  );

  return JSON.stringify([
    candidate.symbol,
    episode.lineId,
    candidate.setupType,
  ]);
}

function timestamp(
  value: string,
  field: string,
): number {
  const parsed =
    Date.parse(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid current-episode projection timestamp: ${field}`,
    );
  }

  return parsed;
}

function compareEpisodeRecency(
  left: SetupEngineState,
  right: SetupEngineState,
): number {
  const leftEpisode =
    left.episode;
  const rightEpisode =
    right.episode;

  if (!leftEpisode || !rightEpisode) {
    throw new Error(
      'Current-episode projection comparison requires episode identity',
    );
  }

  const startedAtDifference =
    timestamp(
      leftEpisode.startedAt,
      'episode.startedAt',
    )
    - timestamp(
        rightEpisode.startedAt,
        'episode.startedAt',
      );

  if (startedAtDifference !== 0) {
    return startedAtDifference;
  }

  const updatedAtDifference =
    timestamp(
      left.updatedAt,
      'candidate.updatedAt',
    )
    - timestamp(
        right.updatedAt,
        'candidate.updatedAt',
      );

  return updatedAtDifference !== 0
    ? updatedAtDifference
    : left.id.localeCompare(
        right.id,
      );
}

export function projectCurrentSetupCandidateEpisodes(
  candidates:
    readonly SetupEngineState[],
): SetupCandidateCurrentEpisodeProjectionResult {
  const currentByKey =
    new Map<
      string,
      SetupEngineState
    >();

  for (const candidate of candidates) {
    const key =
      projectionKey(candidate);

    if (key === null) {
      continue;
    }

    const current =
      currentByKey.get(key);

    if (
      !current
      || compareEpisodeRecency(
        candidate,
        current,
      ) > 0
    ) {
      currentByKey.set(
        key,
        candidate,
      );
    }
  }

  const projected =
    candidates.filter(
      (candidate) => {
        const key =
          projectionKey(candidate);

        return key === null
          || currentByKey.get(key)
            === candidate;
      },
    );

  return Object.freeze({
    version:
      SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION,

    candidates:
      Object.freeze([
        ...projected,
      ]),

    sourceCandidatesCount:
      candidates.length,

    currentCandidatesCount:
      projected.length,

    supersededEpisodesCount:
      candidates.length
      - projected.length,

    projectionKey:
      'symbol_line_id_setup_type',

    preservesLegacyCandidates: true,
    preservesHistory: true,
    changesDecisionRules: false,
    createsTradeOrder: false,
  });
}
