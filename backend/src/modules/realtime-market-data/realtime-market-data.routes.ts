import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '../../contracts/nexus-api.js';
import type { RealtimeMarketDataService } from './realtime-market-data.types.js';

interface RealtimeMarketDataRoutesOptions {
  realtimeMarketDataService: RealtimeMarketDataService;
}

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message: string,
) {
  const payload: ApiErrorResponse = { error, message, requestId: request.id };
  return reply.status(statusCode).send(payload);
}

function normalizeSymbol(value: string | undefined): string | null {
  if (value === undefined) return null;
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{5,20}$/.test(symbol) ? symbol : '';
}

export const realtimeMarketDataRoutes: FastifyPluginAsync<RealtimeMarketDataRoutesOptions> = async (
  app,
  options,
) => {
  app.get('/market/realtime/status', async () => options.realtimeMarketDataService.getStatus());

  app.get<{ Querystring: { symbol?: string } }>(
    '/market/realtime/snapshot',
    async (request, reply) => {
      const symbol = normalizeSymbol(request.query.symbol);
      if (symbol === '') {
        return sendError(request, reply, 400, 'invalid_symbol', 'Invalid symbol format');
      }

      const snapshots = options.realtimeMarketDataService.getSnapshots(symbol ?? undefined);
      if (symbol && snapshots.length === 0) {
        return sendError(request, reply, 404, 'symbol_not_subscribed', `Symbol ${symbol} is not subscribed`);
      }

      return snapshots;
    },
  );
};
