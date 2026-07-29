import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import type {
  LevelV2LifecycleStatus,
} from './level-v2-lifecycle.types.js';
import type {
  LevelV2Kind,
} from './level-v2-zones-score.types.js';
import type {
  LevelV2ShadowRuntimeReader,
  LevelV2ShadowSnapshot,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowDiagnostics,
  LevelV2ShadowHistoryListResponse,
  LevelV2ShadowSnapshotFilters,
  LevelV2ShadowSnapshotListResponse,
} from './level-v2-shadow-read.types.js';

export interface LevelV2ShadowReadRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const LEVEL_KINDS:
readonly LevelV2Kind[] = [
  'support',
  'resistance',
];

const LIFECYCLE_STATUSES:
readonly LevelV2LifecycleStatus[] = [
  'forming',
  'active',
  'testing',
  'broken',
  'retest_pending',
  'flipped',
  'expired',
];

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
) {
  const payload:
  ApiErrorResponse = {
    error,
    message,
    requestId:
      request.id,
  };

  return reply
    .status(statusCode)
    .send(payload);
}

function normalizeSymbol(
  value:
    string
    | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const symbol =
    value.trim().toUpperCase();

  return SYMBOL_PATTERN.test(
    symbol,
  )
    ? symbol
    : null;
}

function parseKind(
  value:
    string
    | undefined,
): LevelV2Kind | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return LEVEL_KINDS.includes(
    normalized as
      LevelV2Kind,
  )
    ? normalized as
        LevelV2Kind
    : null;
}

function parseStatus(
  value:
    string
    | undefined,
): LevelV2LifecycleStatus | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim();

  return LIFECYCLE_STATUSES.includes(
    normalized as
      LevelV2LifecycleStatus,
  )
    ? normalized as
        LevelV2LifecycleStatus
    : null;
}

function parseBoolean(
  value:
    string
    | undefined,
): boolean | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return null;
}

function parseMinScore(
  value:
    string
    | undefined,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    && parsed >= 0
    && parsed <= 100
      ? parsed
      : null;
}

