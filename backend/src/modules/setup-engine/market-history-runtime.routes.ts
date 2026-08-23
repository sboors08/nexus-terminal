import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  SetupDirection,
  SetupEngineSetupType,
} from './setup-engine.types.js';
import type {
  SetupEventHistoryReader,
} from './setup-event-history.types.js';
import {
  buildMarketHistoryRuntimeResponse,
} from './market-history-runtime.js';
import {
  MARKET_HISTORY_RUNTIME_TIMEFRAMES,
  type MarketHistoryRuntimeResult,
  type MarketHistoryRuntimeTimeframe,
} from './market-history-runtime.types.js';

export interface MarketHistoryRuntimeRoutesOptions {
  setupEventHistoryReader?:
    SetupEventHistoryReader;
}

const SYMBOL_PATTERN =
  /^[A-Z0-9]{5,30}$/;

const SETUP_TYPES:
readonly SetupEngineSetupType[] = [
  'level_breakout',
  'level_bounce',
];

const DIRECTIONS:
readonly SetupDirection[] = [
  'long',
  'short',
];

const RESULTS:
readonly MarketHistoryRuntimeResult[] = [
  'active',
  'breakout_confirmed',
  'rejection_confirmed',
  'expired',
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
    .status(
      statusCode,
    )
    .send(
      payload,
    );
}

function normalizeSymbol(
  value:
    string
    | undefined,
): string | null {
  if (
    value === undefined
  ) {
    return null;
  }

  const symbol =
    value
      .trim()
      .toUpperCase();

  return SYMBOL_PATTERN.test(
    symbol,
  )
    ? symbol
    : '';
}

function parseEnum<
  Value extends string,
>(
  value:
    string
    | undefined,
  allowedValues:
    readonly Value[],
):
  Value
  | null
  | undefined {
  if (
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    value.trim();

  return allowedValues.includes(
    normalized as Value,
  )
    ? normalized as Value
    : null;
}

function parseLimit(
  value:
    string
    | undefined,
): number | null {
  if (
    value === undefined
  ) {
    return 200;
  }

  if (
    value.trim().length
    === 0
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  return (
    Number.isInteger(
      parsed,
    )
    && parsed >= 1
    && parsed <= 500
  )
    ? parsed
    : null;
}

export const marketHistoryRuntimeRoutes:
FastifyPluginAsync<
  MarketHistoryRuntimeRoutesOptions
> = async (
  app,
  options,
) => {
  app.get<{
    Querystring: {
      symbol?: string;
      timeframe?: string;
      setupType?: string;
      direction?: string;
      result?: string;
      limit?: string;
    };
  }>(
    '/setups/history',
    async (
      request,
      reply,
    ) => {
      const history =
        options
          .setupEventHistoryReader;

      if (!history) {
        return sendError(
          request,
          reply,
          503,
          'market_history_runtime_unavailable',
          'Persistent Setup event history is unavailable',
        );
      }

      const symbol =
        normalizeSymbol(
          request.query
            .symbol,
        );

      if (
        symbol === ''
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_symbol',
          'Invalid Market History symbol',
        );
      }

      const timeframe =
        parseEnum<
          MarketHistoryRuntimeTimeframe
        >(
          request.query
            .timeframe,
          MARKET_HISTORY_RUNTIME_TIMEFRAMES,
        );

      if (
        timeframe === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_timeframe',
          'Market History timeframe must be 1m, 5m, 15m, 1h or 4h',
        );
      }

      const setupType =
        parseEnum<
          SetupEngineSetupType
        >(
          request.query
            .setupType,
          SETUP_TYPES,
        );

      if (
        setupType === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_setup_type',
          'Invalid Market History setup type',
        );
      }

      const direction =
        parseEnum<
          SetupDirection
        >(
          request.query
            .direction,
          DIRECTIONS,
        );

      if (
        direction === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_direction',
          'Market History direction must be long or short',
        );
      }

      const result =
        parseEnum<
          MarketHistoryRuntimeResult
        >(
          request.query
            .result,
          RESULTS,
        );

      if (
        result === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_result',
          'Invalid Market History result',
        );
      }

      const limit =
        parseLimit(
          request.query
            .limit,
        );

      if (
        limit === null
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_history_limit',
          'Market History limit must be an integer from 1 to 500',
        );
      }

      return buildMarketHistoryRuntimeResponse(
        history,
        {
          ...(
            symbol
              ? {
                  symbol,
                }
              : {}
          ),

          ...(
            timeframe
              ? {
                  timeframe,
                }
              : {}
          ),

          ...(
            setupType
              ? {
                  setupType,
                }
              : {}
          ),

          ...(
            direction
              ? {
                  direction,
                }
              : {}
          ),

          ...(
            result
              ? {
                  result,
                }
              : {}
          ),

          limit,
        },
      );
    },
  );
};
