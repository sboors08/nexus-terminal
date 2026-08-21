import type {
  SetupEngineState,
} from './setup-engine.types.js';

export const SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION =
  'setup-candidate-current-episode-projection-v0.1' as const;

export interface SetupCandidateCurrentEpisodeProjectionResult {
  readonly version:
    typeof SETUP_CANDIDATE_CURRENT_EPISODE_PROJECTION_VERSION;

  readonly candidates:
    readonly SetupEngineState[];

  readonly sourceCandidatesCount: number;
  readonly currentCandidatesCount: number;
  readonly supersededEpisodesCount: number;

  readonly projectionKey:
    'symbol_line_id_setup_type';

  readonly preservesLegacyCandidates: true;
  readonly preservesHistory: true;
  readonly changesDecisionRules: false;
  readonly createsTradeOrder: false;
}
