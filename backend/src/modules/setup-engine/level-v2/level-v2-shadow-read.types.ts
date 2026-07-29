import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2ShadowRejectionCounts,
  LevelV2ShadowRuntimeStatus,
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowSnapshotFilters {
  symbol: string | null;
  kind: LevelV2Kind | null;
  status: LevelV2LifecycleStatus | null;
  eligibleForSetups: boolean | null;
  minScore: number | null;
  limit: number;
}

export interface LevelV2ShadowSnapshotListResponse {
  items: readonly LevelV2ShadowSnapshot[];
  count: number;
  totalSnapshots: number;
  filters: LevelV2ShadowSnapshotFilters;
}

export interface LevelV2ShadowDiagnostics {
  runtime: LevelV2ShadowRuntimeStatus;
  symbolsCount: number;
  snapshotsCount: number;
  trackedLevelsCount: number;
  eligibleLevelsCount: number;
  lifecycleEventsCount: number;
  detectedZonesCount: number;
  rejectedZonesCount: number;
  lifecycleStatusCounts: Record<LevelV2LifecycleStatus, number>;
  kindCounts: Record<LevelV2Kind, number>;
  rejectionCounts: LevelV2ShadowRejectionCounts;
  latestGeneratedAt: string | null;
}
