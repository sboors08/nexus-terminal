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
  MarketVolumeSpike,
} from './market-volume-spikes.js';
import {
  isMarketScannerWindowId,
  type MarketScannerWindowId,
} from './scanner-windows.js';
import type {
  MarketWideRealtimeStatus,
} from './market-wide-realtime.service.js';

export interface MarketWideRealtimeRouteService {
  getStatus():
    MarketWideRealtimeStatus;

  getMetrics(
    symbol?: string,
    scannerWindow?:
      MarketScannerWindowId,
  ): MarketScannerMetrics[];
  getVolumeSpikes(
    symbol?: string,
  ): MarketVolumeSpike[];
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
        && !isMarketScannerWindowId(
          scannerWindow,
        )
      ) {
        return sendError(
          request,
          reply,
          400,
          'invalid_market_wide_scanner_window',
          'Invalid market-wide scanner window',
        );
      }

      const metrics =
        options
          .marketWideRealtimeService
          .getMetrics(
            symbol ?? undefined,
            scannerWindow,
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
  app.get<{
    Querystring: {
      symbol?: string;
      limit?: string;
    };
  }>(
    '/market/realtime/market-wide/volume-spikes',
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

      const requestedLimit =
        request.query.limit;

      let limit = 20;

      if (
        requestedLimit !== undefined
      ) {
        const parsedLimit =
          Number(requestedLimit);

        if (
          !Number.isInteger(parsedLimit)
          || parsedLimit < 1
          || parsedLimit > 100
        ) {
          return sendError(
            request,
            reply,
            400,
            'invalid_volume_spike_limit',
            'Volume spike limit must be an integer from 1 to 100',
          );
        }

        limit = parsedLimit;
      }

      return options
        .marketWideRealtimeService
        .getVolumeSpikes(
          symbol ?? undefined,
        )
        .slice(
          0,
          limit,
        );
    },
  );
};
