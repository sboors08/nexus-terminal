import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowSetupQualitySampleSnapshot,
  filterLevelV2ShadowSetupQualitySamples,
  isLevelV2ShadowSetupQualityDirection,
} from './level-v2-shadow-setup-quality-sample.js';
import type {
  LevelV2ShadowSetupQualityLabel,
  LevelV2ShadowSetupQualitySampleFilters,
  LevelV2ShadowSetupQualitySampleListResponse,
} from './level-v2-shadow-setup-quality-sample.types.js';
import type {
  LevelV2ShadowSetupOutcomeStatus,
} from './level-v2-shadow-setup-outcome-observation.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowSetupQualitySampleRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

const SOURCE_HISTORY_LIMIT =
  10_000;

const QUALITY_LABELS:
readonly LevelV2ShadowSetupQualityLabel[] = [
  'successful',
  'failed',
  'mixed',
  'unresolved',
];

const OUTCOME_STATUSES:
readonly LevelV2ShadowSetupOutcomeStatus[] = [
  'pending',
  'successful_continuation',
  'failed_reversal',
  'mixed',
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

function normalizeQualityLabel(
  value:
    string
    | undefined,
):
LevelV2ShadowSetupQualityLabel
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return QUALITY_LABELS.includes(
    value as
      LevelV2ShadowSetupQualityLabel,
  )
    ? value as
      LevelV2ShadowSetupQualityLabel
    : null;
}

function normalizeOutcomeStatus(
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

  return OUTCOME_STATUSES.includes(
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
) {
  if (value === undefined) {
    return undefined;
  }

  return isLevelV2ShadowSetupQualityDirection(
    value,
  )
    ? value
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

interface QualitySampleQuery {
  symbol?: string;
  classifierId?: string;
  qualityLabel?: string;
  expectedDirection?: string;
  outcomeStatus?: string;
  limit?: string;
}

function parseFilters(
  query:
    QualitySampleQuery,
):
LevelV2ShadowSetupQualitySampleFilters
| null {
  const symbol =
    normalizeSymbol(
      query.symbol,
    );
  const classifierId =
    normalizeClassifierId(
      query.classifierId,
    );
  const qualityLabel =
    normalizeQualityLabel(
      query.qualityLabel,
    );
  const expectedDirection =
    normalizeDirection(
      query.expectedDirection,
    );
  const outcomeStatus =
    normalizeOutcomeStatus(
      query.outcomeStatus,
    );
  const limit =
    parseLimit(
      query.limit,
    );

  if (
    symbol === null
    || classifierId === null
    || qualityLabel === null
    || expectedDirection === null
    || outcomeStatus === null
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
    qualityLabel:
      qualityLabel
      ?? null,
    expectedDirection:
      expectedDirection
      ?? null,
    outcomeStatus:
      outcomeStatus
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

function readQualitySamples(
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

  return buildLevelV2ShadowSetupQualitySampleSnapshot(
    sourceEntries,
    levels,
    sourceStatus,
    SOURCE_HISTORY_LIMIT,
  );
}

export const levelV2ShadowSetupQualitySampleRoutes:
FastifyPluginAsync<
  LevelV2ShadowSetupQualitySampleRoutesOptions
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
    '/setups/levels-v2/shadow/setup-quality-samples/status',
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
          'level_v2_shadow_setup_quality_samples_unavailable',
          'Level v2 shadow setup quality samples are unavailable',
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
          'invalid_level_v2_shadow_setup_quality_sample_query',
          'Invalid Level v2 shadow setup quality sample query',
        );
      }

      return readQualitySamples(
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
      QualitySampleQuery;
  }>(
    '/setups/levels-v2/shadow/setup-quality-samples',
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
          'level_v2_shadow_setup_quality_samples_unavailable',
          'Level v2 shadow setup quality samples are unavailable',
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
          'invalid_level_v2_shadow_setup_quality_sample_query',
          'Invalid Level v2 shadow setup quality sample query',
        );
      }

      const snapshot =
        readQualitySamples(
          runtime,
          filters.symbol,
          filters.classifierId,
        );
      const allMatching =
        filterLevelV2ShadowSetupQualitySamples(
          snapshot.samples,
          {
            ...filters,
            limit:
              SOURCE_HISTORY_LIMIT,
          },
        );
      const items =
        allMatching
          .slice(
            0,
            filters.limit,
          );
      const response:
      LevelV2ShadowSetupQualitySampleListResponse = {
        items,
        count:
          items.length,
        totalSamples:
          allMatching.length,
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
    '/setups/levels-v2/shadow/setup-quality-samples/diagnostics',
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
          'level_v2_shadow_setup_quality_samples_unavailable',
          'Level v2 shadow setup quality samples are unavailable',
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
          'invalid_level_v2_shadow_setup_quality_sample_query',
          'Invalid Level v2 shadow setup quality sample query',
        );
      }

      return readQualitySamples(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).diagnostics;
    },
  );
};
