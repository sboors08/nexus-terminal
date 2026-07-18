import type { ServerResponse } from 'node:http';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '../../contracts/nexus-api.js';
import type {
  RealtimeMarketDataEvent,
  RealtimeMarketDataService,
} from './realtime-market-data.types.js';

const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
const SSE_RETRY_INTERVAL_MS = 3_000;

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

function writeSseEvent(
  response: ServerResponse,
  id: string,
  event: RealtimeMarketDataEvent['type'],
  data: unknown,
): void {
  if (response.destroyed || response.writableEnded) return;

  response.write(`id: ${id}\n`);
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
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

  app.get<{ Querystring: { symbol?: string } }>(
    '/market/realtime/stream',
    async (request, reply) => {
      const symbol = normalizeSymbol(request.query.symbol);
      if (symbol === '') {
        return sendError(request, reply, 400, 'invalid_symbol', 'Invalid symbol format');
      }

      const releaseSymbol = symbol
        ? options.realtimeMarketDataService.acquireSymbol(symbol)
        : null;
      const snapshots = options.realtimeMarketDataService.getSnapshots(symbol ?? undefined);

      reply.hijack();
      const response = reply.raw;
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();

      let sequence = 0;
      const nextId = () => `${request.id}-${++sequence}`;

      response.write(`retry: ${SSE_RETRY_INTERVAL_MS}\n\n`);
      writeSseEvent(
        response,
        nextId(),
        'status',
        options.realtimeMarketDataService.getStatus(),
      );

      for (const snapshot of snapshots) {
        writeSseEvent(response, nextId(), 'snapshot', snapshot);
      }

      const unsubscribe = options.realtimeMarketDataService.subscribe((event) => {
        writeSseEvent(
          response,
          nextId(),
          event.type,
          event.type === 'status' ? event.status : event.snapshot,
        );
      }, symbol ?? undefined);

      const heartbeat = setInterval(() => {
        if (!response.destroyed && !response.writableEnded) {
          response.write(`: heartbeat ${new Date().toISOString()}\n\n`);
        }
      }, SSE_HEARTBEAT_INTERVAL_MS);
      heartbeat.unref();

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        clearInterval(heartbeat);
        unsubscribe();
        releaseSymbol?.();
      };

      response.once('close', cleanup);
      response.once('error', cleanup);
      return reply;
    },
  );
};
