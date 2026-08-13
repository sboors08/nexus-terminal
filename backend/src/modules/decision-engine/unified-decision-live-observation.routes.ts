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
  UnifiedDecisionState,
} from './unified-decision.types.js';
import type {
  UnifiedDecisionLiveObservationFilter,
  UnifiedDecisionLiveObservationRecorder,
} from './unified-decision-live-observation.types.js';

export interface UnifiedDecisionLiveObservationRoutesOptions {
  readonly recorder?:
    UnifiedDecisionLiveObservationRecorder;
}

const DECISION_STATES:
readonly UnifiedDecisionState[] = [
  'observe',
  'possible_long',
  'possible_short',
  'wait_confirmation',
  'setup_confirmed',
  'skip',
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

function requireRecorder(
  request: FastifyRequest,
  reply: FastifyReply,
  recorder:
    UnifiedDecisionLiveObservationRecorder
    | undefined,
): UnifiedDecisionLiveObservationRecorder | null {
  if (!recorder) {
    sendError(
      request,
      reply,
      503,
      'unified_decision_live_observation_unavailable',
      'Unified Decision live observation recorder is unavailable',
    );

    return null;
  }

  return recorder;
}

function parseFilter(
  query: {
    readonly symbol?: string;
    readonly timeframe?: string;
    readonly state?: string;
    readonly direction?: string;
    readonly limit?: string;
  },
  defaultLimit: number,
  maximumLimit: number,
): UnifiedDecisionLiveObservationFilter | string {
  let symbol: string | undefined;

  if (query.symbol !== undefined) {
    try {
      symbol =
        normalizeLevelEngineSymbol(
          query.symbol,
        );
    } catch {
      return 'invalid_symbol';
    }
  }

  const timeframe =
    query.timeframe
      ?.trim()
      .toLowerCase();

  if (
    timeframe !== undefined
    && !isLevelEngineTimeframe(
      timeframe,
    )
  ) {
    return 'invalid_timeframe';
  }

  const state =
    query.state
      ?.trim()
      .toLowerCase();

  if (
    state !== undefined
    && !DECISION_STATES.includes(
      state as UnifiedDecisionState,
    )
  ) {
    return 'invalid_state';
  }

  const direction =
    query.direction
      ?.trim()
      .toLowerCase();

  if (
    direction !== undefined
    && direction !== 'long'
    && direction !== 'short'
    && direction !== 'none'
  ) {
    return 'invalid_direction';
  }

  const limit =
    query.limit === undefined
      ? defaultLimit
      : Number(query.limit);

  if (
    !Number.isInteger(limit)
    || limit < 1
    || limit > maximumLimit
  ) {
    return 'invalid_limit';
  }

  return {
    ...(symbol ? { symbol } : {}),
    ...(timeframe
      ? { timeframe }
      : {}),
    ...(state
      ? {
          state:
            state as UnifiedDecisionState,
        }
      : {}),
    ...(direction
      ? {
          direction:
            direction as
              'long' | 'short' | 'none',
        }
      : {}),
    limit,
  };
}

function sendFilterError(
  request: FastifyRequest,
  reply: FastifyReply,
  code: string,
  maximumLimit: number,
) {
  const messages:
  Record<string, string> = {
    invalid_symbol:
      'Symbol filter must be a valid Binance symbol',
    invalid_timeframe:
      'Timeframe filter must be 1m, 5m, 15m, 1h or 4h',
    invalid_state:
      'Decision state filter is invalid',
    invalid_direction:
      'Direction filter must be long, short or none',
    invalid_limit:
      `Limit must be an integer from 1 to ${maximumLimit}`,
  };

  return sendError(
    request,
    reply,
    400,
    code,
    messages[code]
    ?? 'Invalid live observation filter',
  );
}

export const unifiedDecisionLiveObservationRoutes:
FastifyPluginAsync<
  UnifiedDecisionLiveObservationRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/decision-engine/live-observations/status',
    async (request, reply) => {
      const recorder =
        requireRecorder(
          request,
          reply,
          options.recorder,
        );

      return recorder
        ? recorder.getStatus()
        : reply;
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      timeframe?: string;
      state?: string;
      direction?: string;
      limit?: string;
    };
  }>(
    '/decision-engine/live-observations',
    async (request, reply) => {
      const filter =
        parseFilter(
          request.query,
          100,
          500,
        );

      if (typeof filter === 'string') {
        return sendFilterError(
          request,
          reply,
          filter,
          500,
        );
      }

      const recorder =
        requireRecorder(
          request,
          reply,
          options.recorder,
        );

      return recorder
        ? {
            status:
              recorder.getStatus(),
            observations:
              recorder.getObservations(
                filter,
              ),
          }
        : reply;
    },
  );

  app.get<{
    Querystring: {
      symbol?: string;
      timeframe?: string;
      state?: string;
      direction?: string;
      limit?: string;
    };
  }>(
    '/decision-engine/live-observations/export',
    async (request, reply) => {
      const filter =
        parseFilter(
          request.query,
          5_000,
          10_000,
        );

      if (typeof filter === 'string') {
        return sendFilterError(
          request,
          reply,
          filter,
          10_000,
        );
      }

      const recorder =
        requireRecorder(
          request,
          reply,
          options.recorder,
        );

      return recorder
        ? recorder.exportDataset(
            filter,
          )
        : reply;
    },
  );
};
