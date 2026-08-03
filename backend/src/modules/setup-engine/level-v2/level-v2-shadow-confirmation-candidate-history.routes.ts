import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowConfirmationCandidateHistoryStore,
} from './level-v2-shadow-confirmation-candidate-history.js';
import type {
  LevelV2ShadowConfirmationCandidateHistoryFilters,
  LevelV2ShadowConfirmationCandidateHistoryListResponse,
} from './level-v2-shadow-confirmation-candidate-history.types.js';
import type {
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationCandidateVerdict,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowConfirmationCandidateHistoryRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

const SOURCE_HISTORY_LIMIT =
  10_000;

const VERDICTS:
readonly LevelV2ShadowConfirmationCandidateVerdict[] = [
  'supported',
  'contradicted',
  'mixed',
  'insufficient_data',
];

const CONFIDENCES:
readonly LevelV2ShadowConfirmationCandidateConfidence[] = [
  'low',
  'medium',
  'high',
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

function normalizeVerdict(
  value:
    string
    | undefined,
):
LevelV2ShadowConfirmationCandidateVerdict
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return VERDICTS.includes(
    value as
      LevelV2ShadowConfirmationCandidateVerdict,
  )
    ? value as
      LevelV2ShadowConfirmationCandidateVerdict
    : null;
}

function normalizeConfidence(
  value:
    string
    | undefined,
):
LevelV2ShadowConfirmationCandidateConfidence
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return CONFIDENCES.includes(
    value as
      LevelV2ShadowConfirmationCandidateConfidence,
  )
    ? value as
      LevelV2ShadowConfirmationCandidateConfidence
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

interface HistoryQuery {
  symbol?: string;
  classifierId?: string;
  verdict?: string;
  confidence?: string;
  limit?: string;
}

function parseFilters(
  query:
    HistoryQuery,
):
LevelV2ShadowConfirmationCandidateHistoryFilters
| null {
  const symbol =
    normalizeSymbol(
      query.symbol,
    );
  const classifierId =
    normalizeClassifierId(
      query.classifierId,
    );
  const verdict =
    normalizeVerdict(
      query.verdict,
    );
  const confidence =
    normalizeConfidence(
      query.confidence,
    );
  const limit =
    parseLimit(
      query.limit,
    );

  if (
    symbol === null
    || classifierId === null
    || verdict === null
    || confidence === null
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
    verdict:
      verdict
      ?? null,
    confidence:
      confidence
      ?? null,
    limit,
  };
}

function readHistory(
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
  const store =
    buildLevelV2ShadowConfirmationCandidateHistoryStore(
      sourceEntries,
    );

  return {
    store,
    status:
      store.getStatus(
        sourceEntries.length,
        sourceStatus,
        SOURCE_HISTORY_LIMIT,
      ),
    diagnostics:
      store.getDiagnostics(),
  };
}

export const levelV2ShadowConfirmationCandidateHistoryRoutes:
FastifyPluginAsync<
  LevelV2ShadowConfirmationCandidateHistoryRoutesOptions
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
    '/setups/levels-v2/shadow/confirmation-candidates/history/status',
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
          'level_v2_shadow_confirmation_candidate_history_unavailable',
          'Level v2 shadow confirmation candidate history is unavailable',
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
          'invalid_level_v2_shadow_confirmation_candidate_history_query',
          'Invalid Level v2 shadow confirmation candidate history query',
        );
      }

      return readHistory(
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
      HistoryQuery;
  }>(
    '/setups/levels-v2/shadow/confirmation-candidates/history',
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
          'level_v2_shadow_confirmation_candidate_history_unavailable',
          'Level v2 shadow confirmation candidate history is unavailable',
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
          'invalid_level_v2_shadow_confirmation_candidate_history_query',
          'Invalid Level v2 shadow confirmation candidate history query',
        );
      }

      const {
        store,
        status,
        diagnostics,
      } = readHistory(
        runtime,
        filters.symbol,
        filters.classifierId,
      );

      const all =
        store.getHistory(
          filters.symbol
          ?? undefined,
          filters.classifierId
          ?? undefined,
          SOURCE_HISTORY_LIMIT,
          filters.verdict
          ?? undefined,
          filters.confidence
          ?? undefined,
        );

      const response:
      LevelV2ShadowConfirmationCandidateHistoryListResponse = {
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
        totalEntries:
          all.length,
        status,
        diagnostics,
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
    '/setups/levels-v2/shadow/confirmation-candidates/history/diagnostics',
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
          'level_v2_shadow_confirmation_candidate_history_unavailable',
          'Level v2 shadow confirmation candidate history is unavailable',
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
          'invalid_level_v2_shadow_confirmation_candidate_history_query',
          'Invalid Level v2 shadow confirmation candidate history query',
        );
      }

      return readHistory(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).diagnostics;
    },
  );
};
