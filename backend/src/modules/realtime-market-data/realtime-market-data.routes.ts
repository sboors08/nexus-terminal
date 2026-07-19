import type { ServerResponse } from 'node:http';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import type { ApiErrorResponse } from '../../contracts/nexus-api.js';
import type {
  RealtimeMarketDataEvent,
  RealtimeMarketDataService,
} from './realtime-market-data.types.js';

const SSE_HEARTBEAT_INTERVAL_MS = 15_000;
const MARKET_LIST_SNAPSHOT_FLUSH_INTERVAL_MS = 1_000;
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

function normalizeSymbols(value: string | undefined): string[] | null {
  if (value === undefined) return null;

  const symbols = [...new Set(
    value
      .split(',')
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean),
  )];

  if (
    symbols.length === 0
    || symbols.length > 100
    || symbols.some((symbol) => !/^[A-Z0-9]{5,20}$/.test(symbol))
  ) {
    return [];
  }

  return symbols;
}

function acquireSymbols(
  service: RealtimeMarketDataService,
  symbols: readonly string[],
): () => void {
  if (service.acquireSymbols) {
    return service.acquireSymbols(symbols);
  }

  const releases = symbols.map((symbol) => service.acquireSymbol(symbol));
  return () => {
    for (const release of releases) release();
  };
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

  app.get<{ Querystring: { symbol?: string; symbols?: string } }>(
    '/market/realtime/stream',
    async (request, reply) => {
      const symbol = normalizeSymbol(request.query.symbol);
      const symbols = normalizeSymbols(request.query.symbols);

      if (symbol === '') {
        return sendError(request, reply, 400, 'invalid_symbol', 'Invalid symbol format');
      }

      if (symbols?.length === 0) {
        return sendError(request, reply, 400, 'invalid_symbols', 'Invalid symbols format');
      }

      if (symbol && symbols) {
        return sendError(
          request,
          reply,
          400,
          'ambiguous_symbols',
          'Use either symbol or symbols, not both',
        );
      }

      const requestedSymbols = symbols ?? (symbol ? [symbol] : null);
      const requestedSymbolSet = requestedSymbols
        ? new Set(requestedSymbols)
        : null;

      const isMarketListStream = symbols !== null;

      const releaseSymbols = requestedSymbols
        ? acquireSymbols(options.realtimeMarketDataService, requestedSymbols)
        : null;

      const snapshots = requestedSymbolSet
        ? options.realtimeMarketDataService
            .getSnapshots()
            .filter((snapshot) => requestedSymbolSet.has(snapshot.symbol))
        : options.realtimeMarketDataService.getSnapshots();

      const compactMarketListSnapshot = (
        snapshot: (typeof snapshots)[number],
      ): (typeof snapshots)[number] => ({
        ...snapshot,
        recentTrades: [],
      });

      const pendingSnapshots = new Map<
        string,
        (typeof snapshots)[number]
      >();

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
        writeSseEvent(
          response,
          nextId(),
          'snapshot',
          isMarketListStream
            ? compactMarketListSnapshot(snapshot)
            : snapshot,
        );
      }

      const unsubscribe = options.realtimeMarketDataService.subscribe((event) => {
        if (event.type === 'status') {
          writeSseEvent(response, nextId(), event.type, event.status);
          return;
        }

        if (
          requestedSymbolSet
          && !requestedSymbolSet.has(event.snapshot.symbol)
        ) {
          return;
        }

        if (isMarketListStream) {
          pendingSnapshots.set(
            event.snapshot.symbol,
            compactMarketListSnapshot(event.snapshot),
          );
          return;
        }

        writeSseEvent(
          response,
          nextId(),
          'snapshot',
          event.snapshot,
        );
      }, symbol ?? undefined);

      const snapshotFlush = isMarketListStream
        ? setInterval(() => {
            if (
              response.destroyed
              || response.writableEnded
              || pendingSnapshots.size === 0
            ) {
              return;
            }

            for (const snapshot of pendingSnapshots.values()) {
              writeSseEvent(
                response,
                nextId(),
                'snapshot',
                snapshot,
              );
            }

            pendingSnapshots.clear();
          }, MARKET_LIST_SNAPSHOT_FLUSH_INTERVAL_MS)
        : null;

      snapshotFlush?.unref();

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
        if (snapshotFlush) clearInterval(snapshotFlush);
        pendingSnapshots.clear();
        unsubscribe();
        releaseSymbols?.();
      };

      response.once('close', cleanup);
      response.once('error', cleanup);
      return reply;
    },
  );
};
