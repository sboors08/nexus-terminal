import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../../contracts/nexus-api.js';
import {
  buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore,
} from './level-v2-shadow-market-evidence-behavior-history.js';
import type {
  LevelV2ShadowMarketEvidenceBehavior,
  LevelV2ShadowMarketEvidenceBehaviorConfidence,
} from './level-v2-shadow-market-evidence-behavior-analysis.types.js';
import type {
  LevelV2ShadowMarketEvidenceBehaviorHistoryFilters,
  LevelV2ShadowMarketEvidenceBehaviorHistoryListResponse,
} from './level-v2-shadow-market-evidence-behavior-history.types.js';
import type {
  LevelV2ShadowRuntimeReader,
} from './level-v2-shadow-runtime.types.js';

export interface LevelV2ShadowMarketEvidenceBehaviorHistoryRoutesOptions {
  levelV2ShadowRuntimeReader?:
    LevelV2ShadowRuntimeReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const CLASSIFIER_ID_PATTERN =
  /^[A-Za-z0-9:._-]{1,320}$/;

const SOURCE_HISTORY_LIMIT =
  10_000;

const BEHAVIORS:
readonly LevelV2ShadowMarketEvidenceBehavior[] = [
  'directional_continuation',
  'aggressive_buy_absorption',
  'aggressive_sell_absorption',
  'momentum_exhaustion',
  'mixed',
  'insufficient_data',
];

const CONFIDENCES:
readonly LevelV2ShadowMarketEvidenceBehaviorConfidence[] = [
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

function normalizeBehavior(
  value:
    string
    | undefined,
):
LevelV2ShadowMarketEvidenceBehavior
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return BEHAVIORS.includes(
    value as
      LevelV2ShadowMarketEvidenceBehavior,
  )
    ? value as
      LevelV2ShadowMarketEvidenceBehavior
    : null;
}

function normalizeConfidence(
  value:
    string
    | undefined,
):
LevelV2ShadowMarketEvidenceBehaviorConfidence
| null
| undefined {
  if (value === undefined) {
    return undefined;
  }

  return CONFIDENCES.includes(
    value as
      LevelV2ShadowMarketEvidenceBehaviorConfidence,
  )
    ? value as
      LevelV2ShadowMarketEvidenceBehaviorConfidence
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
  behavior?: string;
  confidence?: string;
  limit?: string;
}

function parseFilters(
  query:
    HistoryQuery,
):
LevelV2ShadowMarketEvidenceBehaviorHistoryFilters
| null {
  const symbol =
    normalizeSymbol(
      query.symbol,
    );
  const classifierId =
    normalizeClassifierId(
      query.classifierId,
    );
  const behavior =
    normalizeBehavior(
      query.behavior,
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
    || behavior === null
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
    behavior:
      behavior
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
    buildLevelV2ShadowMarketEvidenceBehaviorHistoryStore(
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

export const levelV2ShadowMarketEvidenceBehaviorHistoryRoutes:
FastifyPluginAsync<
  LevelV2ShadowMarketEvidenceBehaviorHistoryRoutesOptions
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
    '/setups/levels-v2/shadow/market-evidence/behavior-history/status',
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
          'level_v2_shadow_market_evidence_behavior_history_unavailable',
          'Level v2 shadow market evidence behavior history is unavailable',
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
          'invalid_level_v2_shadow_market_evidence_behavior_history_query',
          'Invalid Level v2 shadow market evidence behavior-history query',
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
    '/setups/levels-v2/shadow/market-evidence/behavior-history',
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
          'level_v2_shadow_market_evidence_behavior_history_unavailable',
          'Level v2 shadow market evidence behavior history is unavailable',
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
          'invalid_level_v2_shadow_market_evidence_behavior_history_query',
          'Invalid Level v2 shadow market evidence behavior-history query',
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
          filters.behavior
          ?? undefined,
          filters.confidence
          ?? undefined,
        );

      const response:
      LevelV2ShadowMarketEvidenceBehaviorHistoryListResponse = {
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
    '/setups/levels-v2/shadow/market-evidence/behavior-history/diagnostics',
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
          'level_v2_shadow_market_evidence_behavior_history_unavailable',
          'Level v2 shadow market evidence behavior history is unavailable',
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
          'invalid_level_v2_shadow_market_evidence_behavior_history_query',
          'Invalid Level v2 shadow market evidence behavior-history query',
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
