import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowSetupQualityDatasetListResponse,
  buildLevelV2ShadowSetupQualityDatasetSnapshot,
  isLevelV2ShadowSetupQualityDatasetConfidence,
  isLevelV2ShadowSetupQualityDatasetDirection,
  isLevelV2ShadowSetupQualityDatasetKind,
} from './level-v2-shadow-setup-quality-dataset.js';
import type {
  LevelV2ShadowSetupQualityDatasetFilters,
} from './level-v2-shadow-setup-quality-dataset.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowSetupQualityDatasetRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const SOURCE_HISTORY_LIMIT =
  10_000;

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

function normalizeKind(
  value:
    string
    | undefined,
) {
  if (value === undefined) {
    return undefined;
  }

  return isLevelV2ShadowSetupQualityDatasetKind(
    value,
  )
    ? value
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

  return isLevelV2ShadowSetupQualityDatasetDirection(
    value,
  )
    ? value
    : null;
}

function normalizeConfidence(
  value:
    string
    | undefined,
) {
  if (value === undefined) {
    return undefined;
  }

  return isLevelV2ShadowSetupQualityDatasetConfidence(
    value,
  )
    ? value
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

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}

function parseInteger(
  value:
    string
    | undefined,
  defaultValue:
    number
    | null,
  maximum: number,
): number | null {
  if (value === undefined) {
    return defaultValue;
  }

  if (value.trim().length === 0) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isInteger(parsed)
    && parsed >= 1
    && parsed <= maximum
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

interface QualityDatasetQuery {
  symbol?: string;
  currentKind?: string;
  expectedDirection?: string;
  anchorConfidence?: string;
  sufficient?: string;
  minimumSamples?: string;
  limit?: string;
}

function parseFilters(
  query:
    QualityDatasetQuery,
):
LevelV2ShadowSetupQualityDatasetFilters
| null {
  const symbol =
    normalizeSymbol(
      query.symbol,
    );
  const currentKind =
    normalizeKind(
      query.currentKind,
    );
  const expectedDirection =
    normalizeDirection(
      query.expectedDirection,
    );
  const anchorConfidence =
    normalizeConfidence(
      query.anchorConfidence,
    );
  const sufficient =
    parseBoolean(
      query.sufficient,
    );
  const minimumSamples =
    parseInteger(
      query.minimumSamples,
      null,
      SOURCE_HISTORY_LIMIT,
    );
  const limit =
    parseInteger(
      query.limit,
      100,
      500,
    );

  if (
    symbol === null
    || currentKind === null
    || expectedDirection === null
    || anchorConfidence === null
    || sufficient === null
    || (
      query.minimumSamples !== undefined
      && minimumSamples === null
    )
    || limit === null
  ) {
    return null;
  }

  return {
    symbol:
      symbol
      ?? null,
    currentKind:
      currentKind
      ?? null,
    expectedDirection:
      expectedDirection
      ?? null,
    anchorConfidence:
      anchorConfidence
      ?? null,
    sufficient:
      sufficient
      ?? null,
    minimumSamples,
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

function readQualityDataset(
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
) {
  const sourceEntries =
    runtime.getMarketEvidenceHistory(
      symbol
      ?? undefined,
      undefined,
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

  return buildLevelV2ShadowSetupQualityDatasetSnapshot(
    sourceEntries,
    levels,
    sourceStatus,
    SOURCE_HISTORY_LIMIT,
  );
}

export const levelV2ShadowSetupQualityDatasetRoutes:
FastifyPluginAsync<
  LevelV2ShadowSetupQualityDatasetRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      symbol?: string;
    };
  }>(
    '/setups/levels-v2/shadow/setup-quality-dataset/status',
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
          'level_v2_shadow_setup_quality_dataset_unavailable',
          'Level v2 shadow setup quality dataset is unavailable',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_setup_quality_dataset_query',
          'Invalid Level v2 shadow setup quality dataset query',
        );
      }

      return readQualityDataset(
        runtime,
        symbol
        ?? null,
      ).status;
    },
  );

  app.get<{
    Querystring:
      QualityDatasetQuery;
  }>(
    '/setups/levels-v2/shadow/setup-quality-dataset',
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
          'level_v2_shadow_setup_quality_dataset_unavailable',
          'Level v2 shadow setup quality dataset is unavailable',
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
          'invalid_level_v2_shadow_setup_quality_dataset_query',
          'Invalid Level v2 shadow setup quality dataset query',
        );
      }

      return buildLevelV2ShadowSetupQualityDatasetListResponse(
        readQualityDataset(
          runtime,
          filters.symbol,
        ),
        filters,
      );
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
    };
  }>(
    '/setups/levels-v2/shadow/setup-quality-dataset/diagnostics',
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
          'level_v2_shadow_setup_quality_dataset_unavailable',
          'Level v2 shadow setup quality dataset is unavailable',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_setup_quality_dataset_query',
          'Invalid Level v2 shadow setup quality dataset query',
        );
      }

      return readQualityDataset(
        runtime,
        symbol
        ?? null,
      ).diagnostics;
    },
  );
};
