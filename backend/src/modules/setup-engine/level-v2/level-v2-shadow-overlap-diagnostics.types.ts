import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';

export type LevelV2ShadowOverlapRelationship =
  | 'same_kind_core_overlap'
  | 'same_kind_outer_overlap'
  | 'same_kind_nearby'
  | 'opposite_kind_core_overlap'
  | 'opposite_kind_outer_overlap'
  | 'opposite_kind_nearby';

export interface LevelV2ShadowOverlapDiagnosticsOptions {
  symbol:
    string
    | null;
  maxReferenceDistancePct: number;
  minOverlapPct: number;
  includeOppositeKind: boolean;
  onlyReviewCandidates: boolean;
  limit: number;
}

export interface LevelV2ShadowOverlapLevelSummary {
  id: string;
  originalKind: LevelV2Kind;
  currentKind: LevelV2Kind;
  status: LevelV2LifecycleStatus;
  eligibleForSetups: boolean;
  referencePrice: number;
  coreLow: number;
  coreHigh: number;
  outerLow: number;
  outerHigh: number;
  liquidityLow: number;
  liquidityHigh: number;
  score: number;
  touchesCount: number;
  qualifiedTouchesCount: number;
}

export interface LevelV2ShadowOverlapHistoryEvidence {
  available: boolean;
  entriesChecked: number;
  occurrencesCount: number;
  persistencePct:
    number
    | null;
  firstSeenAt:
    string
    | null;
  lastSeenAt:
    string
    | null;
}

export interface LevelV2ShadowOverlapPair {
  id: string;
  symbol: string;
  relationship:
    LevelV2ShadowOverlapRelationship;
  sameKind: boolean;
  bothEligibleForSetups: boolean;
  duplicateCandidate: boolean;
  conflictCandidate: boolean;
  reviewPriority: number;
  referenceDistancePct: number;
  coreOverlapPct: number;
  outerOverlapPct: number;
  outerGapPct: number;
  left:
    LevelV2ShadowOverlapLevelSummary;
  right:
    LevelV2ShadowOverlapLevelSummary;
  history:
    LevelV2ShadowOverlapHistoryEvidence;
}

export interface LevelV2ShadowOverlapDiagnosticsSummary {
  snapshotsAnalyzed: number;
  levelsAnalyzed: number;
  pairsEvaluated: number;
  qualifyingPairsCount: number;
  returnedPairsCount: number;
  symbolsWithQualifyingPairsCount: number;
  sameKindPairsCount: number;
  oppositeKindPairsCount: number;
  bothEligiblePairsCount: number;
  duplicateCandidatesCount: number;
  conflictCandidatesCount: number;
  historyAvailable: boolean;
  historyEntriesChecked: number;
  relationshipCounts:
    Record<
      LevelV2ShadowOverlapRelationship,
      number
    >;
}

export interface LevelV2ShadowOverlapDiagnostics {
  generatedAt:
    string
    | null;
  options:
    LevelV2ShadowOverlapDiagnosticsOptions;
  summary:
    LevelV2ShadowOverlapDiagnosticsSummary;
  items:
    readonly LevelV2ShadowOverlapPair[];
}
