import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  MarketScannerMetrics,
} from './market-scanner-metrics.js';
import type {
  MarketWideRealtimeStatus,
} from './market-wide-realtime.service.js';

export interface MarketWideRealtimeRouteService {
  getStatus():
    MarketWideRealtimeStatus;

  getMetrics(
    symbol?: string,
  ): MarketScannerMetrics[];
}

interface MarketWideRealtimeRoutesOptions {
  marketWideRealtimeService:
    MarketWideRealtimeRouteService;
}

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
      requestId: request.id,
    };

  return reply
    .status(statusCode)
    .send(payload);
}

function normalizeSymbol(
  value:
    string
    | undefined,
): string | null {
  if (value === undefined) {
    return null;
  }

  const symbol =
    value.trim().toUpperCase();

  return /^[A-Z0-9]{5,30}$/
    .test(symbol)
      ? symbol
      : '';
}

export const marketWideRealtimeRoutes:
FastifyPluginAsync<
  MarketWideRealtimeRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/market/realtime/market-wide/status',
    async () =>
      options
        .marketWideRealtimeService
        .getStatus(),
  );

  app.get<{
    Querystring: {
      symbol?: string;
      scannerWindow?: string;
    };
  }>(
    '/market/realtime/market-wide/scanner-metrics',
    async (
      request,
      reply,
    ) => {
      const symbol =
        normalizeSymbol(
          request.query.symbol,
        );

      if (symbol === '') {
        return sendError(
          request,
          reply,
          400,
          'invalid_symbol',
          'Invalid symbol format',
        );
      }

      const scannerWindow =
        request.query
          .scannerWindow;

      if (
        scannerWindow !== undefined
        && scannerWindow !== '1m'
      ) {
        return sendError(
          request,
          reply,
          400,
          'unsupported_market_wide_scanner_window',
          'Market-wide realtime metrics currently support only the 1m scanner window',
        );
      }

      const metrics =
        options
          .marketWideRealtimeService
          .getMetrics(
            symbol ?? undefined,
          );

      if (
        symbol
        && metrics.length === 0
      ) {
        return sendError(
          request,
          reply,
          404,
          'market_wide_symbol_not_found',
          `Symbol ${symbol} is not present in the market-wide universe`,
        );
      }

      return metrics;
    },
  );
};