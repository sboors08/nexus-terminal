import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowConfirmationCandidateDiagnostics,
  buildLevelV2ShadowConfirmationCandidates,
} from './level-v2-shadow-confirmation-candidate.js';
import type {
  LevelV2ShadowConfirmationCandidateConfidence,
  LevelV2ShadowConfirmationCandidateFilters,
  LevelV2ShadowConfirmationCandidateListResponse,
  LevelV2ShadowConfirmationCandidateVerdict,
} from './level-v2-shadow-confirmation-candidate.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowConfirmationCandidateRoutesOptions {
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

interface CandidateQuery {
  symbol?: string;
  classifierId?: string;
  verdict?: string;
  confidence?: string;
  limit?: string;
}

function parseFilters(
  query:
    CandidateQuery,
):
LevelV2ShadowConfirmationCandidateFilters
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

function readCandidates(
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
  const candidates =
    buildLevelV2ShadowConfirmationCandidates(
      sourceEntries,
    );

  return {
    candidates,
    diagnostics:
      buildLevelV2ShadowConfirmationCandidateDiagnostics(
        candidates,
      ),
  };
}

export const levelV2ShadowConfirmationCandidateRoutes:
FastifyPluginAsync<
  LevelV2ShadowConfirmationCandidateRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring:
      CandidateQuery;
  }>(
    '/setups/levels-v2/shadow/confirmation-candidates',
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
          'level_v2_shadow_confirmation_candidates_unavailable',
          'Level v2 shadow confirmation candidates are unavailable',
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
          'invalid_level_v2_shadow_confirmation_candidate_query',
          'Invalid Level v2 shadow confirmation-candidate query',
        );
      }

      const {
        candidates,
        diagnostics,
      } = readCandidates(
        runtime,
        filters.symbol,
        filters.classifierId,
      );
      const filtered =
        candidates.filter(
          (candidate) =>
            (
              filters.verdict === null
              || candidate.verdict
                === filters.verdict
            )
            && (
              filters.confidence === null
              || candidate.confidence
                === filters.confidence
            ),
        );

      const response:
      LevelV2ShadowConfirmationCandidateListResponse = {
        items:
          filtered.slice(
            0,
            filters.limit,
          ),
        count:
          Math.min(
            filtered.length,
            filters.limit,
          ),
        totalCandidates:
          filtered.length,
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
    '/setups/levels-v2/shadow/confirmation-candidates/diagnostics',
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
          'level_v2_shadow_confirmation_candidates_unavailable',
          'Level v2 shadow confirmation candidates are unavailable',
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
          'invalid_level_v2_shadow_confirmation_candidate_query',
          'Invalid Level v2 shadow confirmation-candidate query',
        );
      }

      return readCandidates(
        runtime,
        symbol
        ?? null,
        classifierId
        ?? null,
      ).diagnostics;
    },
  );
};
