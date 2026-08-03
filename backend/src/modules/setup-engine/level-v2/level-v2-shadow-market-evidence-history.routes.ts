import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';
import type {
  LevelV2ShadowMarketEvidenceHistoryFilters,
  LevelV2ShadowMarketEvidenceHistoryListResponse,
} from './level-v2-shadow-market-evidence-history.types.js';

export interface LevelV2ShadowMarketEvidenceHistoryRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

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
      | 'getMarketEvidenceHistory'
      | 'getMarketEvidenceHistoryStatus'
    >
  > {
  return typeof runtime
    .getMarketEvidenceHistory
      === 'function'
    && typeof runtime
      .getMarketEvidenceHistoryStatus
      === 'function';
}

export const levelV2ShadowMarketEvidenceHistoryRoutes:
FastifyPluginAsync<
  LevelV2ShadowMarketEvidenceHistoryRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/setups/levels-v2/shadow/market-evidence/history/status',
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
          'level_v2_shadow_market_evidence_history_unavailable',
          'Level v2 shadow market evidence history is unavailable',
        );
      }

      return runtime
        .getMarketEvidenceHistoryStatus();
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      classifierId?: string;
      limit?: string;
    };
  }>(
    '/setups/levels-v2/shadow/market-evidence/history',
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
          'invalid_level_v2_shadow_market_evidence_history_symbol',
          'Invalid Level v2 shadow market evidence history symbol',
        );
      }

      const classifierId =
        normalizeClassifierId(
          request.query.classifierId,
        );

      if (classifierId === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_level_v2_shadow_market_evidence_history_classifier_id',
          'Invalid Level v2 shadow market evidence history classifierId',
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
          'invalid_level_v2_shadow_market_evidence_history_limit',
          'Level v2 shadow market evidence history limit must be an integer from 1 to 500',
        );
      }

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
          'level_v2_shadow_market_evidence_history_unavailable',
          'Level v2 shadow market evidence history is unavailable',
        );
      }

      const items =
        runtime
          .getMarketEvidenceHistory(
            symbol
            ?? undefined,
            classifierId
            ?? undefined,
            limit,
          );

      const status =
        runtime
          .getMarketEvidenceHistoryStatus();

      const filters:
      LevelV2ShadowMarketEvidenceHistoryFilters = {
        symbol:
          symbol
          ?? null,
        classifierId:
          classifierId
          ?? null,
        limit,
      };

      const response:
      LevelV2ShadowMarketEvidenceHistoryListResponse = {
        items,
        count:
          items.length,
        totalEntries:
          status.entriesCount,
        status,
        filters,
      };

      return response;
    },
  );
};
