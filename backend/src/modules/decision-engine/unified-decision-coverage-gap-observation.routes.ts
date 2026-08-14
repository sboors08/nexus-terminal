import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import {
  isLevelEngineTimeframe,
  normalizeLevelEngineSymbol,
} from '../level-engine/level-engine.contract.js';
import type {
  UnifiedDecisionCoverageGapFilter,
  UnifiedDecisionCoverageGapKind,
  UnifiedDecisionCoverageGapObserver,
} from './unified-decision-coverage-gap-observation.types.js';

const GAP_KINDS:
readonly UnifiedDecisionCoverageGapKind[] = [
  'market_context_single_conflict',
  'market_context_double_conflict',
  'terminal_setup_outcome',
];

export interface UnifiedDecisionCoverageGapObservationRoutesOptions {
  readonly observer?: UnifiedDecisionCoverageGapObserver;
}

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
) {
  const payload: ApiErrorResponse = {
    error,
    message,
    requestId: request.id,
  };
  return reply.status(statusCode).send(payload);
}

function requireObserver(
  request: FastifyRequest,
  reply: FastifyReply,
  observer: UnifiedDecisionCoverageGapObserver | undefined,
): UnifiedDecisionCoverageGapObserver | null {
  if (observer) return observer;
  sendError(
    request,
    reply,
    503,
    'unified_decision_coverage_gap_observer_unavailable',
    'Unified Decision coverage-gap observer is unavailable',
  );
  return null;
}

function parseFilter(
  query: {
    readonly kind?: string;
    readonly symbol?: string;
    readonly timeframe?: string;
    readonly limit?: string;
  },
  defaultLimit: number,
  maximumLimit: number,
): UnifiedDecisionCoverageGapFilter | string {
  const kind = query.kind?.trim().toLowerCase();
  if (kind !== undefined && !GAP_KINDS.includes(kind as UnifiedDecisionCoverageGapKind)) {
    return 'invalid_kind';
  }
  let symbol: string | undefined;
  if (query.symbol !== undefined) {
    try {
      symbol = normalizeLevelEngineSymbol(query.symbol);
    } catch {
      return 'invalid_symbol';
    }
  }
  const timeframe = query.timeframe?.trim().toLowerCase();
  if (timeframe !== undefined && !isLevelEngineTimeframe(timeframe)) {
    return 'invalid_timeframe';
  }
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maximumLimit) {
    return 'invalid_limit';
  }
  return {
    ...(kind ? { kind: kind as UnifiedDecisionCoverageGapKind } : {}),
    ...(symbol ? { symbol } : {}),
    ...(timeframe ? { timeframe } : {}),
    limit,
  };
}

function sendFilterError(
  request: FastifyRequest,
  reply: FastifyReply,
  code: string,
  maximumLimit: number,
) {
  const messages: Record<string, string> = {
    invalid_kind: `Kind must be one of: ${GAP_KINDS.join(', ')}`,
    invalid_symbol: 'Symbol filter must be a valid Binance symbol',
    invalid_timeframe: 'Timeframe filter must be 1m, 5m, 15m, 1h or 4h',
    invalid_limit: `Limit must be an integer from 1 to ${maximumLimit}`,
  };
  return sendError(
    request,
    reply,
    400,
    code,
    messages[code] ?? 'Invalid coverage-gap filter',
  );
}

export const unifiedDecisionCoverageGapObservationRoutes:
FastifyPluginAsync<UnifiedDecisionCoverageGapObservationRoutesOptions> =
async (app, options) => {
  app.get(
    '/decision-engine/coverage-gaps/status',
    async (request, reply) => {
      const observer = requireObserver(request, reply, options.observer);
      return observer ? observer.getStatus() : reply;
    },
  );

  app.get<{
    Querystring: {
      kind?: string;
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };
  }>(
    '/decision-engine/coverage-gaps',
    async (request, reply) => {
      const filter = parseFilter(request.query, 100, 500);
      if (typeof filter === 'string') {
        return sendFilterError(request, reply, filter, 500);
      }
      const observer = requireObserver(request, reply, options.observer);
      return observer
        ? { status: observer.getStatus(), cases: observer.getCases(filter) }
        : reply;
    },
  );

  app.get<{
    Querystring: {
      kind?: string;
      symbol?: string;
      timeframe?: string;
      limit?: string;
    };
  }>(
    '/decision-engine/coverage-gaps/export',
    async (request, reply) => {
      const filter = parseFilter(request.query, 1_000, 10_000);
      if (typeof filter === 'string') {
        return sendFilterError(request, reply, filter, 10_000);
      }
      const observer = requireObserver(request, reply, options.observer);
      return observer ? observer.exportReport(filter) : reply;
    },
  );
};
