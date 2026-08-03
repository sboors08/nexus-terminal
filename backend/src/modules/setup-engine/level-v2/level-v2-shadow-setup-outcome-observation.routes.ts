import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowSetupOutcomeObservationDiagnostics,
  buildLevelV2ShadowSetupOutcomeObservationSnapshot,
  buildLevelV2ShadowSetupOutcomeObservationStatus,
} from './level-v2-shadow-setup-outcome-observation.js';
import type {
  LevelV2ShadowSetupOutcomeObservationFilters,
  LevelV2ShadowSetupOutcomeObservationListResponse,
  LevelV2ShadowSetupOutcomeStatus,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2ShadowConfirmationExpectedDirection,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowSetupOutcomeObservationRoutesOptions {
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

interface OutcomeQuery {
  symbol?: string;
  classifierId?: string;
  status?: string;
  expectedDirection?: string;
  limit?: string;
}

function parseFilters(
  query:
    OutcomeQuery,
):
LevelV2ShadowSetupOutcomeObservationFilters
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

function readOutcomeObservations(
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
  const levels = [
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
  const snapshot =
    buildLevelV2ShadowSetupOutcomeObservationSnapshot(
      sourceEntries,
      levels,
    );
  const diagnostics =
    buildLevelV2ShadowSetupOutcomeObservationDiagnostics(
      snapshot.observations,
    );
  const status =
    buildLevelV2ShadowSetupOutcomeObservationStatus(
      snapshot.observations,
      sourceEntries.length,
      snapshot
        .sourceCandidateHistoryEntriesCount,
      levels.length,
      sourceStatus,
    );

  return {
    observations:
      snapshot.observations,
    status,
    diagnostics,
  };
}

export const levelV2ShadowSetupOutcomeObservationRoutes:
FastifyPluginAsync<
  LevelV2ShadowSetupOutcomeObservationRoutesOptions
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
    '/setups/levels-v2/shadow/setup-outcomes/status',
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
          'level_v2_shadow_setup_outcome_observation_unavailable',
          'Level v2 shadow setup outcome observation is unavailable',
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
          'invalid_level_v2_shadow_setup_outcome_observation_query',
          'Invalid Level v2 shadow setup outcome observation query',
        );
      }

      return readOutcomeObservations(
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
      OutcomeQuery;
  }>(
    '/setups/levels-v2/shadow/setup-outcomes',
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
          'level_v2_shadow_setup_outcome_observation_unavailable',
          'Level v2 shadow setup outcome observation is unavailable',
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
          'invalid_level_v2_shadow_setup_outcome_observation_query',
          'Invalid Level v2 shadow setup outcome observation query',
        );
      }

      const snapshot =
        readOutcomeObservations(
          runtime,
          filters.symbol,
          filters.classifierId,
        );
      const all =
        snapshot.observations.filter(
          (observation) =>
            (
              filters.status === null
              || observation.status
                === filters.status
            )
            && (
              filters.expectedDirection
                === null
              || observation
                .expectedDirection
                === filters
                  .expectedDirection
            ),
        );
      const response:
      LevelV2ShadowSetupOutcomeObservationListResponse = {
        items:
          all.slice(
            0,
            filters.limit,
          ),
        count:
          Math.min(
            all.length,
            filters.limit,
          ),
        totalObservations:
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
    '/setups/levels-v2/shadow/setup-outcomes/diagnostics',
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
          'level_v2_shadow_setup_outcome_observation_unavailable',
          'Level v2 shadow setup outcome observation is unavailable',
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
          'invalid_level_v2_shadow_setup_outcome_observation_query',
          'Invalid Level v2 shadow setup outcome observation query',
        );
      }

      return readOutcomeObservations(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).diagnostics;
    },
  );
};
