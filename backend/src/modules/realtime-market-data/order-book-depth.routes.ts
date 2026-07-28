import type {
  ServerResponse,
} from 'node:http';
import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import type {
  ApiErrorResponse,
} from '../../contracts/nexus-api.js';
import type {
  GetOrderBookDepthSnapshotOptions,
  OrderBookDepthRuntimeEvent,
  OrderBookDepthRuntimeService,
} from './order-book-depth-runtime.types.js';

const SSE_HEARTBEAT_INTERVAL_MS =
  15_000;

const SSE_RETRY_INTERVAL_MS =
  3_000;

interface OrderBookDepthRoutesOptions {
  orderBookDepthService:
    OrderBookDepthRuntimeService;
}

interface OrderBookDepthQuery {
  symbol?: string;
  levels?: string;
  depthRangePct?: string;
  bucketSize?: string;
  maxBuckets?: string;
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
    requestId:
      request.id,
  };

  return reply
    .status(statusCode)
    .send(payload);
}

function normalizeSymbol(
  value: string | undefined,
): string | null {
  if (value === undefined) {
    return null;
  }

  const symbol =
    value
      .trim()
      .toUpperCase();

  return /^[A-Z0-9]{5,20}$/u.test(symbol)
    ? symbol
    : '';
}

function normalizeInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === undefined) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isSafeInteger(parsed)
    && parsed >= min
    && parsed <= max
      ? parsed
      : null;
}

function normalizeNumber(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number | null {
  if (value === undefined) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    && parsed >= min
    && parsed <= max
      ? parsed
      : null;
}

function normalizeOptionalNumber(
  value: string | undefined,
  min: number,
  max: number,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    && parsed >= min
    && parsed <= max
      ? parsed
      : null;
}

function resolveSnapshotOptions(
  query: OrderBookDepthQuery,
): GetOrderBookDepthSnapshotOptions | null {
  const levelsLimit =
    normalizeInteger(
      query.levels,
      100,
      1,
      1_000,
    );

  const depthRangePct =
    normalizeNumber(
      query.depthRangePct,
      0.2,
      0.01,
      5,
    );

  const bucketSize =
    normalizeOptionalNumber(
      query.bucketSize,
      0.00000001,
      1_000_000_000,
    );

  const maxBucketsPerSide =
    normalizeInteger(
      query.maxBuckets,
      100,
      1,
      500,
    );

  if (
    levelsLimit === null
    || depthRangePct === null
    || bucketSize === null
    || maxBucketsPerSide === null
  ) {
    return null;
  }

  return {
    levelsLimit,
    depthRangePct,
    maxBucketsPerSide,
    ...(
      bucketSize === undefined
        ? {}
        : { bucketSize }
    ),
  };
}

function writeSseEvent(
  response: ServerResponse,
  id: string,
  event:
    OrderBookDepthRuntimeEvent['type'],
  data: unknown,
): void {
  if (
    response.destroyed
    || response.writableEnded
  ) {
    return;
  }

  response.write(
    `id: ${id}\n`,
  );

  response.write(
    `event: ${event}\n`,
  );

  response.write(
    `data: ${JSON.stringify(data)}\n\n`,
  );
}

export const orderBookDepthRoutes:
FastifyPluginAsync<
  OrderBookDepthRoutesOptions
> = async (
  app,
  options,
) => {
  app.get(
    '/market/order-book/status',
    async () =>
      options
        .orderBookDepthService
        .getStatus(),
  );

  app.get<{
    Querystring:
      OrderBookDepthQuery;
  }>(
    '/market/order-book/snapshot',
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
          'symbol_required',
          'Order book symbol is required',
        );
      }

      if (symbol === '') {
        return sendError(
          request,
          reply,
          400,
          'invalid_symbol',
          'Invalid symbol format',
        );
      }

      const snapshotOptions =
        resolveSnapshotOptions(
          request.query,
        );

      if (snapshotOptions === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_order_book_options',
          'Invalid order book snapshot options',
        );
      }

      const snapshot =
        options
          .orderBookDepthService
          .getSnapshot(
            symbol,
            snapshotOptions,
          );

      if (!snapshot) {
        return sendError(
          request,
          reply,
          404,
          'symbol_not_subscribed',
          `Symbol ${symbol} is not subscribed`,
        );
      }

      return snapshot;
    },
  );

  app.get<{
    Querystring:
      OrderBookDepthQuery;
  }>(
    '/market/order-book/stream',
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
          'symbol_required',
          'Order book symbol is required',
        );
      }

      if (symbol === '') {
        return sendError(
          request,
          reply,
          400,
          'invalid_symbol',
          'Invalid symbol format',
        );
      }

      const snapshotOptions =
        resolveSnapshotOptions(
          request.query,
        );

      if (snapshotOptions === null) {
        return sendError(
          request,
          reply,
          400,
          'invalid_order_book_options',
          'Invalid order book stream options',
        );
      }

      const releaseSymbol =
        options
          .orderBookDepthService
          .acquireSymbol(
            symbol,
          );

      reply.hijack();

      const response =
        reply.raw;

      response.statusCode =
        200;

      response.setHeader(
        'Content-Type',
        'text/event-stream; charset=utf-8',
      );

      response.setHeader(
        'Cache-Control',
        'no-cache, no-transform',
      );

      response.setHeader(
        'Connection',
        'keep-alive',
      );

      response.setHeader(
        'X-Accel-Buffering',
        'no',
      );

      response.flushHeaders();

      let sequence =
        0;

      const nextId =
        () =>
          `${request.id}-${++sequence}`;

      response.write(
        `retry: ${SSE_RETRY_INTERVAL_MS}\n\n`,
      );

      writeSseEvent(
        response,
        nextId(),
        'status',
        options
          .orderBookDepthService
          .getStatus(),
      );

      const initialSnapshot =
        options
          .orderBookDepthService
          .getSnapshot(
            symbol,
            snapshotOptions,
          );

      if (initialSnapshot) {
        writeSseEvent(
          response,
          nextId(),
          'snapshot',
          initialSnapshot,
        );
      }

      const unsubscribe =
        options
          .orderBookDepthService
          .subscribe(
            (event) => {
              if (
                event.type
                === 'status'
              ) {
                writeSseEvent(
                  response,
                  nextId(),
                  'status',
                  event.status,
                );
                return;
              }

              if (
                event.symbol
                !== symbol
              ) {
                return;
              }

              const snapshot =
                options
                  .orderBookDepthService
                  .getSnapshot(
                    symbol,
                    snapshotOptions,
                  );

              if (!snapshot) {
                return;
              }

              writeSseEvent(
                response,
                nextId(),
                'snapshot',
                snapshot,
              );
            },
            symbol,
          );

      const heartbeat =
        setInterval(
          () => {
            if (
              !response.destroyed
              && !response.writableEnded
            ) {
              response.write(
                `: heartbeat ${new Date().toISOString()}\n\n`,
              );
            }
          },
          SSE_HEARTBEAT_INTERVAL_MS,
        );

      heartbeat.unref();

      let cleanedUp =
        false;

      const cleanup = () => {
        if (cleanedUp) {
          return;
        }

        cleanedUp = true;
        clearInterval(heartbeat);
        unsubscribe();
        releaseSymbol();
      };

      response.once(
        'close',
        cleanup,
      );

      response.once(
        'error',
        cleanup,
      );

      return reply;
    },
  );
};