function parseLimit(
  value:
    string
    | undefined,
): number | null {
  if (value === undefined) {
    return 100;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= 500
      ? parsed
      : null;
}

function filterSnapshot(
  snapshot:
    LevelV2ShadowSnapshot,
  filters:
    LevelV2ShadowSnapshotFilters,
): LevelV2ShadowSnapshot {
  const levels =
    snapshot.levels.filter(
      (state) =>
        (
          filters.kind === null
          || state.currentKind
            === filters.kind
        )
        && (
          filters.status === null
          || state.status
            === filters.status
        )
        && (
          filters.eligibleForSetups
            === null
          || state.eligibleForSetups
            === filters.eligibleForSetups
        )
        && (
          filters.minScore === null
          || state.level.score.total
            >= filters.minScore
        ),
    );

  const levelIds =
    new Set(
      levels.map(
        (state) =>
          state.level.id,
      ),
    );

  return {
    ...snapshot,
    levels,
    lifecycleEvents:
      snapshot.lifecycleEvents.filter(
        (event) =>
          levelIds.has(
            event.levelId,
          ),
      ),
  };
}

function emptyStatusCounts():
Record<LevelV2LifecycleStatus, number> {
  return {
    forming: 0,
    active: 0,
    testing: 0,
    broken: 0,
    retest_pending: 0,
    flipped: 0,
    expired: 0,
  };
}

function emptyKindCounts():
Record<LevelV2Kind, number> {
  return {
    support: 0,
    resistance: 0,
  };
}

function buildDiagnostics(
  runtime:
    LevelV2ShadowRuntimeReader,
): LevelV2ShadowDiagnostics {
  const snapshots =
    runtime.getSnapshots();

  const lifecycleStatusCounts =
    emptyStatusCounts();

  const kindCounts =
    emptyKindCounts();

  const rejectionCounts = {
    insufficientTouches: 0,
    acceptanceZone: 0,
    structureMidrange: 0,
    scoreBelowThreshold: 0,
  };

  let trackedLevelsCount = 0;
  let eligibleLevelsCount = 0;
  let lifecycleEventsCount = 0;
  let detectedZonesCount = 0;
  let rejectedZonesCount = 0;
  let latestGeneratedAt:
    string | null = null;

  for (
    const snapshot
    of snapshots
  ) {
    trackedLevelsCount +=
      snapshot.levels.length;

    eligibleLevelsCount +=
      snapshot.levels.filter(
        (level) =>
          level.eligibleForSetups,
      ).length;

    lifecycleEventsCount +=
      snapshot.lifecycleEvents.length;

    detectedZonesCount +=
      snapshot.detectedZonesCount;

    rejectedZonesCount +=
      snapshot.rejectedZonesCount;

    rejectionCounts.insufficientTouches +=
      snapshot.rejectionCounts
        .insufficientTouches;

    rejectionCounts.acceptanceZone +=
      snapshot.rejectionCounts
        .acceptanceZone;

    rejectionCounts.structureMidrange +=
      snapshot.rejectionCounts
        .structureMidrange;

    rejectionCounts.scoreBelowThreshold +=
      snapshot.rejectionCounts
        .scoreBelowThreshold;

    for (
      const level
      of snapshot.levels
    ) {
      lifecycleStatusCounts[
        level.status
      ] += 1;

      kindCounts[
        level.currentKind
      ] += 1;
    }

    if (
      latestGeneratedAt === null
      || Date.parse(
        snapshot.generatedAt,
      ) > Date.parse(
        latestGeneratedAt,
      )
    ) {
      latestGeneratedAt =
        snapshot.generatedAt;
    }
  }

  return {
    runtime:
      runtime.getStatus(),
    symbolsCount:
      new Set(
        snapshots.map(
          (snapshot) =>
            snapshot.symbol,
        ),
      ).size,
    snapshotsCount:
      snapshots.length,
    trackedLevelsCount,
    eligibleLevelsCount,
    lifecycleEventsCount,
    detectedZonesCount,
    rejectedZonesCount,
    lifecycleStatusCounts,
    kindCounts,
    rejectionCounts,
    latestGeneratedAt,
  };
}

export const levelV2ShadowReadRoutes:
FastifyPluginAsync<
  LevelV2ShadowReadRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/setups/levels-v2/shadow/runtime/status',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      return runtime.getStatus();
    },
  );

  app.get(
    '/setups/levels-v2/shadow/diagnostics',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      return buildDiagnostics(
        runtime,
      );
    },
  );

  app.get(
    '/setups/levels-v2/shadow/history/status',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || typeof runtime
          .getEvaluationHistoryStatus
          !== 'function'
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_history_unavailable',
          'Level v2 shadow evaluation history is unavailable',
        );
      }

      return runtime
        .getEvaluationHistoryStatus();
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      limit?: string;
    };
  }>(
    '/setups/levels-v2/shadow/history',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_history_symbol',
          'Invalid Level v2 shadow history symbol',
        );
      }

      const limit =
        parseLimit(
          request.query.limit,
        );

      if (limit === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_history_limit',
          'Level v2 shadow history limit must be an integer from 1 to 500',
        );
      }

      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || typeof runtime
          .getEvaluationHistory
          !== 'function'
        || typeof runtime
          .getEvaluationHistoryStatus
          !== 'function'
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_history_unavailable',
          'Level v2 shadow evaluation history is unavailable',
        );
      }

      const status =
        runtime
          .getEvaluationHistoryStatus();

      const items =
        runtime
          .getEvaluationHistory(
            symbol
            ?? undefined,
            limit,
          );

      const response:
      LevelV2ShadowHistoryListResponse = {
        items,
        count:
          items.length,
        totalEntries:
          status.entriesCount,
        status,
        filters: {
          symbol:
            symbol
            ?? null,
          limit,
        },
      };

      return response;
    },
  );

  app.get<{
    Params: {
      symbol: string;
    };
    Querystring: {
      limit?: string;
    };
  }>(
    '/setups/levels-v2/shadow/history/:symbol',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.params.symbol,
        );

      if (
        symbol === null
        || symbol === undefined
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_history_symbol',
          'Invalid Level v2 shadow history symbol',
        );
      }

      const limit =
        parseLimit(
          request.query.limit,
        );

      if (limit === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_history_limit',
          'Level v2 shadow history limit must be an integer from 1 to 500',
        );
      }

      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || typeof runtime
          .getEvaluationHistory
          !== 'function'
        || typeof runtime
          .getEvaluationHistoryStatus
          !== 'function'
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_history_unavailable',
          'Level v2 shadow evaluation history is unavailable',
        );
      }

      const items =
        runtime
          .getEvaluationHistory(
            symbol,
            limit,
          );

      if (items.length === 0) {
        return sendError(
          request,
          reply,
          404,
          'level_v2_shadow_history_not_found',
          `Level v2 shadow history ${symbol} was not found`,
        );
      }

      const status =
        runtime
          .getEvaluationHistoryStatus();

      const response:
      LevelV2ShadowHistoryListResponse = {
        items,
        count:
          items.length,
        totalEntries:
          status.entriesCount,
        status,
        filters: {
          symbol,
          limit,
        },
      };

      return response;
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      kind?: string;
      status?: string;
      eligibleForSetups?: string;
      minScore?: string;
      limit?: string;
    };
  }>(
    '/setups/levels-v2/shadow/snapshots',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_symbol',
          'Invalid Level v2 shadow symbol',
        );
      }

      const kind =
        parseKind(
          request.query.kind,
        );

      if (kind === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_kind',
          'Level v2 shadow kind must be support or resistance',
        );
      }

      const status =
        parseStatus(
          request.query.status,
        );

      if (status === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_status',
          'Invalid Level v2 shadow lifecycle status',
        );
      }

      const eligibleForSetups =
        parseBoolean(
          request.query
            .eligibleForSetups,
        );

      if (eligibleForSetups === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_eligibility',
          'eligibleForSetups must be true or false',
        );
      }

      const minScore =
        parseMinScore(
          request.query.minScore,
        );

      if (minScore === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_min_score',
          'minScore must be between 0 and 100',
        );
      }

      const limit =
        parseLimit(
          request.query.limit,
        );

      if (limit === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_limit',
          'Level v2 shadow limit must be an integer from 1 to 500',
        );
      }

      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      const filters:
      LevelV2ShadowSnapshotFilters = {
        symbol:
          symbol
          ?? null,
        kind:
          kind
          ?? null,
        status:
          status
          ?? null,
        eligibleForSetups:
          eligibleForSetups
          ?? null,
        minScore:
          minScore
          ?? null,
        limit,
      };

      const allSnapshots =
        runtime.getSnapshots();

      const hasLevelFilters =
        filters.kind !== null
        || filters.status !== null
        || filters.eligibleForSetups
          !== null
        || filters.minScore !== null;

      const items =
        allSnapshots
          .filter(
            (snapshot) =>
              filters.symbol === null
              || snapshot.symbol
                === filters.symbol,
          )
          .map(
            (snapshot) =>
              filterSnapshot(
                snapshot,
                filters,
              ),
          )
          .filter(
            (snapshot) =>
              !hasLevelFilters
              || snapshot.levels.length
                > 0,
          )
          .sort(
            (
              left,
              right,
            ) =>
              Date.parse(
                right.generatedAt,
              )
              - Date.parse(
                  left.generatedAt,
                )
              || left.symbol.localeCompare(
                right.symbol,
              ),
          )
          .slice(
            0,
            limit,
          );

      const response:
      LevelV2ShadowSnapshotListResponse = {
        items,
        count:
          items.length,
        totalSnapshots:
          allSnapshots.length,
        filters,
      };

      return response;
    },
  );

  app.get<{
    Params: {
      symbol: string;
    };
  }>(
    '/setups/levels-v2/shadow/snapshots/:symbol',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.params.symbol,
        );

      if (
        symbol === null
        || symbol === undefined
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_symbol',
          'Invalid Level v2 shadow symbol',
        );
      }

      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (!runtime) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_runtime_unavailable',
          'Level v2 shadow runtime is unavailable',
        );
      }

      const snapshot =
        runtime.getSnapshot(
          symbol,
        );

      if (!snapshot) {
        return sendError(
          request,
          reply,
          404,
          'level_v2_shadow_snapshot_not_found',
          `Level v2 shadow snapshot ${symbol} was not found`,
        );
      }

      return snapshot;
    },
  );
};
