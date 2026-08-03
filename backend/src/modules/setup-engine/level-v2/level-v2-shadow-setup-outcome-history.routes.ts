import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowSetupOutcomeHistoryStore,
} from './level-v2-shadow-setup-outcome-history.js';
import type {
  LevelV2ShadowSetupOutcomeHistoryFilters,
  LevelV2ShadowSetupOutcomeHistoryListResponse,
} from './level-v2-shadow-setup-outcome-history.types.js';
import {
  buildLevelV2ShadowSetupOutcomeObservationSnapshot,
} from './level-v2-shadow-setup-outcome-observation.js';
import type {
  LevelV2ShadowSetupOutcomeStatus,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowSetupOutcomeHistoryRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

const SOURCE_HISTORY_LIMIT =
  10_000;

const STATUSES:
readonly LevelV2ShadowSetupOutcomeStatus[] = [
  'pending',
  'successful_continuation',
  'failed_reversal',
  'mixed',
];

const DIRECTIONS:
readonly LevelV2ShadowConfirmationExpectedDirection[] = [
  'up',
  'down',
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

function normalizeClassifierId(
  value:
    string
    | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const classifierId =
    value.trim();

  return CLASSIFIER_ID_PATTERN.test(
    classifierId,
  )
    ? classifierId
    : null;
}

function normalizeStatus(
  value:
    string
    | undefined,
):
LevelV2ShadowSetupOutcomeStatus
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return STATUSES.includes(
    value as
      LevelV2ShadowSetupOutcomeStatus,
  )
    ? value as
      LevelV2ShadowSetupOutcomeStatus
    : null;
}

function normalizeDirection(
  value:
    string
    | undefined,
):
LevelV2ShadowConfirmationExpectedDirection
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return DIRECTIONS.includes(
    value as
      LevelV2ShadowConfirmationExpectedDirection,
  )
    ? value as
      LevelV2ShadowConfirmationExpectedDirection
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

function hasHistoryReader(
  runtime:
    LevelV2ShadowRuntimeReader,
): runtime is
  LevelV2ShadowRuntimeReader
  & Required<
    Pick<
      LevelV2ShadowRuntimeReader,
      'getMarketEvidenceHistory'
    >
  > {
  return typeof runtime
    .getMarketEvidenceHistory
      === 'function';
}

interface OutcomeHistoryQuery {
  symbol?: string;
  classifierId?: string;
  status?: string;
  expectedDirection?: string;
  limit?: string;
}

function parseFilters(
  query:
    OutcomeHistoryQuery,
):
LevelV2ShadowSetupOutcomeHistoryFilters
| null {
  const symbol =
    normalizeSymbol(
      query.symbol,
    );
  const classifierId =
    normalizeClassifierId(
      query.classifierId,
    );
  const status =
    normalizeStatus(
      query.status,
    );
  const expectedDirection =
    normalizeDirection(
      query.expectedDirection,
    );
  const limit =
    parseLimit(
      query.limit,
    );

  if (
    symbol === null
    || classifierId === null
    || status === null
    || expectedDirection === null
    || limit === null
  ) {
    return null;
  }

  return {
    symbol:
      symbol
      ?? null,
    classifierId:
      classifierId
      ?? null,
    status:
      status
      ?? null,
    expectedDirection:
      expectedDirection
      ?? null,
    limit,
  };
}

function readLevels(
  runtime:
    LevelV2ShadowRuntimeReader,
  symbol:
    string
    | null,
) {
  const snapshots =
    symbol === null
      ? runtime.getSnapshots()
      : [
          runtime.getSnapshot(
            symbol,
          ),
        ].filter(
          (
            snapshot,
          ): snapshot is NonNullable<
            typeof snapshot
          > =>
            snapshot !== null,
        );

  return [
    ...new Map(
      snapshots
        .flatMap(
          (snapshot) =>
            snapshot.levels,
        )
        .map(
          (level) => [
            level.id,
            level,
          ] as const,
        ),
    ).values(),
  ];
}

function readOutcomeHistory(
  runtime:
    LevelV2ShadowRuntimeReader
    & Required<
      Pick<
        LevelV2ShadowRuntimeReader,
        'getMarketEvidenceHistory'
      >
    >,
  symbol:
    string
    | null,
  classifierId:
    string
    | null,
) {
  const sourceEntries =
    runtime.getMarketEvidenceHistory(
      symbol
      ?? undefined,
      classifierId
      ?? undefined,
      SOURCE_HISTORY_LIMIT,
    );
  const sourceStatus =
    runtime
      .getMarketEvidenceHistoryStatus
      ?.()
    ?? null;
  const levels =
    readLevels(
      runtime,
      symbol,
    );
  const currentSnapshot =
    buildLevelV2ShadowSetupOutcomeObservationSnapshot(
      sourceEntries,
      levels,
    );
  const store =
    buildLevelV2ShadowSetupOutcomeHistoryStore(
      sourceEntries,
      levels,
    );

  return {
    store,
    status:
      store.getStatus(
        sourceEntries.length,
        currentSnapshot
          .observations.length,
        levels.length,
        sourceStatus,
        SOURCE_HISTORY_LIMIT,
      ),
    diagnostics:
      store.getDiagnostics(),
  };
}

export const levelV2ShadowSetupOutcomeHistoryRoutes:
FastifyPluginAsync<
  LevelV2ShadowSetupOutcomeHistoryRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      symbol?: string;
      classifierId?: string;
    };
  }>(
    '/setups/levels-v2/shadow/setup-outcomes/history/status',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || !hasHistoryReader(
          runtime,
        )
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_setup_outcome_history_unavailable',
          'Level v2 shadow setup outcome history is unavailable',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );
      const classifierId =
        normalizeClassifierId(
          request.query
            .classifierId,
        );

      if (
        symbol === null
        || classifierId === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_setup_outcome_history_query',
          'Invalid Level v2 shadow setup outcome history query',
        );
      }

      return readOutcomeHistory(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).status;
    },
  );

  app.get<{
    Querystring:
      OutcomeHistoryQuery;
  }>(
    '/setups/levels-v2/shadow/setup-outcomes/history',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || !hasHistoryReader(
          runtime,
        )
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_setup_outcome_history_unavailable',
          'Level v2 shadow setup outcome history is unavailable',
        );
      }

      const filters =
        parseFilters(
          request.query,
        );

      if (!filters) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_setup_outcome_history_query',
          'Invalid Level v2 shadow setup outcome history query',
        );
      }

      const snapshot =
        readOutcomeHistory(
          runtime,
          filters.symbol,
          filters.classifierId,
        );
      const items =
        snapshot.store.getHistory(
          filters.symbol
          ?? undefined,
          filters.classifierId
          ?? undefined,
          filters.limit,
          filters.status
          ?? undefined,
          filters.expectedDirection
          ?? undefined,
        );
      const all =
        snapshot.store.getHistory(
          filters.symbol
          ?? undefined,
          filters.classifierId
          ?? undefined,
          SOURCE_HISTORY_LIMIT,
          filters.status
          ?? undefined,
          filters.expectedDirection
          ?? undefined,
        );
      const response:
      LevelV2ShadowSetupOutcomeHistoryListResponse = {
        items,
        count:
          items.length,
        totalEntries:
          all.length,
        status:
          snapshot.status,
        diagnostics:
          snapshot.diagnostics,
        filters,
      };

      return response;
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      classifierId?: string;
    };
  }>(
    '/setups/levels-v2/shadow/setup-outcomes/history/diagnostics',
    async (
      request,
      reply,
    ) => {
      const runtime =
        options
          .levelV2ShadowRuntimeReader;

      if (
        !runtime
        || !hasHistoryReader(
          runtime,
        )
      ) {
        return sendError(
          request,
          reply,
          503,
          'level_v2_shadow_setup_outcome_history_unavailable',
          'Level v2 shadow setup outcome history is unavailable',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );
      const classifierId =
        normalizeClassifierId(
          request.query
            .classifierId,
        );

      if (
        symbol === null
        || classifierId === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_setup_outcome_history_query',
          'Invalid Level v2 shadow setup outcome history query',
        );
      }

      return readOutcomeHistory(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).diagnostics;
    },
  );
};
